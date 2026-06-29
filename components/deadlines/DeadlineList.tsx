'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeadlineTable from '@/components/deadlines/DeadlineTable'

export default function DeadlineList() {
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDeadlines() {
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
        // Get assigned client IDs first
        const { data: assignedClients } = await supabase
          .from('clients')
          .select('id')
          .eq('firm_id', firmUser.firm_id)
          .eq('assigned_to', firmUser.id)

        if (!assignedClients || assignedClients.length === 0) {
          setDeadlines([])
          setLoading(false)
          return
        }

        const clientIds = assignedClients.map(c => c.id)

        const { data } = await supabase
          .from('statutory_deadlines')
          .select('id, type, period_end, due_date, status, notes, clients(name)')
          .in('client_id', clientIds)
          .order('due_date', { ascending: true })

        if (data) setDeadlines(data)
      } else {
        const { data } = await supabase
          .from('statutory_deadlines')
          .select('id, type, period_end, due_date, status, notes, clients(name)')
          .eq('firm_id', firmUser.firm_id)
          .order('due_date', { ascending: true })

        if (data) setDeadlines(data)
      }

      setLoading(false)
    }
    fetchDeadlines()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading deadlines...</p>
    </div>
  )

  if (deadlines.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <h2 className="text-lg font-semibold text-brand-dark mb-2">No deadlines yet</h2>
      <p className="text-gray-500 text-sm">Generate deadlines from a client page</p>
    </div>
  )

  return <DeadlineTable deadlines={deadlines} />
}
