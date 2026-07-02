'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: '/month',
  quarterly: '/quarter',
  annually: '/year',
  one_off: 'one-off',
}

export default function PublicQuoteViewPage({ params }: { params: { token: string } }) {
  const [quote, setQuote] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [firm, setFirm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [acceptedName, setAcceptedName] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchQuote() }, [params.token])

  async function fetchQuote() {
    const { data: quoteData } = await supabase
      .from('quotes')
      .select('*, clients(name, email)')
      .eq('token', params.token)
      .single()

    if (!quoteData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setQuote(quoteData)

    const { data: firmData } = await supabase
      .from('firms')
      .select('name, logo_url, brand_color, email, phone, address')
      .eq('id', quoteData.firm_id)
      .single()
    if (firmData) setFirm(firmData)

    const { data: items } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quoteData.id)
      .order('sort_order', { ascending: true })
    if (items) setLineItems(items)

    setLoading(false)
  }

  function calculateTotals() {
    let monthlyTotal = 0
    let oneOffTotal = 0
    lineItems.forEach((item) => {
      const fee = parseFloat(item.fee) || 0
      if (item.frequency === 'monthly') monthlyTotal += fee
      else if (item.frequency === 'quarterly') monthlyTotal += fee / 3
      else if (item.frequency === 'annually') monthlyTotal += fee / 12
      else if (item.frequency === 'one_off') oneOffTotal += fee
    })
    return { monthlyTotal, oneOffTotal }
  }

  async function handleAccept() {
    if (!acceptedName.trim()) {
      setError('Please type your full name to accept')
      return
    }
    setSubmitting(true)
    setError('')

    const response = await fetch('/api/quotes/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        action: 'accept',
        name: acceptedName,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Something went wrong')
      setSubmitting(false)
      return
    }

    fetchQuote()
    setSubmitting(false)
  }

  async function handleDecline() {
    setSubmitting(true)
    setError('')

    const response = await fetch('/api/quotes/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        action: 'decline',
        reason: declineReason,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Something went wrong')
      setSubmitting(false)
      return
    }

    fetchQuote()
    setSubmitting(false)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <p className="text-gray-500 text-sm">Loading quote...</p>
    </main>
  )

  if (notFound || !quote) return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-brand-dark mb-2">Quote not found</h1>
        <p className="text-gray-500 text-sm">This link may be invalid or has expired.</p>
      </div>
    </main>
  )

  const { monthlyTotal, oneOffTotal } = calculateTotals()
  const brandColor = firm?.brand_color || '#343b46'
  const recipientName = quote.prospect_name || (quote.clients as any)?.name || 'there'
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status === 'sent'

  return (
    <main className="min-h-screen bg-brand-light py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {quote.status === 'accepted' && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm text-center">
            ✅ Thank you — you accepted this quote on {new Date(quote.responded_at).toLocaleDateString('en-GB')}. {firm?.name} will be in touch shortly.
          </div>
        )}

        {quote.status === 'declined' && (
          <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-xl p-4 text-sm text-center">
            You declined this quote on {new Date(quote.responded_at).toLocaleDateString('en-GB')}.
          </div>
        )}

        {isExpired && quote.status === 'sent' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm text-center">
            ⚠️ This quote expired on {new Date(quote.valid_until).toLocaleDateString('en-GB')}. Please contact {firm?.name} for an updated quote.
          </div>
        )}

        <div className="rounded-2xl shadow-lg overflow-hidden border border-gray-200 bg-white">
          <div className="p-10 text-white" style={{ backgroundColor: brandColor }}>
            <div className="flex items-center justify-between mb-16">
              {firm?.logo_url ? (
                <img src={firm.logo_url} alt={firm.name} className="h-16 max-w-[180px] object-contain" />
              ) : (
                <h2 className="text-2xl font-bold">{firm?.name}</h2>
              )}
              <p className="text-sm text-white/70">{new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <h1 className="text-4xl font-bold mb-2">Proposal for Services</h1>
            <p className="text-lg text-white/80">Prepared for {recipientName}{quote.prospect_company ? ` — ${quote.prospect_company}` : ''}</p>
          </div>

          <div className="p-10 space-y-8">
            <p className="text-gray-600 leading-relaxed">{quote.intro_message}</p>

            <div>
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Services & Fees</h3>
              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="font-medium text-brand-dark text-sm">{item.service_type}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <p className="font-semibold text-brand-dark text-sm whitespace-nowrap ml-4">
                      £{parseFloat(item.fee).toFixed(2)} <span className="text-xs text-gray-400 font-normal">{FREQUENCY_LABELS[item.frequency]}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: `${brandColor}10` }}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-brand-dark">Estimated monthly total</span>
                <span className="text-2xl font-bold" style={{ color: brandColor }}>£{monthlyTotal.toFixed(2)}</span>
              </div>
              {oneOffTotal > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-brand-dark">One-off fees</span>
                  <span className="text-lg font-bold text-brand-dark">£{oneOffTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {quote.valid_until && (
              <p className="text-xs text-gray-400">
                This quote is valid until {new Date(quote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              {firm?.name && <p>{firm.name}</p>}
              {firm?.address && <p>{firm.address}</p>}
              {firm?.email && <p>{firm.email}</p>}
              {firm?.phone && <p>{firm.phone}</p>}
            </div>
          </div>
        </div>

        {quote.status === 'sent' && !isExpired && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

            {!showDecline ? (
              <>
                <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Accept this quote</h3>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1">Type your full name to accept</label>
                  <input
                    type="text"
                    value={acceptedName}
                    onChange={(e) => setAcceptedName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAccept} disabled={submitting}
                    className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
                    {submitting ? 'Submitting...' : 'I Agree — Accept Quote'}
                  </button>
                  <button onClick={() => setShowDecline(true)}
                    className="px-6 bg-gray-100 text-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-200 transition text-sm">
                    Decline
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Decline this quote</h3>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1">Reason (optional)</label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder="Let us know if there's anything we could improve..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleDecline} disabled={submitting}
                    className="flex-1 bg-gray-600 text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
                    {submitting ? 'Submitting...' : 'Confirm decline'}
                  </button>
                  <button onClick={() => setShowDecline(false)}
                    className="px-6 bg-gray-100 text-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-200 transition text-sm">
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
