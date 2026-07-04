'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AccountingDashboardPage({ params }: { params: { clientId: string } }) {
  const [accountCount, setAccountCount] = useState(0)
  const [entryCount, setEntryCount] = useState(0)
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchSummary() }, [params.clientId])

  async function fetchSummary() {
    const accountsResult = await supabase
      .from('chart_of_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId)

    const entriesResult = await supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId)

    const recentResult = await supabase
      .from('journal_entries')
      .select('id, entry_date, description, reference, source')
      .eq('client_id', params.clientId)
      .order('entry_date', { ascending: false })
      .limit(5)

    setAccountCount(accountsResult.count || 0)
    setEntryCount(entriesResult.count || 0)
    if (recentResult.data) setRecentEntries(recentResult.data)
    setLoading(false)
  }

  const cards = [
    { label: 'Accounts set up', value: accountCount, path: '/chart-of-accounts', colour: 'bg-brand-dark', textColour: 'text-white' },
    { label: 'Journal entries posted', value: entryCount, path: '/journal-entries', colour: 'bg-brand-gold', textColour: 'text-brand-dark' },
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => router.push(`/accounting/${params.clientId}${card.path}`)}
            className={`${card.colour} rounded-2xl p-6 shadow-sm text-left hover:shadow-md transition-shadow`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${card.textColour} opacity-60`}>
              {card.label}
            </p>
            <p className={`text-4xl font-bold mt-2 ${card.textColour}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Recent Journal Entries</h3>
          <button
            onClick={() => router.push(`/accounting/${params.clientId}/journal-entries`)}
            className="text-xs text-brand-dark font-medium hover:underline"
          >
            View all →
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-4">No journal entries posted yet</p>
            <button
              onClick={() => router.push(`/accounting/${params.clientId}/journal-entries`)}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
            >
              Post first entry
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition">
                <div>
                  <p className="text-sm font-medium text-brand-dark">
                    {entry.description || 'Journal entry'}
                    {entry.reference && <span className="text-gray-400 font-normal ml-2">({entry.reference})</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{entry.source}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(entry.entry_date).toLocaleDateString('en-GB')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {accountCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-amber-700 mb-1">Get started</p>
          <p className="text-sm text-amber-600 mb-4">Set up a Chart of Accounts before posting journal entries.</p>
          <button
            onClick={() => router.push(`/accounting/${params.clientId}/chart-of-accounts`)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            Set up Chart of Accounts
          </button>
        </div>
      )}
    </div>
  )
}
