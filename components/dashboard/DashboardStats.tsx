'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardStats() {
  const [clientCount, setClientCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [deadlineCount, setDeadlineCount] = useState(0)
  const [leadCount, setLeadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      const [clients, tasks, deadlines, leads] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        supabase.from('statutory_deadlines').select('id', { count: 'exact', head: true }).eq('status', 'upcoming'),
        supabase.from('pipeline_leads').select('id', { count: 'exact', head: true }).not('stage', 'in', '("won","lost")'),
      ])
      setClientCount(clients.count || 0)
      setTaskCount(tasks.count || 0)
      setDeadlineCount(deadlines.count || 0)
      setLeadCount(leads.count || 0)
      setLoading(false)
    }
    fetchStats()
  }, [])

  const stats = [
    { label: 'Total Clients', value: clientCount, href: '/clients', color: 'bg-blue-50 text-blue-600' },
    { label: 'Open Tasks', value: taskCount, href: '/tasks', color: 'bg-amber-50 text-amber-600' },
    { label: 'Upcoming Deadlines', value: deadlineCount, href: '/deadlines', color: 'bg-red-50 text-red-600' },
    { label: 'Active Leads', value: leadCount, href: '/pipeline', color: 'bg-green-50 text-green-600' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:border-brand-gold transition-colors"
        >
          <p className="text-2xl font-bold text-brand-dark">
            {loading ? '...' : stat.value}
          </p>
          <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
        </Link>
      ))}
    </div>
  )
}
