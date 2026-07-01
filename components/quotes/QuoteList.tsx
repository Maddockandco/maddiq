'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
}

export default function QuoteList() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchQuotes() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', user.id)
        .single()
      if (!firmUser) return

      const { data } = await supabase
        .from('quotes')
        .select('id, prospect_name, prospect_company, status, valid_until, created_at, client_id, clients(name)')
        .eq('firm_id', firmUser.firm_id)
        .order('created_at', { ascending: false })

      if (data) setQuotes(data)
      setLoading(false)
    }
    fetchQuotes()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading quotes...</p>
    </div>
  )

  if (quotes.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <h2 className="text-lg font-semibold text-brand-dark mb-2">No quotes yet</h2>
      <p className="text-gray-500 text-sm">Create your first quote to get started</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Company</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Valid Until</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, index) => (
              <tr key={q.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-6 py-4">
                  <Link href={`/quotes/${q.id}`} className="font-semibold text-brand-dark hover:text-brand-gold transition-colors">
                    {(q.clients as any)?.name || q.prospect_name || 'Untitled quote'}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-500">{q.prospect_company || '—'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyles[q.status]}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-GB') : '—'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{new Date(q.created_at).toLocaleDateString('en-GB')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
