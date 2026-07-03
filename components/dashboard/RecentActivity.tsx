'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function formatGroupLabel(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, yesterday)) return 'Yesterday'

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return 'This week'

  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function RecentActivity() {
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchActivity() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, role, id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return

      const isRestricted = ['bookkeeper', 'payroll_manager', 'client_manager'].includes(firmUser.role)

      let query = supabase
        .from('activity_log')
        .select('id, action_type, title, subtitle, href, icon, created_at, client_id, firm_user_id')
        .eq('firm_id', firmUser.firm_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (isRestricted) {
        const { data: assignments } = await supabase
          .from('client_assignments')
          .select('client_id')
          .eq('firm_user_id', firmUser.id)

        const assignedClientIds = assignments?.map(a => a.client_id) || []

        if (assignedClientIds.length > 0) {
          // Show activity on assigned clients, or activity this user personally performed
          query = query.or(
            `client_id.in.(${assignedClientIds.join(',')}),firm_user_id.eq.${firmUser.id}`
          )
        } else {
          // No assigned clients — only show their own actions
          query = query.eq('firm_user_id', firmUser.id)
        }
      }

      const { data } = await query
      if (data) setActivity(data)
      setLoading(false)
    }
    fetchActivity()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <p className="text-gray-500 text-sm">Loading activity...</p>
    </div>
  )

  const grouped: Record<string, any[]> = {}
  activity.forEach((item) => {
    const label = formatGroupLabel(item.created_at)
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(item)
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-6">
        Recent Activity
      </h3>
      {activity.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No recent activity yet</p>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">{label}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href || '#'}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-brand-light transition-colors group"
                  >
                    <div className="text-xl w-8 text-center">{item.icon || '•'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate group-hover:text-brand-gold transition-colors">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">
                      {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
