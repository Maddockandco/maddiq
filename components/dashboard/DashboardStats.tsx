'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardStats() {
  const [stats, setStats] = useState({
    clients: 0,
    tasks: 0,
    deadlines: 0,
    leads: 0,
  })
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

      // Only these roles see their own clients only
      const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(firmUser.role)

      // Clients
      let clientQuery = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmUser.firm_id)

      if (isRestricted) {
        clientQuery = clientQuery.eq('assigned_to', firmUser.id)
      }

      const { count: clientCount } = await clientQuery

      // Tasks
      let taskQuery = supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmUser.firm_id)
        .neq('status', 'done')

      if (isRestricted) {
        taskQuery = taskQuery.eq('assigned_to', firmUser.id)
      }

      const { count: taskCount } = await taskQuery

      // Deadlines — always firm-wide
      const { count: deadlineCount } = await supabase
        .from('statutory_deadlines')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmUser.firm_id)
        .eq('status', 'upcoming')

      // Pipeline leads — always firm-wide
      const { count: leadsCount } = await supabase
        .from('pipeline_leads')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', firmUser.firm_id)
        .not('stage', 'eq', 'won')
        .not('stage', 'eq', 'lost')

      setStats({
        clients: clientCount || 0,
        tasks: taskCount || 0,
        deadlines: deadlineCount || 0,
        leads: leadsCount || 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(role)

  const cards = [
    {
      label: isRestricted ? 'My Clients' : 'Total Clients',
      value: stats.clients,
      href: '/clients',
      colour: 'bg-brand-dark',
      textColour: 'text-white',
    },
    {
      label: isRestricted ? 'My Tasks' : 'Open Tasks',
      value: stats.tasks,
      href: '/tasks',
      colour: 'bg-brand-gold',
      textColour: 'text-brand-dark',
    },
    {
      label: 'Upcoming Deadlines',
      value: stats.deadlines,
      href: '/deadlines',
      colour: 'bg-white',
      textColour: 'text-brand-dark',
    },
    {
      label: 'Active Leads',
      value: stats.leads,
      href: '/pipeline',
      colour: 'bg-white',
      textColour: 'text-brand-dark',
    },
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
        <Link
          key={card.label}
          href={card.href}
          className={`${card.colour} rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${card.textColour} opacity-60`}>
            {card.label}
          </p>
          <p className={`text-4xl font-bold mt-2 ${card.textColour}`}>
            {card.value}
          </p>
        </Link>
      ))}
    </div>
  )
}
