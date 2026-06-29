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

const roleBadgeColour: Record<string, string> = {
  practice_owner: 'bg-purple-100 text-purple-700',
  practice_manager: 'bg-blue-100 text-blue-700',
  client_manager: 'bg-green-100 text-green-700',
  bookkeeper: 'bg-amber-100 text-amber-700',
  admin_staff: 'bg-gray-100 text-gray-700',
  payroll_manager: 'bg-cyan-100 text-cyan-700',
}

export default function TeamList() {
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTeam() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, role, id')
        .eq('user_id', user.id)
        .single()

      if (!firmUser) return
      setCurrentUser(firmUser)

      const { data: members } = await supabase
        .from('firm_users')
        .select('id, full_name, role, can_bill, is_active, created_at')
        .eq('firm_id', firmUser.firm_id)
        .order('created_at', { ascending: true })

      if (members) setTeam(members)
      setLoading(false)
    }
    fetchTeam()
  }, [])

  async function handleRoleChange(memberId: string, newRole: string) {
    await supabase
      .from('firm_users')
      .update({ role: newRole })
      .eq('id', memberId)
    setTeam(team.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  async function handleBillingToggle(memberId: string, canBill: boolean) {
    await supabase
      .from('firm_users')
      .update({ can_bill: canBill })
      .eq('id', memberId)
    setTeam(team.map(m => m.id === memberId ? { ...m, can_bill: canBill } : m))
  }

  async function handleDeactivate(memberId: string, isActive: boolean) {
    await supabase
      .from('firm_users')
      .update({ is_active: !isActive })
      .eq('id', memberId)
    setTeam(team.map(m => m.id === memberId ? { ...m, is_active: !isActive } : m))
  }

  const isOwner = currentUser?.role === 'practice_owner'
  const isManager = currentUser?.role === 'practice_manager'
  const canManageTeam = isOwner || isManager

  if (loading) return <div className="text-gray-500 text-sm">Loading team...</div>

  return (
    <div className="space-y-4">
      {team.map((member) => (
        <div key={member.id} className={`bg-white rounded-2xl border p-6 ${!member.is_active ? 'opacity-50' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {member.full_name?.[0] || 'U'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-brand-dark text-sm">
                  {member.full_name || 'Unknown'}
                  {member.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${roleBadgeColour[member.role] || 'bg-gray-100 text-gray-600'}`}>
                    {roleLabels[member.role] || member.role}
                  </span>
                  {member.can_bill && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                      Billing enabled
                    </span>
                  )}
                  {!member.is_active && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions — only for owners/managers, not for themselves */}
            {canManageTeam && member.id !== currentUser?.id && (
              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  {isOwner && <option value="practice_owner">Practice Owner</option>}
                  <option value="practice_manager">Practice Manager</option>
                  <option value="client_manager">Client Manager</option>
                  <option value="bookkeeper">Bookkeeper</option>
                  <option value="admin_staff">Admin Staff</option>
                  <option value="payroll_manager">Payroll Manager</option>
                </select>

                {member.role === 'client_manager' && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={member.can_bill}
                      onChange={(e) => handleBillingToggle(member.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-brand-dark"
                    />
                    <span className="text-xs text-gray-600">Billing</span>
                  </label>
                )}

                <button
                  onClick={() => handleDeactivate(member.id, member.is_active)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    member.is_active
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {member.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
