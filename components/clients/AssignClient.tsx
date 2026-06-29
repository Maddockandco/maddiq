'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AssignClient({ clientId, currentAssignedTo }: { clientId: string; currentAssignedTo: string | null }) {
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [assignedTo, setAssignedTo] = useState(currentAssignedTo || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTeam() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return

      const { data } = await supabase
        .from('firm_users')
        .select('id, full_name, role')
        .eq('firm_id', firmUser.firm_id)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (data) setTeamMembers(data)
    }
    fetchTeam()
  }, [])

  async function handleAssign(firmUserId: string) {
    setSaving(true)
    setSaved(false)
    await supabase
      .from('clients')
      .update({ assigned_to: firmUserId || null })
      .eq('id', clientId)
    setAssignedTo(firmUserId)
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const roleLabels: Record<string, string> = {
    practice_owner: 'Practice Owner',
    practice_manager: 'Practice Manager',
    client_manager: 'Client Manager',
    bookkeeper: 'Bookkeeper',
    admin_staff: 'Admin Staff',
    payroll_manager: 'Payroll Manager',
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={assignedTo}
        onChange={(e) => handleAssign(e.target.value)}
        disabled={saving}
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
      >
        <option value="">Unassigned</option>
        {teamMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name} ({roleLabels[member.role] || member.role})
          </option>
        ))}
      </select>
      {saved && <span className="text-xs text-green-600">✅ Saved</span>}
    </div>
  )
}
