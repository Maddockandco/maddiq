'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

export default function SalesInvoiceDetail({ clientId, invoiceId }: { clientId: string; invoiceId: string }) {
  const [invoice, setInvoice] = useState<any>(null)
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

  const { can } = useRole()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [invoiceId])

  async function fetchData() {
    setLoading(true)
    const { data: inv } = await supabase
      .from('sales_invoices')
      .select('*, contacts(name, email, phone, address_line1, address_line2, city, postcode, country)')
      .eq('id', invoiceId)
      .single()

    const { data: invLines } = await supabase
      .from('sales_invoice_lines')
      .select('*, chart_of_accounts(code, name)')
      .eq('invoice_id', invoiceId)
      .order('sort_order')

    const { data: allocations } = await supabase
      .from('sales_receipt_allocations')
      .select('amount_allocated, sales_receipts(id, receipt_date, payment_method, reference, voided)')
      .eq('invoice_id', invoiceId)

    const { data: replacement } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number')
      .eq('replaces_invoice_id', invoiceId)
      .maybeSingle()

    const { data: banks } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .eq('account_type', 'bank')
      .order('code')

    setInvoice(inv)
    if (inv?.source_extraction_id) {
      const { data: extraction } = await supabase.from('document_extractions').select('file_path').eq('id', inv.source_extraction_id).single()
      if (extraction) {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(extraction.file_path, 3600)
        if (signed) setSourceDocUrl(signed.signedUrl)
      }
    }
    setLines(invLines || [])
    setPayments(allocations || [])
    setReplacedBy(replacement)
    setBankAccounts(banks || [])
    setLoading(false)
  }

  async function handlePost() {
    setPosting(true)
    setPostError('')
    const { error } = await supabase.rpc('post_sales_invoice', { p_invoice_id: invoiceId })
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
    const { error } = await supabase.rpc('void_sales_invoice', { p_invoice_id: invoiceId, p_reason: voidReason.trim() })
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
    const balanceDue = parseFloat(invoice.total) - parseFloat(invoice.amount_paid)
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

    const { error } = await supabase.rpc('record_sales_receipt', {
      p_client_id: clientId,
      p_contact_id: invoice.contact_id,
      p_receipt_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference: paymentReference || null,
      p_bank_account_id: paymentBankAccountId,
      p_allocations: [{ invoice_id: invoiceId, amount: amt }],
    })

    if (error) {
      setPaymentError(error.message)
      setPaymentSaving(false)
      return
    }

    setShowPaymentForm(false)
    setPaymentSaving(false)
    fetchData()
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading invoice...</p>
    </div>
  )

  if (!invoice) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Invoice not found</p>
    </div>
  )

  const contact = invoice.contacts
  const balanceDue = parseFloat(invoice.total) - parseFloat(invoice.amount_paid)
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/sales-invoices`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to invoices
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
            <h2 className="text-xl font-bold text-brand-dark">{invoice.invoice_number}</h2>
            <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium capitalize mt-1 ${STATUS_STYLES[invoice.status]}`}>
              {invoice.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex gap-2">
            {can.manageEngagements && invoice.status === 'draft' && (
              <button onClick={handlePost} disabled={posting}
                className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                {posting ? 'Posting...' : 'Post to ledger'}
              </button>
            )}
            {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(invoice.status) && (
              <button onClick={openPaymentForm}
                className="bg-brand-gold text-brand-dark font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition">
                Record Payment
              </button>
            )}
            {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(invoice.status) && parseFloat(invoice.amount_paid) === 0 && (
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

        {invoice.replaces_invoice_id && (
          <div className="bg-brand-gold/10 text-brand-dark text-xs rounded-lg px-4 py-3 mb-4">
            This invoice is a correction — it replaces a previously voided invoice.
          </div>
        )}
        {replacedBy && (
          <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-4 py-3 mb-4">
            This invoice was voided and replaced by <button onClick={() => router.push(`/accounting/${clientId}/sales-invoices/${replacedBy.id}`)} className="underline font-medium">{replacedBy.invoice_number}</button>.
          </div>
        )}
        {invoice.status === 'void' && invoice.voided_reason && (
          <div className="bg-red-50 text-red-600 text-xs rounded-lg px-4 py-3 mb-4">
            Voided — reason: {invoice.voided_reason}
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
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Customer</p>
            <p className="text-sm font-medium text-brand-dark">{contact?.name}</p>
            {contact?.email && <p className="text-xs text-gray-500">{contact.email}</p>}
            {contact?.address_line1 && (
              <p className="text-xs text-gray-500 mt-1">
                {contact.address_line1}{contact.city ? `, ${contact.city}` : ''}{contact.postcode ? `, ${contact.postcode}` : ''}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Invoice date</p>
            <p className="text-sm text-brand-dark">{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-3 mb-1">Due date</p>
            <p className="text-sm text-brand-dark">{new Date(invoice.due_date).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-500">{invoice.notes || '—'}</p>
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
              <span className="text-brand-dark">£{parseFloat(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VAT</span>
              <span className="text-brand-dark">£{parseFloat(invoice.vat_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1">
              <span className="text-brand-dark">Total</span>
              <span className="text-brand-dark">£{parseFloat(invoice.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="text-green-700">£{parseFloat(invoice.amount_paid).toFixed(2)}</span>
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
          <p className="text-sm text-gray-400">No payments recorded against this invoice yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any, i: number) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg bg-gray-50 ${p.sales_receipts?.voided ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm text-brand-dark capitalize">
                    {p.sales_receipts?.payment_method?.replace(/_/g, ' ')}
                    {p.sales_receipts?.voided && <span className="text-red-600 text-xs font-medium ml-2">(Voided)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.sales_receipts?.receipt_date && new Date(p.sales_receipts.receipt_date).toLocaleDateString('en-GB')}
                    {p.sales_receipts?.reference && ` · ${p.sales_receipts.reference}`}
                  </p>
                </div>
                <p className="text-sm font-semibold text-brand-dark">£{parseFloat(p.amount_allocated).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
