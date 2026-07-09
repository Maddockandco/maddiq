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

const roleDescriptions: Record<string, string> = {
  practice_owner: 'Full access to everything across the practice, including settings, team, and billing.',
  practice_manager: 'Full access to everything across the practice — same permissions as Practice Owner.',
  client_manager: 'Manages clients, engagements, pipeline, and directors day-to-day. Cannot manage team or firm settings.',
  bookkeeper: 'Focused on day-to-day client work — tasks, notes, documents, and viewing tax info. Cannot edit client or tax details.',
  admin_staff: 'Handles client admin — editing details, tax info, documents, directors, and deadlines. Cannot manage engagements/pipeline or team/settings.',
  payroll_manager: 'Focused on payroll and CIS — can edit client, tax, payroll, and CIS details. Cannot manage engagements, directors, or share documents.',
}

const ROLES = ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager']

const PERMISSION_MATRIX = [
  {
    category: 'Clients',
    items: [
      { label: 'View all clients', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
      { label: 'Add & edit client details', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'] },
      { label: 'Delete clients', roles: ['practice_owner', 'practice_manager'] },
    ],
  },
  {
    category: 'Tax & Compliance',
    items: [
      { label: 'View tax info', roles: ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'] },
      { label: 'Edit tax info', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
      { label: 'Edit payroll info', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'] },
      { label: 'Edit CIS details', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'] },
    ],
  },
  {
    category: 'Engagements & Directors',
    items: [
      { label: 'Manage engagements', roles: ['practice_owner', 'practice_manager', 'client_manager'] },
      { label: 'Manage pipeline', roles: ['practice_owner', 'practice_manager', 'client_manager'] },
      { label: 'Add / edit directors', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
      { label: 'Manage engagement letters', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
    ],
  },
  {
    category: 'Documents & Portal',
    items: [
      { label: 'Upload documents', roles: ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'] },
      { label: 'Share documents externally', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
      { label: 'Invite clients to portal', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
    ],
  },
  {
    category: 'Tasks & Deadlines',
    items: [
      { label: 'Create tasks & notes', roles: ROLES },
      { label: 'Assign tasks to others', roles: ['practice_owner', 'practice_manager', 'client_manager'] },
      { label: 'Generate statutory deadlines', roles: ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'] },
    ],
  },
  {
    category: 'Team & Settings',
    items: [
      { label: 'Manage team members', roles: ['practice_owner', 'practice_manager'] },
      { label: 'Manage firm settings', roles: ['practice_owner', 'practice_manager'] },
      { label: 'Billing (unless individually granted)', roles: ['practice_owner', 'practice_manager'] },
    ],
  },
]

export default function TeamList() {
  const [team, setTeam] = useState<any[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTeam()
  }, [])

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

    const membersResult = await supabase
      .from('firm_users')
      .select('id, full_name, role, can_bill, is_active, created_at')
      .eq('firm_id', firmUser.firm_id)
      .order('created_at', { ascending: true })

    if (membersResult.data) setTeam(membersResult.data)

    const invitesResult = await supabase
      .from('firm_invites')
      .select('id, email, role, created_at')
      .eq('firm_id', firmUser.firm_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    if (invitesResult.data) setPendingInvites(invitesResult.data)

    setLoading(false)
  }

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

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm('Cancel this invite? The invite link will stop working.')) return
    setRevokingId(inviteId)
    await supabase.from('firm_invites').delete().eq('id', inviteId)
    setPendingInvites(pendingInvites.filter(i => i.id !== inviteId))
    setRevokingId(null)
  }

  const isOwner = currentUser?.role === 'practice_owner'
  const isManager = currentUser?.role === 'practice_manager'
  const canManageTeam = isOwner || isManager

  if (loading) return <div className="text-gray-500 text-sm">Loading team...</div>

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-xs font-medium text-brand-dark hover:underline flex items-center gap-1"
        >
          {showGuide ? '▾' : '▸'} Role permissions guide
        </button>

        {showGuide && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4"></th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center text-xs font-semibold text-brand-dark pb-3 px-2">
                      {roleLabels[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((group) => (
                  <>
                    <tr key={group.category}>
                      <td colSpan={ROLES.length + 1} className="pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={item.label} className="border-t border-gray-50">
                        <td className="py-2 pr-4 text-sm text-gray-600">{item.label}</td>
                        {ROLES.map((r) => (
                          <td key={r} className="text-center py-2 px-2">
                            {item.roles.includes(r) ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Pending Invites
          </p>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="bg-amber-50 rounded-2xl border border-amber-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                  <span className="text-amber-700 font-semibold text-sm">
                    {invite.email?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-brand-dark text-sm">{invite.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${roleBadgeColour[invite.role] || 'bg-gray-100 text-gray-600'}`}>
                      {roleLabels[invite.role] || invite.role}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      Invite pending
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Invited {new Date(invite.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(invite.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              {canManageTeam && (
                <button
                  onClick={() => handleRevokeInvite(invite.id)}
                  disabled={revokingId === invite.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 transition font-medium disabled:opacity-50"
                >
                  {revokingId === invite.id ? 'Cancelling...' : 'Cancel invite'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {team.length > 0 && pendingInvites.length > 0 && (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Team Members
          </p>
        )}
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
                  <p className="text-xs text-gray-400 mt-1.5 max-w-md">{roleDescriptions[member.role]}</p>
                </div>
              </div>

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
    </div>
  )
}
