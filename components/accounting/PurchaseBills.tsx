'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'

type LineDraft = {
  description: string
  quantity: string
  unit_price: string
  expense_account_id: string
  vat_rate_id: string
}

const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unit_price: '', expense_account_id: '', vat_rate_id: '' }

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function PurchaseBills({ clientId }: { clientId: string }) {
  const [bills, setBills] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [postError, setPostError] = useState<Record<string, string>>({})

  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')

  const [creating, setCreating] = useState(false)
  const [replacesBillId, setReplacesBillId] = useState<string | null>(null)
  const [contactId, setContactId] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { can } = useRole()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const [billsRes, contactsRes, accountsRes, vatRes] = await Promise.all([
      supabase.from('purchase_bills').select('*, contacts(name)').eq('client_id', clientId).order('bill_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_supplier', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name, account_type, parent_id').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('type', 'purchases').order('rate', { ascending: true }),
    ])
    if (billsRes.data) setBills(billsRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    if (accountsRes.data) {
      const parentIds = new Set(accountsRes.data.map((a) => a.parent_id).filter(Boolean))
      setAccounts(accountsRes.data.filter((a) => ['direct_costs', 'expense', 'overhead'].includes(a.account_type) && !parentIds.has(a.id)))
    }
    if (vatRes.data) setVatRates(vatRes.data)
    setLoading(false)
  }

  function addLine() {
    setLines([...lines, { ...EMPTY_LINE }])
  }

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  function lineAmounts(line: LineDraft) {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unit_price) || 0
    const net = qty * price
    const rate = vatRates.find((r) => r.id === line.vat_rate_id)
    const vatAmount = rate ? net * (parseFloat(rate.rate) / 100) : 0
    return { net, vatAmount, gross: net + vatAmount }
  }

  function calculateTotals() {
    let subtotal = 0
    let vatTotal = 0
    lines.forEach((l) => {
      const { net, vatAmount } = lineAmounts(l)
      subtotal += net
      vatTotal += vatAmount
    })
    return { subtotal, vatTotal, total: subtotal + vatTotal }
  }

  function resetForm() {
    setContactId('')
    setBillNumber('')
    setBillDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setNotes('')
    setLines([{ ...EMPTY_LINE }])
    setError('')
    setReplacesBillId(null)
  }

  function handleContactChange(id: string) {
    setContactId(id)
    const contact = contacts.find((c) => c.id === id)
    const terms = contact?.payment_terms_days ?? 30
    setDueDate(addDays(billDate, terms))
  }

  function openCorrectedBill(voidedBill: any) {
    resetForm()
    setContactId(voidedBill.contact_id)
    const terms = contacts.find((c) => c.id === voidedBill.contact_id)?.payment_terms_days ?? 30
    const todayStr = new Date().toISOString().split('T')[0]
    setBillDate(todayStr)
    setDueDate(addDays(todayStr, terms))
    setReplacesBillId(voidedBill.id)
    setCreating(true)
  }

  async function handleCreate() {
    setSaving(true)
    setError('')

    if (!contactId) { setError('Select a supplier'); setSaving(false); return }
    if (!dueDate) { setError('Due date is required'); setSaving(false); return }
    const validLines = lines.filter((l) => l.description && parseFloat(l.unit_price) > 0)
    if (validLines.length === 0) { setError('At least one line with a description and price is required'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { subtotal, vatTotal, total } = calculateTotals()

    const { data: bill, error: billError } = await supabase
      .from('purchase_bills')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        contact_id: contactId,
        bill_number: billNumber || null,
        bill_date: billDate,
        due_date: dueDate,
        status: 'draft',
        subtotal,
        vat_total: vatTotal,
        total,
        notes: notes || null,
        created_by: user!.id,
        replaces_bill_id: replacesBillId,
      })
      .select()
      .single()

    if (billError) { setError(billError.message); setSaving(false); return }

    const linesToInsert = validLines.map((l, i) => {
      const { net, vatAmount } = lineAmounts(l)
      return {
        bill_id: bill.id,
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        expense_account_id: l.expense_account_id || null,
        vat_rate_id: l.vat_rate_id || null,
        vat_amount: vatAmount,
        line_total: net,
        sort_order: i,
      }
    })

    const { error: linesError } = await supabase.from('purchase_bill_lines').insert(linesToInsert)
    if (linesError) { setError(linesError.message); setSaving(false); return }

    setCreating(false)
    resetForm()
    fetchData()
    setSaving(false)
  }

  async function handlePost(billId: string) {
    setPostingId(billId)
    setPostError((prev) => ({ ...prev, [billId]: '' }))

    const { error: postErr } = await supabase.rpc('post_purchase_bill', { p_bill_id: billId })

    if (postErr) {
      setPostError((prev) => ({ ...prev, [billId]: postErr.message }))
      setPostingId(null)
      return
    }

    setPostingId(null)
    fetchData()
  }

  function openVoid(billId: string) {
    setVoidReason('')
    setVoidError('')
    setVoidingId(billId)
  }

  async function handleVoid() {
    if (!voidingId) return
    if (!voidReason.trim()) {
      setVoidError('A reason is required')
      return
    }
    setVoiding(true)
    setVoidError('')

    const { error: voidErr } = await supabase.rpc('void_purchase_bill', {
      p_bill_id: voidingId,
      p_reason: voidReason.trim(),
    })

    if (voidErr) {
      setVoidError(voidErr.message)
      setVoiding(false)
      return
    }

    setVoidingId(null)
    setVoiding(false)
    fetchData()
  }

  const { subtotal, vatTotal, total } = calculateTotals()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading purchase bills...</p>
    </div>
  )

  if (contacts.length === 0 && !creating) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No suppliers available</p>
      <p className="text-gray-400 text-xs">Add a supplier in Contacts first before creating bills</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => { resetForm(); setCreating(true) }}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Bill
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
            {replacesBillId ? 'Corrected Bill' : 'New Purchase Bill'}
          </h3>
          <p className="text-xs text-gray-400 -mt-2">
            {replacesBillId
              ? 'This will be linked as a correction to the voided bill'
              : "Creating directly — this won't be linked to a Purchase Order"}
          </p>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier's bill/invoice number</label>
              <input type="text" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="Their reference" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bill date</label>
              <DatePicker value={billDate} onChange={setBillDate} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
              <DatePicker value={dueDate} onChange={setDueDate} className="w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit price (£)</div>
              <div className="col-span-2">Expense account</div>
              <div className="col-span-2">VAT rate</div>
              <div className="col-span-1"></div>
            </div>
            {lines.map((line, index) => {
              const { net, vatAmount } = lineAmounts(line)
              return (
                <div key={index}>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      placeholder="Item or service"
                      className="col-span-4 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      className="col-span-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <select
                      value={line.expense_account_id}
                      onChange={(e) => updateLine(index, 'expense_account_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">Account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <select
                      value={line.vat_rate_id}
                      onChange={(e) => updateLine(index, 'vat_rate_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">No VAT</option>
                      {vatRates.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                    </select>
                    <button
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="col-span-1 text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {(net > 0) && (
                    <p className="text-xs text-gray-400 pl-1 mt-0.5">
                      Net £{net.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = £{(net + vatAmount).toFixed(2)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <button onClick={addLine} className="text-xs text-brand-dark font-medium hover:underline">
            + Add line
          </button>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="bg-gray-50 rounded-xl p-4 flex justify-end gap-6 text-sm">
            <div><span className="text-gray-500">Subtotal: </span><span className="font-semibold text-brand-dark">£{subtotal.toFixed(2)}</span></div>
            <div><span className="text-gray-500">VAT: </span><span className="font-semibold text-brand-dark">£{vatTotal.toFixed(2)}</span></div>
            <div><span className="text-gray-500">Total: </span><span className="font-semibold text-brand-dark">£{total.toFixed(2)}</span></div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save as draft'}
            </button>
            <button onClick={() => { setCreating(false); resetForm() }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {bills.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No bills yet</p>
          <p className="text-gray-400 text-xs">Create one directly, or convert an accepted Purchase Order</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Bill #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Supplier</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Bill date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Due date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Paid</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <>
                  <tr key={bill.id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">
                      <button
                        onClick={() => router.push(`/accounting/${clientId}/purchase-bills/${bill.id}`)}
                        className="text-brand-dark hover:underline font-semibold"
                      >
                        {bill.bill_number || 'View bill'}
                      </button>
                      {bill.replaces_bill_id && <span className="block text-xs text-gray-400">corrects a voided bill</span>}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{bill.contacts?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(bill.bill_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(bill.due_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(bill.total).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">£{parseFloat(bill.amount_paid).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[bill.status]}`}>
                        {bill.status.replace(/_/g, ' ')}
                      </span>
                      {bill.status === 'void' && bill.voided_reason && (
                        <span className="block text-xs text-gray-400 mt-0.5">{bill.voided_reason}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                      {can.manageEngagements && bill.status === 'draft' && (
                        <button
                          onClick={() => handlePost(bill.id)}
                          disabled={postingId === bill.id}
                          className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                        >
                          {postingId === bill.id ? 'Posting...' : 'Post to ledger'}
                        </button>
                      )}
                      {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(bill.status) && parseFloat(bill.amount_paid) === 0 && (
                        <button
                          onClick={() => openVoid(bill.id)}
                          className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
                        >
                          Void
                        </button>
                      )}
                      {can.manageEngagements && bill.status === 'void' && (
                        <button
                          onClick={() => openCorrectedBill(bill)}
                          className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition"
                        >
                          Create corrected bill
                        </button>
                      )}
                      {bill.journal_entry_id && !['draft', 'void'].includes(bill.status) && (
                        <span className="text-xs text-gray-400">Posted ✓</span>
                      )}
                    </td>
                  </tr>
                  {postError[bill.id] && (
                    <tr>
                      <td colSpan={8} className="px-6 py-3 bg-red-50">
                        <p className="text-red-600 text-xs">{postError[bill.id]}</p>
                        {postError[bill.id].includes('Control accounts') && (
                          <p className="text-red-500 text-xs mt-1">
                            Go to the Accounting → Settings tab and map all six control accounts before posting bills.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={!!voidingId}
        title="Void this bill?"
        message="This creates a reversing journal entry. The bill record stays visible with its void reason, and can be corrected by creating a replacement."
        confirmLabel="Void bill"
        cancelLabel="Cancel"
        confirming={voiding}
        danger
        requireInput
        inputLabel="Reason for voiding"
        inputValue={voidReason}
        onInputChange={setVoidReason}
        inputPlaceholder="e.g. Incorrect amount, wrong supplier"
        inputError={voidError}
        onConfirm={handleVoid}
        onCancel={() => setVoidingId(null)}
      />
    </div>
  )
}
