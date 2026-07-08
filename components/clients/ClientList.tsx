'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ClientTable from '@/components/clients/ClientTable'

export default function ClientList() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'company' | 'individual' | 'partnership'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function fetchClients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, role, id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return

      const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(firmUser.role)

      if (isRestricted) {
        const { data: assignments } = await supabase
          .from('client_assignments')
          .select('client_id')
          .eq('firm_user_id', firmUser.id)

        if (!assignments || assignments.length === 0) {
          setClients([])
          setLoading(false)
          return
        }

        const clientIds = assignments.map(a => a.client_id)

        const { data } = await supabase
          .from('clients')
          .select('id, name, type, status, industry, email, assigned_to, firm_users(full_name)')
          .in('id', clientIds)
          .order('name', { ascending: true })

        if (data) setClients(data)
      } else {
        const { data } = await supabase
          .from('clients')
          .select('id, name, type, status, industry, email, assigned_to, firm_users(full_name)')
          .eq('firm_id', firmUser.firm_id)
          .order('name', { ascending: true })

        if (data) setClients(data)
      }

      setLoading(false)
    }
    fetchClients()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading clients...</p>
    </div>
  )

  if (clients.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <h2 className="text-lg font-semibold text-brand-dark mb-2">No clients yet</h2>
      <p className="text-gray-500 text-sm">Add your first client to get started</p>
    </div>
  )

  const counts = {
    all: clients.length,
    company: clients.filter((c) => c.type === 'company').length,
    individual: clients.filter((c) => c.type === 'individual').length,
    partnership: clients.filter((c) => c.type === 'partnership').length,
  }

  const filteredClients = typeFilter === 'all' ? clients : clients.filter((c) => c.type === typeFilter)

  const tabs: { key: typeof typeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'company', label: 'Companies' },
    { key: 'individual', label: 'Individuals' },
    { key: 'partnership', label: 'Partnerships' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              typeFilter === tab.key ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {tab.label} <span className="opacity-60">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No {typeFilter !== 'all' ? typeFilter : ''} clients found</p>
        </div>
      ) : (
        <ClientTable clients={filteredClients} />
      )}
    </div>
  )
}
