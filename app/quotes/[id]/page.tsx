'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import { logActivity } from '@/lib/logActivity'

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: '/month',
  quarterly: '/quarter',
  annually: '/year',
  one_off: 'one-off',
}

export default function QuoteDetail({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [firm, setFirm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [unauthenticated, setUnauthenticated] = useState(false)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [quoteId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUnauthenticated(true)
      setLoading(false)
      return
    }

    const { data: quoteData } = await supabase
      .from('quotes')
      .select('*, clients(name, email)')
      .eq('id', quoteId)
      .single()

    if (quoteData) {
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
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true })
      if (items) setLineItems(items)
    }
    setLoading(false)
  }

  async function handleSend() {
    if (!quote) return
    const recipientEmail = quote.prospect_email || (quote.clients as any)?.email
    if (!recipientEmail) {
      setError('No email address found for this quote')
      return
    }

    setSending(true)
    setError('')
    setSuccess('')

    const quoteUrl = `${window.location.origin}/quote-view/${quote.token}`
    const recipientName = quote.prospect_name || (quote.clients as any)?.name

    const response = await fetch('/api/quotes/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: recipientEmail,
        recipientName,
        firmName: firm?.name,
        quoteUrl,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Failed to send quote')
      setSending(false)
      return
    }

    await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', quoteId)

    const { data: { user } } = await supabase.auth.getUser()
    const firmUserResult = await supabase
      .from('firm_users')
      .select('id')
      .eq('user_id', user!.id)
      .single()

    await logActivity({
      firmId: quote.firm_id,
      clientId: quote.client_id || null,
      firmUserId: firmUserResult.data?.id || null,
      actionType: 'quote_sent',
      title: 'Quote sent to ' + (recipientName || quote.prospect_company || 'prospect'),
      subtitle: 'Sent',
      href: '/quotes/' + quoteId,
      icon: '💷',
    })

    setSuccess('Quote sent successfully!')
    fetchData()
    setSending(false)
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

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading quote...</p>
    </div>
  )

  if (unauthenticated) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-brand-dark font-semibold text-base mb-2">Oops, looks like you've hit a roadblock! 🚧</p>
      <p className="text-gray-500 text-sm mb-4">You'll need to sign in to view this page. If you received a quote link by email, please use that link instead — no login needed there.</p>
      <a href="/login" className="inline-block bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
        Take me to login
      </a>
    </div>
  )

  if (!quote) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Quote not found</p>
    </div>
  )

  const { monthlyTotal, oneOffTotal } = calculateTotals()
  const brandColor = firm?.brand_color || '#343b46'
  const recipientNameDisplay = quote.prospect_name || (quote.clients as any)?.name || 'there'

  return (
    <div className="max-w-3xl space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">{success}</div>}

      <div className="flex items-center justify-between">
        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
          quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
          quote.status === 'declined' ? 'bg-red-100 text-red-700' :
          quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {quote.status}
        </span>
        {quote.status === 'draft' && can.managePipeline && (
          <button onClick={handleSend} disabled={sending}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
            {sending ? 'Sending...' : 'Send to client'}
          </button>
        )}
      </div>

      {quote.responded_at && (
        <div className={`rounded-xl p-4 text-sm ${quote.status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {quote.status === 'accepted'
            ? `✅ Accepted by ${quote.accepted_name} on ${new Date(quote.responded_at).toLocaleDateString('en-GB')}`
            : `❌ Declined on ${new Date(quote.responded_at).toLocaleDateString('en-GB')}${quote.decline_reason ? ` — "${quote.decline_reason}"` : ''}`}
        </div>
      )}

      <div className="rounded-2xl shadow-lg overflow-hidden border border-gray-200">
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
          <p className="text-lg text-white/80">Prepared for {recipientNameDisplay}{quote.prospect_company ? ` — ${quote.prospect_company}` : ''}</p>
        </div>

        <div className="p-10 bg-white space-y-8">
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
    </div>
  )
}
