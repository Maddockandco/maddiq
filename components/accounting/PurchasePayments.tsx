'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'

export default function SalesReceipts({ clientId }: { clientId: string }) {
  const [receipts, setReceipts] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [contactId, setContactId] = useState('')
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([])
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState<Record<string, string>>({})

  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const [receiptsRes, contactsRes, accountsRes] = await Promise.all([
      supabase.from('sales_receipts').select('*, contacts(name)').eq('client_id', clientId).order('receipt_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_customer', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name').eq('client_id', clientId).eq('is_active', true).eq('account_type', 'bank').order('code'),
    ])
    if (receiptsRes.data) setReceipts(receiptsRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    if (accountsRes.data) setBankAccounts(accountsRes.data)
    setLoading(false)
  }

  async function handleContactChange(id: string) {
    setContactId(id)
    setAllocations({})
    setAmount('')
    if (!id) { setOutstandingInvoices([]); return }

    const { data } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('client_id', clientId)
      .eq('contact_id', id)
      .in('status', ['awaiting_payment', 'partially_paid'])
      .order('due_date', { ascending: true })

    setOutstandingInvoices(data || [])
  }

  function updateAllocation(invoiceId: string, value: string) {
    setAllocations({ ...allocations, [invoiceId]: value })
  }

  function autoAllocate(totalAmount: string) {
    let remaining = parseFloat(totalAmount) || 0
    const newAllocations: Record<string, string> = {}
    for (const inv of outstandingInvoices) {
      const balance = parseFloat(inv.total) - parseFloat(inv.amount_paid)
      if (remaining <= 0) break
      const toAllocate = Math.min(remaining, balance)
      if (toAllocate > 0) {
        newAllocations[inv.id] = toAllocate.toFixed(2)
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
    setOutstandingInvoices([])
    setAllocations({})
    setReceiptDate(new Date().toISOString().split('T')[0])
    setAmount('')
    setPaymentMethod('bank_transfer')
    setReference('')
    setBankAccountId('')
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    if (!contactId) { setError('Select a customer'); setSaving(false); return }
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
      .map(([invoice_id, v]) => ({ invoice_id, amount: parseFloat(v) }))

    if (allocationsPayload.length === 0) {
      setError('Allocate the payment to at least one invoice')
      setSaving(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('record_sales_receipt', {
      p_client_id: clientId,
      p_contact_id: contactId,
      p_receipt_date: receiptDate,
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

  function openVoid(receiptId: string) {
    setVoidReason('')
    setVoidError((prev) => ({ ...prev, [receiptId]: '' }))
    setVoidingId(receiptId)
  }

  async function handleVoid(receiptId: string) {
    if (!voidReason.trim()) {
      setVoidError((prev) => ({ ...prev, [receiptId]: 'A reason is required' }))
      return
    }
    setVoiding(true)
    setVoidError((prev) => ({ ...prev, [receiptId]: '' }))

    const { error: voidErr } = await supabase.rpc('void_sales_receipt', {
      p_receipt_id: receiptId,
      p_reason: voidReason.trim(),
    })

    if (voidErr) {
      setVoidError((prev) => ({ ...prev, [receiptId]: voidErr.message }))
      setVoiding(false)
      return
    }

    setVoidingId(null)
    setVoiding(false)
    fetchData()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const allocated = totalAllocated()
  const entered = parseFloat(amount) || 0
  const isBalanced = Math.abs(allocated - entered) < 0.01 && entered > 0

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading receipts...</p>
    </div>
  )

  if (contacts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No customers available</p>
      <p className="text-gray-400 text-xs">Add a customer in Contacts first</p>
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
            + Record Receipt
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Record Receipt</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
              <select value={contactId} onChange={(e) => handleContactChange(e.target.value)} className={inputClass}>
                <option value="">Select customer</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Receipt date</label>
              <DatePicker value={receiptDate} onChange={setReceiptDate} className="w-full" />
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
                Allocate to outstanding invoices {amount && '(auto-filled oldest first — adjust as needed)'}
              </p>
              {outstandingInvoices.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">No outstanding invoices for this customer</p>
              ) : (
                <div className="space-y-2">
                  {outstandingInvoices.map((inv) => {
                    const balance = parseFloat(inv.total) - parseFloat(inv.amount_paid)
                    return (
                      <div key={inv.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                        <div className="col-span-3 text-sm font-mono text-gray-600">{inv.invoice_number}</div>
                        <div className="col-span-3 text-xs text-gray-400">Due {new Date(inv.due_date).toLocaleDateString('en-GB')}</div>
                        <div className="col-span-3 text-sm text-gray-500">Balance: £{balance.toFixed(2)}</div>
                        <input
                          type="number"
                          value={allocations[inv.id] || ''}
                          onChange={(e) => updateAllocation(inv.id, e.target.value)}
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
              {saving ? 'Saving...' : 'Record receipt'}
            </button>
            <button onClick={() => { setCreating(false); resetForm() }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {receipts.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No receipts recorded yet</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Reference</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <>
                  <tr key={r.id} className={`border-b border-gray-100 ${r.voided ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(r.receipt_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{r.contacts?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 capitalize">{r.payment_method?.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{r.reference || '—'}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(r.amount).toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      {r.voided ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">Voided</span>
                      ) : can.manageEngagements ? (
                        <button onClick={() => openVoid(r.id)} className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                          Void
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {r.voided && r.voided_reason && (
                    <tr>
                      <td colSpan={6} className="px-6 pb-2 text-xs text-gray-400">Voided: {r.voided_reason}</td>
                    </tr>
                  )}
                  {voidingId === r.id && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="flex items-end gap-4 flex-wrap">
                          <div className="flex-1 min-w-[240px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Reason for voiding</label>
                            <input
                              type="text"
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                              placeholder="e.g. Recorded against wrong invoice"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                            {voidError[r.id] && <p className="text-red-600 text-xs mt-1">{voidError[r.id]}</p>}
                          </div>
                          <button
                            onClick={() => handleVoid(r.id)}
                            disabled={voiding}
                            className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                          >
                            {voiding ? 'Voiding...' : 'Confirm void'}
                          </button>
                          <button onClick={() => setVoidingId(null)} className="text-sm text-gray-500 hover:underline">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
