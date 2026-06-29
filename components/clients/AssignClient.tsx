'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const roleLabels: Record<string, string> = {
  practice_owner: 'Practice Owner',
  practice_manager: 'Practice Manager',
  client_manager: 'Client Manager',
  bookkeeper: 'Bookkeeper',
  admin_staff: 'Admin Staff',
  payroll_manager: 'Payroll Manager',
}

export default function AssignClient({ clientId }: { clientId: string }) {
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [clientId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) return

    const [{ data: members }, { data: currentAssignments }] = await Promise.all([
      supabase
        .from('firm_users')
        .select('id, full_name, role')
        .eq('firm_id', firmUser.firm_id)
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
      supabase
        .from('client_assignments')
        .select('id, firm_user_id, role')
        .eq('client_id', clientId),
    ])

    if (members) setTeamMembers(members)
    if (currentAssignments) setAssignments(currentAssignments)
    setLoading(false)
  }

  async function handleToggle(firmUserId: string, memberRole: string) {
    setSaving(firmUserId)
    const isAssigned = assignments.some(a => a.firm_user_id === firmUserId)

    if (isAssigned) {
      await supabase
        .from('client_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('firm_user_id', firmUserId)
      setAssignments(assignments.filter(a => a.firm_user_id !== firmUserId))
    } else {
      const { data } = await supabase
        .from('client_assignments')
        .insert({
          client_id: clientId,
          firm_user_id: firmUserId,
          role: memberRole,
        })
        .select()
        .single()
      if (data) setAssignments([...assignments, data])
    }
    setSaving(null)
  }

  if (loading) return <p className="text-xs text-gray-400">Loading team...</p>

  return (
    <div className="space-y-2">
      {teamMembers.map((member) => {
        const isAssigned = assignments.some(a => a.firm_user_id === member.id)
        return (
          <label key={member.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition">
            <input
              type="checkbox"
              checked={isAssigned}
              onChange={() => handleToggle(member.id, member.role)}
              disabled={saving === member.id}
              className="w-4 h-4 accent-brand-dark"
            />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-full bg-brand-dark flex items-center justify-center">
                <span className="text-white text-xs font-semibold">
                  {member.full_name?.[0] || '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-brand-dark">{member.full_name}</p>
                <p className="text-xs text-gray-400">{roleLabels[member.role] || member.role}</p>
              </div>
            </div>
            {isAssigned && (
              <span className="text-xs text-green-600 font-medium">Assigned</span>
            )}
          </label>
        )
      })}
    </div>
  )
}
