'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ProposalList() {
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProposals() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', user.id)
        .single()
      if (!firmUser) return

      const { data } = await supabase
        .from('proposals')
        .select('id, status, created_at, client_id, clients(name), quote_id, quotes(prospect_name, prospect_company)')
        .eq('firm_id', firmUser.firm_id)
        .order('created_at', { ascending: false })

      if (data) setProposals(data)
      setLoading(false)
    }
    fetchProposals()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading proposals...</p>
    </div>
  )

  if (proposals.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <h2 className="text-lg font-semibold text-brand-dark mb-2">No proposals yet</h2>
      <p className="text-gray-500 text-sm">Proposals are created automatically when a client accepts a quote</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p, index) => {
              const name = (p.clients as any)?.name || (p.quotes as any)?.prospect_company || (p.quotes as any)?.prospect_name || 'Untitled'
              return (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <Link href={`/proposals/${p.id}`} className="font-semibold text-brand-dark hover:text-brand-gold transition-colors">
                      {name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      p.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      p.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
