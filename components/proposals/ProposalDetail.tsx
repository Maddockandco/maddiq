'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: '/month',
  quarterly: '/quarter',
  annually: '/year',
  one_off: 'one-off',
}

export default function ProposalDetail({ proposalId }: { proposalId: string }) {
  const [proposal, setProposal] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [engagements, setEngagements] = useState<any[]>([])
  const [firm, setFirm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [unauthenticated, setUnauthenticated] = useState(false)

  const supabase = createClient()

  useEffect(() => { fetchData() }, [proposalId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUnauthenticated(true)
      setLoading(false)
      return
    }

    const { data: proposalData } = await supabase
      .from('proposals')
      .select('*, clients(id, name, email)')
      .eq('id', proposalId)
      .single()

    if (!proposalData) { setLoading(false); return }
    setProposal(proposalData)

    const { data: firmData } = await supabase
      .from('firms')
      .select('name, logo_url, brand_color, email, phone, address')
      .eq('id', proposalData.firm_id)
      .single()
    if (firmData) setFirm(firmData)

    if (proposalData.quote_id) {
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', proposalData.quote_id)
        .single()
      if (quoteData) setQuote(quoteData)

      const { data: items } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', proposalData.quote_id)
        .order('sort_order', { ascending: true })
      if (items) setLineItems(items)
    }

    if (proposalData.client_id) {
      const { data: engagementData } = await supabase
        .from('engagements')
        .select('*')
        .eq('client_id', proposalData.client_id)
        .order('created_at', { ascending: false })
      if (engagementData) setEngagements(engagementData)
    }

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

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading proposal...</p>
    </div>
  )

  if (unauthenticated) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-brand-dark font-semibold text-base mb-2">Oops, looks like you've hit a roadblock! 🚧</p>
      <p className="text-gray-500 text-sm mb-4">You'll need to sign in to view this page.</p>
      <a href="/login" className="inline-block bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
        Take me to login
      </a>
    </div>
  )

  if (!proposal) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Proposal not found</p>
    </div>
  )

  const { monthlyTotal, oneOffTotal } = calculateTotals()
  const brandColor = firm?.brand_color || '#343b46'
  const client = proposal.clients as any
  const recipientName = client?.name || quote?.prospect_name || 'Client'

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
          proposal.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {proposal.status}
        </span>
        {client && (
          <Link href={`/clients/${client.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-opacity-90 transition font-medium">
            View client
          </Link>
        )}
      </div>

      {/* Branded document */}
      <div className="rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="p-10 text-white" style={{ backgroundColor: brandColor }}>
          <div className="flex items-center justify-between mb-16">
            {firm?.logo_url ? (
              <img src={firm.logo_url} alt={firm.name} className="h-16 max-w-[180px] object-contain" />
            ) : (
              <h2 className="text-2xl font-bold">{firm?.name}</h2>
            )}
            <p className="text-sm text-white/70">{new Date(proposal.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <h1 className="text-4xl font-bold mb-2">Accepted Proposal</h1>
          <p className="text-lg text-white/80">{recipientName}</p>
        </div>

        <div className="p-10 bg-white space-y-8">
          {lineItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Agreed Services & Fees</h3>
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
          )}

          {lineItems.length > 0 && (
            <div className="rounded-xl p-5" style={{ backgroundColor: `${brandColor}10` }}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-brand-dark">Monthly total</span>
                <span className="text-2xl font-bold" style={{ color: brandColor }}>£{monthlyTotal.toFixed(2)}</span>
              </div>
              {oneOffTotal > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-brand-dark">One-off fees</span>
                  <span className="text-lg font-bold text-brand-dark">£{oneOffTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {quote?.accepted_name && (
            <p className="text-xs text-gray-400">
              Accepted by {quote.accepted_name} on {new Date(quote.responded_at).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      </div>

      {/* Resulting engagements */}
      {engagements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Engagements created from this proposal</h3>
          <div className="space-y-2">
            {engagements.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-brand-dark capitalize">{e.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500 capitalize">{e.frequency.replace(/_/g, ' ')} · {e.status}</p>
                </div>
                <p className="text-sm font-semibold text-brand-dark">£{parseFloat(e.fee_amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
