'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LABELS } from '@/lib/industryDetection'

export default function AiAdvisorKnowledgeReview() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_advisor_industry_knowledge')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function handleReview(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('ai_advisor_industry_knowledge')
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setBusyId(null)
    fetchItems()
  }

  const pending = items.filter((i) => i.status === 'pending_review')
  const reviewed = items.filter((i) => i.status !== 'pending_review')

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-1">AI Advisor — Knowledge Review</h2>
        <p className="text-sm text-gray-500 mb-4">
          The AI advisor accumulates industry-level insights from real conversations, but nothing feeds back into future
          advice until it's approved here. This is real institutional memory, not model retraining — every entry stays
          human-reviewed.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">
          Pending Review {pending.length > 0 && `(${pending.length})`}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing waiting on review.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <span className="text-xs bg-brand-light text-brand-dark px-2 py-0.5 rounded-full font-medium">
                  {INDUSTRY_LABELS[item.industry] || item.industry}
                </span>
                <p className="text-sm text-brand-dark mt-2">{item.insight}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleReview(item.id, 'approved')}
                    disabled={busyId === item.id}
                    className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview(item.id, 'rejected')}
                    disabled={busyId === item.id}
                    className="text-xs bg-gray-100 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Reviewed</h3>
          <div className="space-y-2">
            {reviewed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {item.status}
                </span>
                <p className="text-gray-600">{item.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
