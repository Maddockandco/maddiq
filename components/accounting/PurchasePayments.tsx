'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

export default function PurchasePayments({ clientId }: { clientId: string }) {
  const [payments, setPayments] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [contactId, setContactId] = useState('')
  const [outstandingBills, setOutstandingBills] = useState<any[]>([])
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const [paymentsRes, contactsRes, accountsRes] = await Promise.all([
      supabase.from('purchase_payments').select('*, contacts(name)').eq('client_id', clientId).order('payment_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_supplier', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name').eq('client_id', clientId).eq('is_active', true).eq('account_type', 'bank').order('code'),
    ])
    if (paymentsRes.data) setPayments(paymentsRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    if (accountsRes.data) setBankAccounts(accountsRes.data)
    setLoading(false)
  }

  async function handleContactChange(id: string) {
    setContactId(id)
    setAllocations({})
    setAmount('')
    if (!id) { setOutstandingBills([]); return }

    const { data } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('client_id', clientId)
      .eq('contact_id', id)
      .in('status', ['awaiting_payment', 'partially_paid'])
      .order('due_date', { ascending: true })

    setOutstandingBills(data || [])
  }

  function updateAllocation(billId: string, value: string) {
    setAllocations({ ...allocations, [billId]: value })
  }

  function autoAllocate(totalAmount: string) {
    let remaining = parseFloat(totalAmount) || 0
    const newAllocations: Record<string, string> = {}
    for (const bill of outstandingBills) {
      const balance = parseFloat(bill.total) - parseFloat(bill.amount_paid)
      if (remaining <= 0) break
      const toAllocate = Math.min(remaining, balance)
      if (toAllocate > 0) {
        newAllocations[bill.id] = toAllocate.toFixed(2)
        remaining -= toAllocate
      }
    }
    setAllocations(newAllocations)
  }

  function handleAmountChange(value: string) {
    setAmount(value)
    autoAllocate(value)
  }

  function totalAllocated() {
    return Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  }

  function resetForm() {
    setContactId('')
    setOutstandingBills([])
    setAllocations({})
    setPaymentDate(new Date().toISOString().split('T')[0])
    setAmount('')
    setPaymentMethod('bank_transfer')
    setReference('')
    setBankAccountId('')
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    if (!contactId) { setError('Select a supplier'); setSaving(false); return }
    if (!bankAccountId) { setError('Select a bank account'); setSaving(false); return }
    const enteredAmount = parseFloat(amount) || 0
    if (enteredAmount <= 0) { setError('Enter a payment amount'); setSaving(false); return }

    const allocated = totalAllocated()
    if (Math.abs(allocated - enteredAmount) > 0.01) {
      setError(`Allocated total (£${allocated.toFixed(2)}) must match payment amount (£${enteredAmount.toFixed(2)})`)
      setSaving(false)
      return
    }

    const allocationsPayload = Object.entries(allocations)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([bill_id, v]) => ({ bill_id, amount: parseFloat(v) }))

    if (allocationsPayload.length === 0) {
      setError('Allocate the payment to at least one bill')
      setSaving(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('record_purchase_payment', {
      p_client_id: clientId,
      p_contact_id: contactId,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference: reference || null,
      p_bank_account_id: bankAccountId,
      p_allocations: allocationsPayload,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSaving(false)
      return
    }

    setCreating(false)
    resetForm()
    fetchData()
    setSaving(false)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const allocated = totalAllocated()
  const entered = parseFloat(amount) || 0
  const isBalanced = Math.abs(allocated - entered) < 0.01 && entered > 0

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading payments...</p>
    </div>
  )

  if (contacts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No suppliers available</p>
      <p className="text-gray-400 text-xs">Add a supplier in Contacts first</p>
    </div>
  )

  if (bankAccounts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No bank accounts set up</p>
      <p className="text-gray-400 text-xs">Add a Bank-type account in Chart of Accounts first</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + Record Payment
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Record Payment</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
              <select value={contactId} onChange={(e) => handleContactChange(e.target.value)} className={inputClass}>
                <option value="">Select supplier</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment amount (£)</label>
              <input type="number" value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bank account</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputClass}>
                <option value="">Select account</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>

          {contactId && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                Allocate to outstanding bills {amount && '(auto-filled oldest first — adjust as needed)'}
              </p>
              {outstandingBills.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">No outstanding bills for this supplier</p>
              ) : (
                <div className="space-y-2">
                  {outstandingBills.map((bill) => {
                    const balance = parseFloat(bill.total) - parseFloat(bill.amount_paid)
                    return (
                      <div key={bill.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                        <div className="col-span-3 text-sm font-mono text-gray-600">{bill.bill_number || '(no ref)'}</div>
                        <div className="col-span-3 text-xs text-gray-400">Due {new Date(bill.due_date).toLocaleDateString('en-GB')}</div>
                        <div className="col-span-3 text-sm text-gray-500">Balance: £{balance.toFixed(2)}</div>
                        <input
                          type="number"
                          value={allocations[bill.id] || ''}
                          onChange={(e) => updateAllocation(bill.id, e.target.value)}
                          placeholder="0.00"
                          className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className={`rounded-xl p-4 flex justify-between items-center ${isBalanced ? 'bg-green-50' : 'bg-amber-50'}`}>
            <div className="text-sm">
              <span className="text-gray-500">Payment: </span>
              <span className="font-semibold text-brand-dark">£{entered.toFixed(2)}</span>
              <span className="text-gray-500 ml-4">Allocated: </span>
              <span className="font-semibold text-brand-dark">£{allocated.toFixed(2)}</span>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {isBalanced ? '✓ Matched' : 'Not matched'}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !isBalanced}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Record payment'}
            </button>
            <button onClick={() => { setCreating(false); resetForm() }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No payments recorded yet</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Supplier</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Reference</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-sm text-gray-500">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-3 text-sm font-medium text-brand-dark">{p.contacts?.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500 capitalize">{p.payment_method?.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{p.reference || '—'}</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(p.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
