'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ClientTable from '@/components/clients/ClientTable'

export default function ClientList() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, role')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return

      let query = supabase
        .from('clients')
        .select('id, name, type, status, industry, email, assigned_to, firm_users(full_name)')
        .eq('firm_id', firmUser.firm_id)
        .order('name', { ascending: true })

      // Bookkeepers and payroll managers only see assigned clients
      if (['bookkeeper', 'payroll_manager'].includes(firmUser.role)) {
        const { data: currentFirmUser } = await supabase
          .from('firm_users')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (currentFirmUser) {
          query = query.eq('assigned_to', currentFirmUser.id)
        }
      }

      const { data } = await query
      if (data) setClients(data)
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

  return <ClientTable clients={clients} />
}
