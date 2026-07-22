'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import TransactionAuditTrail from '@/components/accounting/TransactionAuditTrail'
import ConfirmModal from '@/components/ui/ConfirmModal'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

export default function PurchaseBillDetail({ clientId, billId }: { clientId: string; billId: string }) {
  const [bill, setBill] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [replacedBy, setReplacedBy] = useState<any>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [sourceDocUrl, setSourceDocUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [voidError, setVoidError] = useState('')

  // Record payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Remove payment
  const [removingPayment, setRemovingPayment] = useState<any | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [removeError, setRemoveError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [otherBillsCount, setOtherBillsCount] = useState(0)
  const [removeBlocked, setRemoveBlocked] = useState(false)

  const { can } = useRole()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [billId])

  async function fetchData() {
    setLoading(true)
    const { data: b } = await supabase
      .from('purchase_bills')
      .select('*, contacts(name, email, phone, address_line1, address_line2, city, postcode, country)')
      .eq('id', billId)
      .single()

    const { data: billLines } = await supabase
      .from('purchase_bill_lines')
      .select('*, chart_of_accounts(code, name)')
      .eq('bill_id', billId)
      .order('sort_order')

    const { data: allocations } = await supabase
      .from('purchase_payment_allocations')
      .select('amount_allocated, purchase_payments(id, payment_date, payment_method, reference, voided)')
      .eq('bill_id', billId)

    const { data: replacement } = await supabase
      .from('purchase_bills')
      .select('id, bill_number')
      .eq('replaces_bill_id', billId)
      .maybeSingle()

    const { data: banks } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .eq('account_type', 'bank')
      .order('code')

    setBill(b)
    if (b?.source_extraction_id) {
      const { data: extraction } = await supabase.from('document_extractions').select('file_path').eq('id', b.source_extraction_id).single()
      if (extraction) {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(extraction.file_path, 3600)
        if (signed) setSourceDocUrl(signed.signedUrl)
      }
    }
    setLines(billLines || [])
    setPayments(allocations || [])
    setReplacedBy(replacement)
    setBankAccounts(banks || [])
    setLoading(false)
  }

  async function handlePost() {
    setPosting(true)
    setPostError('')
    const { error } = await supabase.rpc('post_purchase_bill', { p_bill_id: billId })
    if (error) {
      setPostError(error.message)
      setPosting(false)
      return
    }
    setPosting(false)
    fetchData()
  }

  async function handleVoid() {
    if (!voidReason.trim()) {
      setVoidError('A reason is required')
      return
    }
    setVoiding(true)
    setVoidError('')
    const { error } = await supabase.rpc('void_purchase_bill', { p_bill_id: billId, p_reason: voidReason.trim() })
    if (error) {
      setVoidError(error.message)
      setVoiding(false)
      return
    }
    setVoiding(false)
    setShowVoidForm(false)
    fetchData()
  }

  function openPaymentForm() {
    const balanceDue = parseFloat(bill.total) - parseFloat(bill.amount_paid)
    setPaymentAmount(balanceDue.toFixed(2))
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('bank_transfer')
    setPaymentReference('')
    setPaymentBankAccountId('')
    setPaymentError('')
    setShowPaymentForm(true)
  }

  async function handleRecordPayment() {
    setPaymentSaving(true)
    setPaymentError('')

    const amt = parseFloat(paymentAmount) || 0
    if (amt <= 0) { setPaymentError('Enter a payment amount'); setPaymentSaving(false); return }
    if (!paymentBankAccountId) { setPaymentError('Select a bank account'); setPaymentSaving(false); return }

    const { error } = await supabase.rpc('record_purchase_payment', {
      p_client_id: clientId,
      p_contact_id: bill.contact_id,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference: paymentReference || null,
      p_bank_account_id: paymentBankAccountId,
      p_allocations: [{ bill_id: billId, amount: amt }],
    })

    if (error) {
      setPaymentError(error.message)
      setPaymentSaving(false)
      return
    }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'purchase_bill',
      p_entity_id: billId,
      p_action: 'payment_recorded',
      p_old_data: null,
      p_new_data: { amount: amt, payment_method: paymentMethod, payment_date: paymentDate, reference: paymentReference || null },
      p_description: `Payment of £${amt.toFixed(2)} recorded (${paymentMethod.replace(/_/g, ' ')}${paymentReference ? `, ref ${paymentReference}` : ''})`,
    })

    setShowPaymentForm(false)
    setPaymentSaving(false)
    fetchData()
  }

  async function openRemovePayment(p: any) {
    setRemoveError('')
    setRemoveReason('')
    setOtherBillsCount(0)
    setRemoveBlocked(false)

    const paymentDate = p.purchase_payments?.payment_date
    const paymentId = p.purchase_payments?.id

    // Cash Accounting is the only scheme where a payment's date directly
    // drives a filed VAT return's figures - Standard/Flat Rate use bill
    // dates instead, so removing a payment never touches those.
    const { data: settings } = await supabase.from('vat_settings').select('scheme').eq('client_id', clientId).maybeSingle()
    if (settings?.scheme === 'cash_accounting' && paymentDate) {
      const { data: filedReturn } = await supabase
        .from('vat_returns')
        .select('id, period_start, period_end')
        .eq('client_id', clientId)
        .eq('status', 'filed')
        .lte('period_start', paymentDate)
        .gte('period_end', paymentDate)
        .maybeSingle()

      if (filedReturn) {
        setRemoveError(`This payment (${new Date(paymentDate).toLocaleDateString('en-GB')}) falls inside a VAT period already filed with HMRC (${new Date(filedReturn.period_start).toLocaleDateString('en-GB')} – ${new Date(filedReturn.period_end).toLocaleDateString('en-GB')}). Removing it would silently change a filed return's figures - log a correction in Error Corrections instead.`)
        setRemoveBlocked(true)
        setRemovingPayment(p)
        return
      }
    }

    if (paymentId) {
      const { count } = await supabase
        .from('purchase_payment_allocations')
        .select('id', { count: 'exact', head: true })
        .eq('payment_id', paymentId)
        .neq('bill_id', billId)
      setOtherBillsCount(count || 0)
    }

    setRemovingPayment(p)
  }

  async function handleRemovePayment() {
    if (!removingPayment || !removeReason.trim()) {
      setRemoveError('A reason is required')
      return
    }
    setRemoving(true)

    const { error: voidErr } = await supabase.rpc('void_purchase_payment', {
      p_payment_id: removingPayment.purchase_payments.id,
      p_reason: removeReason.trim(),
    })

    if (voidErr) {
      setRemoveError(voidErr.message)
      setRemoving(false)
      return
    }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'purchase_bill',
      p_entity_id: billId,
      p_action: 'payment_voided',
      p_old_data: { amount: removingPayment.amount_allocated },
      p_new_data: null,
      p_description: `Payment of £${parseFloat(removingPayment.amount_allocated).toFixed(2)} removed — reason: ${removeReason.trim()}`,
    })

    setRemovingPayment(null)
    setRemoving(false)
    fetchData()
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading bill...</p>
    </div>
  )

  if (!bill) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Bill not found</p>
    </div>
  )

  const contact = bill.contacts
  const balanceDue = parseFloat(bill.total) - parseFloat(bill.amount_paid)
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/purchase-bills`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to bills
      </button>

      {sourceDocUrl && (
        <a
          href={sourceDocUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-brand-gold/20 text-brand-dark text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-gold/30 transition"
        >
          📎 View original captured document
        </a>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">{bill.bill_number || 'Bill'}</h2>
            <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium capitalize mt-1 ${STATUS_STYLES[bill.status]}`}>
              {bill.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex gap-2">
            {can.manageEngagements && bill.status === 'draft' && (
              <button onClick={handlePost} disabled={posting}
                className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                {posting ? 'Approving...' : 'Approve'}
              </button>
            )}
            {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(bill.status) && (
              <button onClick={openPaymentForm}
                className="bg-brand-gold text-brand-dark font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition">
                Record Payment
              </button>
            )}
            {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(bill.status) && parseFloat(bill.amount_paid) === 0 && (
              <button onClick={() => setShowVoidForm(!showVoidForm)}
                className="bg-red-50 text-red-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition">
                Void
              </button>
            )}
          </div>
        </div>

        {postError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{postError}</div>}

        {showPaymentForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-brand-dark">Record Payment — balance due £{balanceDue.toFixed(2)}</p>
            {paymentError && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{paymentError}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (£)</label>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date paid</label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bank account</label>
                <select value={paymentBankAccountId} onChange={(e) => setPaymentBankAccountId(e.target.value)} className={inputClass}>
                  <option value="">Select account</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference (optional)</label>
              <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={`${inputClass} max-w-xs`} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRecordPayment} disabled={paymentSaving}
                className="bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50">
                {paymentSaving ? 'Recording...' : 'Confirm payment'}
              </button>
              <button onClick={() => setShowPaymentForm(false)} className="text-sm text-gray-500 hover:underline px-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {bill.replaces_bill_id && (
          <div className="bg-brand-gold/10 text-brand-dark text-xs rounded-lg px-4 py-3 mb-4">
            This bill is a correction — it replaces a previously voided bill.
          </div>
        )}
        {replacedBy && (
          <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-4 py-3 mb-4">
            This bill was voided and replaced by <button onClick={() => router.push(`/accounting/${clientId}/purchase-bills/${replacedBy.id}`)} className="underline font-medium">{replacedBy.bill_number || 'a newer bill'}</button>.
          </div>
        )}
        {bill.status === 'void' && bill.voided_reason && (
          <div className="bg-red-50 text-red-600 text-xs rounded-lg px-4 py-3 mb-4">
            Voided — reason: {bill.voided_reason}
          </div>
        )}

        {showVoidForm && (
          <div className="bg-red-50 rounded-lg p-4 mb-4 space-y-2">
            {voidError && <p className="text-red-600 text-xs">{voidError}</p>}
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <button onClick={handleVoid} disabled={voiding} className="bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                {voiding ? 'Voiding...' : 'Confirm void'}
              </button>
              <button onClick={() => setShowVoidForm(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Supplier</p>
            <p className="text-sm font-medium text-brand-dark">{contact?.name}</p>
            {contact?.email && <p className="text-xs text-gray-500">{contact.email}</p>}
            {contact?.address_line1 && (
              <p className="text-xs text-gray-500 mt-1">
                {contact.address_line1}{contact.city ? `, ${contact.city}` : ''}{contact.postcode ? `, ${contact.postcode}` : ''}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bill date</p>
            <p className="text-sm text-brand-dark">{new Date(bill.bill_date).toLocaleDateString('en-GB')}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-3 mb-1">Due date</p>
            <p className="text-sm text-brand-dark">{new Date(bill.due_date).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-500">{bill.notes || '—'}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="text-left pb-2">Description</th>
              <th className="text-left pb-2">Account</th>
              <th className="text-right pb-2">Qty</th>
              <th className="text-right pb-2">Unit price</th>
              <th className="text-right pb-2">VAT</th>
              <th className="text-right pb-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-50">
                <td className="py-2.5 text-sm text-brand-dark">{line.description}</td>
                <td className="py-2.5 text-sm text-gray-500">{line.chart_of_accounts?.code} — {line.chart_of_accounts?.name}</td>
                <td className="py-2.5 text-sm text-right text-gray-500">{line.quantity}</td>
                <td className="py-2.5 text-sm text-right text-gray-500">£{parseFloat(line.unit_price).toFixed(2)}</td>
                <td className="py-2.5 text-sm text-right text-gray-500">£{parseFloat(line.vat_amount).toFixed(2)}</td>
                <td className="py-2.5 text-sm text-right font-medium text-brand-dark">£{parseFloat(line.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-brand-dark">£{parseFloat(bill.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VAT</span>
              <span className="text-brand-dark">£{parseFloat(bill.vat_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1">
              <span className="text-brand-dark">Total</span>
              <span className="text-brand-dark">£{parseFloat(bill.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="text-green-700">£{parseFloat(bill.amount_paid).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-brand-dark">Balance due</span>
              <span className="text-brand-dark">£{balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Payment History</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded against this bill yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any, i: number) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg bg-gray-50 ${p.purchase_payments?.voided ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm text-brand-dark capitalize">
                    {p.purchase_payments?.payment_method?.replace(/_/g, ' ')}
                    {p.purchase_payments?.voided && <span className="text-red-600 text-xs font-medium ml-2">(Voided)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.purchase_payments?.payment_date && new Date(p.purchase_payments.payment_date).toLocaleDateString('en-GB')}
                    {p.purchase_payments?.reference && ` · ${p.purchase_payments.reference}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-brand-dark">£{parseFloat(p.amount_allocated).toFixed(2)}</p>
                  {!p.purchase_payments?.voided && can.manageEngagements && (
                    <button onClick={() => openRemovePayment(p)} className="text-xs text-red-500 font-medium hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <TransactionAuditTrail entityType="purchase_bill" entityId={billId} />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!removingPayment}
        title={removeBlocked ? "Can't remove this payment" : 'Remove this payment?'}
        message={
          removeBlocked
            ? removeError
            : `This reverses the payment and reopens the bill for that amount.${otherBillsCount > 0 ? ` This payment also covers ${otherBillsCount} other bill(s) — removing it will reverse the payment from all of them, not just this one.` : ''}`
        }
        confirmLabel={removeBlocked ? 'OK' : removing ? 'Removing...' : 'Remove Payment'}
        confirming={removing}
        danger={!removeBlocked}
        requireInput={!removeBlocked}
        inputLabel="Reason for removing"
        inputValue={removeReason}
        onInputChange={setRemoveReason}
        inputPlaceholder="e.g. Payment recorded against the wrong bill"
        inputError={!removeBlocked ? removeError : undefined}
        onConfirm={removeBlocked ? () => setRemovingPayment(null) : handleRemovePayment}
        onCancel={() => setRemovingPayment(null)}
      />
    </div>
  )
}
