'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'

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
    <div className="flex min-h-screen bg-brand-light">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileHeader />
      <div className="flex-1 min-w-0 flex flex-col lg:ml-64">
        <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 min-w-0 overflow-x-hidden">
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
              className="w-full max-w-md bg-brand-dark text-white placeholder-white/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold border border-brand-dark"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClients.map((client) => {
                const initials = client.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase()
                return (
                  <button
                    key={client.id}
                    onClick={() => openClientBooks(client.id)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center justify-between text-left hover:shadow-md hover:border-brand-gold transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-brand-dark flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">{initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{client.name}</p>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">{client.type} · {client.status}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-brand-dark bg-brand-light px-3 py-1.5 rounded-lg group-hover:bg-brand-gold group-hover:text-brand-dark transition-colors whitespace-nowrap ml-3">
                      Open books ↗
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
