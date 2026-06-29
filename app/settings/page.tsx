'use client'

import { useState } from 'react'
import SettingsForm from '@/components/settings/SettingsForm'
import TeamList from '@/components/settings/TeamList'
import InviteTeamMember from '@/components/settings/InviteTeamMember'

export default function SettingsPage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your firm settings and team</p>
      </div>

      {/* Firm Settings */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-4">Firm Settings</h2>
        <SettingsForm />
      </div>

      {/* Team Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Team Members</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage your team and their access levels</p>
          </div>
          <InviteTeamMember onInvited={() => setRefresh(r => r + 1)} />
        </div>
        <TeamList key={refresh} />
      </div>
    </div>
  )
}
