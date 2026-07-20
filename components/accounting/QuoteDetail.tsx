'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  expired: 'bg-orange-100 text-orange-600',
  converted: 'bg-brand-gold/20 text-brand-dark',
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function QuoteDetail({ clientId, quoteId }: { clientId: string; quoteId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const { can } = useRole()

  const [quote, setQuote] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [convertOpen, setConvertOpen] = useState(false)
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  useEffect(() => { fetchData() }, [quoteId])

  async function fetchData() {
    setLoading(true)
    const [quoteRes, linesRes] = await Promise.all([
      supabase.from('sales_quotes').select('*, contacts(name, payment_terms_days)').eq('id', quoteId).single(),
      supabase.from('sales_quote_lines').select('*, chart_of_accounts(code, name), projects(name)').eq('quote_id', quoteId).order('sort_order'),
    ])
    setQuote(quoteRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }

  async function handleMarkSent() {
    await supabase.from('sales_quotes').update({ status: 'sent' }).eq('id', quoteId)
    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'sales_quote',
      p_entity_id: quoteId,
      p_action: 'sent',
      p_old_data: { status: 'draft' },
      p_new_data: { status: 'sent' },
      p_description: `Marked quote "${quote.quote_number}" as sent to customer`,
    })
    fetchData()
  }

  function openConvert() {
    const todayStr = new Date().toISOString().split('T')[0]
    setOrderDate(todayStr)
    setExpectedDate(addDays(todayStr, 14))
    setConvertError('')
    setConvertOpen(true)
  }

  async function handleConvert() {
    setConverting(true)
    setConvertError('')
    const { data: newOrderId, error: convertErr } = await supabase.rpc('convert_quote_to_sales_order', {
      p_quote_id: quoteId,
      p_order_date: orderDate,
      p_expected_date: expectedDate || null,
    })
    if (convertErr) { setConvertError(convertErr.message); setConverting(false); return }
    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'sales_quote',
      p_entity_id: quoteId,
      p_action: 'converted_to_sales_order',
      p_description: `Converted "${quote.quote_number}" to a sales order`,
    })
    setConverting(false)
    if (newOrderId) router.push(`/accounting/${clientId}/sales-orders/${newOrderId}`)
    else fetchData()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.line_total), 0)
  const vatTotal = lines.reduce((sum, l) => sum + parseFloat(l.vat_amount), 0)
  const total = subtotal + vatTotal

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading quote...</p>
    </div>
  )

  if (!quote) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Quote not found</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <button onClick={() => router.push(`/accounting/${clientId}/sales-quotes`)} className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1">
        ← Back to Quotes
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Quote</p>
            <h1 className="text-2xl font-bold text-brand-dark">{quote.quote_number}</h1>
            <p className="text-sm text-gray-500 mt-1">{quote.contacts?.name}</p>
          </div>
          <span className={`text-sm px-3 py-1.5 rounded-full font-medium capitalize ${STATUS_STYLES[quote.status]}`}>{quote.status}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Quote Date</p>
            <p className="text-brand-dark font-medium">{new Date(quote.quote_date).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Expiry Date</p>
            <p className="text-brand-dark font-medium">{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString('en-GB') : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
            <p className="text-brand-dark font-medium">£{total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Responded</p>
            <p className="text-brand-dark font-medium">{quote.responded_at ? new Date(quote.responded_at).toLocaleDateString('en-GB') : '—'}</p>
          </div>
        </div>

        {quote.status === 'sent' && (
          <div className="bg-brand-light rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Customer link</p>
            <p className="text-sm font-mono text-brand-dark break-all">{typeof window !== 'undefined' ? `${window.location.origin}/sales-quotes/${quote.accept_token}` : ''}</p>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Account</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Project</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-brand-dark">{l.description}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{l.quantity}</td>
                    <td className="px-4 py-2 text-gray-500">{l.chart_of_accounts ? `${l.chart_of_accounts.code} — ${l.chart_of_accounts.name}` : '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{l.projects?.name || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-brand-dark">£{(parseFloat(l.line_total) + parseFloat(l.vat_amount)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <div className="w-48 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-brand-dark">£{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="text-brand-dark">£{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span className="text-brand-dark">Total</span><span className="text-brand-dark">£{total.toFixed(2)}</span></div>
          </div>
        </div>

        {quote.notes && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-600">{quote.notes}</p>
          </div>
        )}

        {can.manageEngagements && !convertOpen && (
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {['draft', 'sent'].includes(quote.status) && (
              <button onClick={() => router.push(`/accounting/${clientId}/sales-quotes?edit=${quoteId}`)} className="bg-gray-100 text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                Edit
              </button>
            )}
            {quote.status === 'draft' && (
              <button onClick={handleMarkSent} className="bg-blue-100 text-blue-700 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-200 transition">
                Mark as Sent
              </button>
            )}
            {quote.status === 'accepted' && (
              <button onClick={openConvert} className="bg-brand-gold text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
                Convert to Sales Order
              </button>
            )}
          </div>
        )}

        {convertOpen && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {convertError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{convertError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order date</label>
                <DatePicker value={orderDate} onChange={setOrderDate} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Expected date</label>
                <DatePicker value={expectedDate} onChange={setExpectedDate} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleConvert} disabled={converting} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                {converting ? 'Converting...' : 'Confirm Conversion'}
              </button>
              <button onClick={() => setConvertOpen(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
