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
      const results: any[] = []

      let assignedClientIds: string[] = []
      if (isRestricted) {
        const { data: assignments } = await supabase
          .from('client_assignments')
          .select('client_id')
          .eq('firm_user_id', firmUser.id)
        assignedClientIds = assignments?.map(a => a.client_id) || []
      }

      // Recent tasks
      let taskQuery = supabase
        .from('tasks')
        .select('id, title, status, created_at, client_id, clients(name)')
        .order('created_at', { ascending: false })
        .limit(3)

      if (isRestricted) {
        taskQuery = taskQuery.eq('assigned_to', firmUser.id)
      } else {
        taskQuery = taskQuery.eq('firm_id', firmUser.firm_id)
      }

      const { data: tasks } = await taskQuery
      if (tasks) {
        tasks.forEach(t => results.push({
          id: t.id,
          type: 'task',
          title: t.title,
          subtitle: (t.clients as any)?.name || 'Internal task',
          href: `/tasks/${t.id}`,
          created_at: t.created_at,
          icon: '✅',
        }))
      }

      // Recent notes
      let noteQuery = supabase
        .from('notes')
        .select('id, content, created_at, client_id, clients(name)')
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(3)

      if (isRestricted && assignedClientIds.length > 0) {
        noteQuery = noteQuery.in('client_id', assignedClientIds)
      }

      const { data: notes } = await noteQuery
      if (notes) {
        notes.forEach(n => results.push({
          id: n.id,
          type: 'note',
          title: n.content.length > 50 ? `${n.content.substring(0, 50)}...` : n.content,
          subtitle: (n.clients as any)?.name || '—',
          href: `/clients/${n.client_id}`,
          created_at: n.created_at,
          icon: '📝',
        }))
      }

      // Recent documents
      let docQuery = supabase
        .from('documents')
        .select('id, name, created_at, client_id, clients(name)')
        .order('created_at', { ascending: false })
        .limit(3)

      if (isRestricted && assignedClientIds.length > 0) {
        docQuery = docQuery.in('client_id', assignedClientIds)
      } else if (!isRestricted) {
        docQuery = docQuery.eq('firm_id', firmUser.firm_id)
      }

      const { data: docs } = await docQuery
      if (docs) {
        docs.forEach(d => results.push({
          id: d.id,
          type: 'document',
          title: d.name,
          subtitle: (d.clients as any)?.name || '—',
          href: `/clients/${d.client_id}`,
          created_at: d.created_at,
          icon: '📄',
        }))
      }

      // Recent clients — only for non-restricted users
      if (!isRestricted) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, created_at, status')
          .eq('firm_id', firmUser.firm_id)
          .order('created_at', { ascending: false })
          .limit(3)

        if (clients) {
          clients.forEach(c => results.push({
            id: c.id,
            type: 'client',
            title: `New client: ${c.name}`,
            subtitle: c.status,
            href: `/clients/${c.id}`,
            created_at: c.created_at,
            icon: '👤',
          }))
        }
      }

      // Recent quotes
      let quoteQuery = supabase
        .from('quotes')
        .select('id, prospect_name, prospect_company, status, created_at, client_id, clients(name)')
        .eq('firm_id', firmUser.firm_id)
        .order('created_at', { ascending: false })
        .limit(3)

      const { data: quotes } = await quoteQuery
      if (quotes) {
        quotes.forEach(q => {
          const label = (q.clients as any)?.name || q.prospect_company || q.prospect_name || 'Untitled quote'
          const statusLabel =
            q.status === 'accepted' ? 'Accepted' :
            q.status === 'declined' ? 'Declined' :
            q.status === 'sent' ? 'Sent' : 'Draft'
          results.push({
            id: q.id,
            type: 'quote',
            title: `Quote for ${label}`,
            subtitle: statusLabel,
            href: `/quotes/${q.id}`,
            created_at: q.created_at,
            icon: '💷',
          })
        })
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setActivity(results.slice(0, 12))
      setLoading(false)
    }
    fetchActivity()
  }, [])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <p className="text-gray-500 text-sm">Loading activity...</p>
    </div>
  )

  // Group activity by date label
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
                {items.map((item, index) => (
                  <Link
                    key={`${item.type}-${item.id}-${index}`}
                    href={item.href}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-brand-light transition-colors group"
                  >
                    <div className="text-xl w-8 text-center">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate group-hover:text-brand-gold transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{item.subtitle}</p>
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
