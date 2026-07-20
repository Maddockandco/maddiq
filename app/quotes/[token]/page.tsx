'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function QuoteResponsePage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const [quote, setQuote] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')
  const [responded, setResponded] = useState<string | null>(null)

  useEffect(() => { fetchQuote() }, [params.token])

  async function fetchQuote() {
    setLoading(true)
    const { data: quoteData } = await supabase
      .from('sales_quotes')
      .select('*, contacts(name)')
      .eq('accept_token', params.token)
      .maybeSingle()

    if (!quoteData) { setLoading(false); return }
    setQuote(quoteData)
    setResponded(quoteData.status !== 'sent' ? quoteData.status : null)

    const [linesRes, clientRes] = await Promise.all([
      supabase.from('sales_quote_lines').select('*').eq('quote_id', quoteData.id).order('sort_order'),
      supabase.from('clients').select('name').eq('id', quoteData.client_id).single(),
    ])
    setLines(linesRes.data || [])
    setClient(clientRes.data)
    setLoading(false)
  }

  async function handleRespond(response: 'accepted' | 'declined') {
    setResponding(true)
    setError('')
    const { error: respondError } = await supabase.rpc('respond_to_quote', { p_token: params.token, p_response: response })
    if (respondError) { setError(respondError.message); setResponding(false); return }
    setResponded(response)
    setResponding(false)
  }

  const total = lines.reduce((sum, l) => sum + parseFloat(l.line_total) + parseFloat(l.vat_amount), 0)
  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.line_total), 0)
  const vatTotal = lines.reduce((sum, l) => sum + parseFloat(l.vat_amount), 0)

  if (loading) return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading quote...</p>
    </div>
  )

  if (!quote) return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
        <p className="text-gray-500 text-sm">This quote link isn't valid, or has expired.</p>
      </div>
    </div>
  )

  const isExpired = quote.expiry_date && new Date(quote.expiry_date) < new Date() && !responded

  return (
    <div className="min-h-screen bg-brand-light py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-brand-dark px-8 py-6">
          <p className="text-white/60 text-xs uppercase tracking-wider">Quote from {client?.name}</p>
          <h1 className="text-white text-2xl font-bold mt-1">{quote.quote_number}</h1>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-400 text-xs">To</p>
              <p className="text-brand-dark font-medium">{quote.contacts?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Quote Date</p>
              <p className="text-brand-dark font-medium">{new Date(quote.quote_date).toLocaleDateString('en-GB')}</p>
              {quote.expiry_date && (
                <p className="text-gray-400 text-xs mt-1">Valid until {new Date(quote.expiry_date).toLocaleDateString('en-GB')}</p>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-brand-dark">{l.description}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{l.quantity}</td>
                    <td className="px-4 py-2 text-right text-brand-dark">£{(parseFloat(l.line_total) + parseFloat(l.vat_amount)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-48 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-brand-dark">£{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="text-brand-dark">£{vatTotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span className="text-brand-dark">Total</span><span className="text-brand-dark">£{total.toFixed(2)}</span></div>
            </div>
          </div>

          {quote.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-600">{quote.notes}</p>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          {responded === 'accepted' && (
            <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 text-center font-medium">
              ✓ You've accepted this quote. Thank you — we'll be in touch shortly.
            </div>
          )}
          {responded === 'declined' && (
            <div className="bg-gray-100 text-gray-600 text-sm rounded-lg px-4 py-3 text-center font-medium">
              You've declined this quote.
            </div>
          )}
          {!responded && isExpired && (
            <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-3 text-center font-medium">
              This quote has expired. Please contact us for an updated quote.
            </div>
          )}
          {!responded && !isExpired && (
            <div className="flex gap-3">
              <button
                onClick={() => handleRespond('accepted')}
                disabled={responding}
                className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {responding ? 'Submitting...' : 'Accept Quote'}
              </button>
              <button
                onClick={() => handleRespond('declined')}
                disabled={responding}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-200 transition disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
