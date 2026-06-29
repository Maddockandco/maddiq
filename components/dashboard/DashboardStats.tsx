'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardStats() {
  const [stats, setStats] = useState({ clients: 0, tasks: 0, deadlines: 0, leads: 0 })
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, role, id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return
      setRole(firmUser.role)

      const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(firmUser.role)
      const isPayrollOnly = firmUser.role === 'payroll_manager'
      const payrollDeadlineTypes = ['payroll', 'paye', 'cis']

      let assignedClientIds: string[] = []

      if (isRestricted) {
        const { data: assignments } = await supabase
          .from('client_assignments')
          .select('client_id')
          .eq('firm_user_id', firmUser.id)
        assignedClientIds = assignments?.map(a => a.client_id) || []
      }

      // Clients
      let clientCount = 0
      if (isRestricted) {
        clientCount = assignedClientIds.length
      } else {
        const { count } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', firmUser.firm_id)
        clientCount = count || 0
      }

      // Tasks
      let taskCount = 0
      if (isRestricted) {
        const { count } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', firmUser.firm_id)
          .eq('assigned_to', firmUser.id)
          .neq('status', 'done')
        taskCount = count || 0
      } else {
        const { count } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', firmUser.firm_id)
          .neq('status', 'done')
        taskCount = count || 0
      }

      // Deadlines
      let deadlineCount = 0
      if (isRestricted && assignedClientIds.length > 0) {
        let query = supabase
          .from('statutory_deadlines')
          .select('id', { count: 'exact', head: true })
          .in('client_id', assignedClientIds)
          .eq('status', 'upcoming')

        if (isPayrollOnly) {
          query = query.in('type', payrollDeadlineTypes)
        }

        const { count } = await query
        deadlineCount = count || 0
      } else if (!isRestricted) {
        const { count } = await supabase
          .from('statutory_deadlines')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', firmUser.firm_id)
          .eq('status', 'upcoming')
        deadlineCount = count || 0
      }

      // Pipeline
      const { count: leadsCount } = await supabase
        .from('pipeline_leads')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmUser.firm_id)
        .not('stage', 'eq', 'won')
        .not('stage', 'eq', 'lost')

      setStats({
        clients: clientCount,
        tasks: taskCount,
        deadlines: deadlineCount,
        leads: leadsCount || 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(role)

  const cards = [
    { label: isRestricted ? 'My Clients' : 'Total Clients', value: stats.clients, href: '/clients', colour: 'bg-brand-dark', textColour: 'text-white' },
    { label: isRestricted ? 'My Tasks' : 'Open Tasks', value: stats.tasks, href: '/tasks', colour: 'bg-brand-gold', textColour: 'text-brand-dark' },
    { label: isRestricted ? 'My Deadlines' : 'Upcoming Deadlines', value: stats.deadlines, href: '/deadlines', colour: 'bg-white', textColour: 'text-brand-dark' },
    { label: 'Active Leads', value: stats.leads, href: '/pipeline', colour: 'bg-white', textColour: 'text-brand-dark' },
  ]

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-gray-200">
          <div className="h-4 bg-gray-200 rounded mb-3 w-24" />
          <div className="h-8 bg-gray-200 rounded w-12" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <Link key={card.label} href={card.href}
          className={`${card.colour} rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${card.textColour} opacity-60`}>{card.label}</p>
          <p className={`text-4xl font-bold mt-2 ${card.textColour}`}>{card.value}</p>
        </Link>
      ))}
    </div>
  )
}
