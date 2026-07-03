'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountingPickerPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchClients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return

      const { data } = await supabase
        .from('clients')
        .select('id, name, type, status')
        .eq('firm_id', firmUser.firm_id)
        .order('name', { ascending: true })

      if (data) setClients(data)
      setLoading(false)
    }
    fetchClients()
  }, [])

  function openClientBooks(clientId: string) {
    window.open(`/accounting/${clientId}`, '_blank')
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Accounting</h1>
        <p className="text-sm text-gray-500 mt-1">Select a client to open their books</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">Loading clients...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No clients found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          {filteredClients.map((client, i) => (
            <button
              key={client.id}
              onClick={() => openClientBooks(client.id)}
              className={`w-full flex items-center justify-between px-6 py-4 text-left hover:bg-brand-light transition ${
                i !== filteredClients.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-brand-dark">{client.name}</p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{client.type} · {client.status}</p>
              </div>
              <span className="text-xs text-brand-dark font-medium">
                Open books ↗
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
