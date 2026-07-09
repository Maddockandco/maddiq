'use client'

import { useState } from 'react'
import SettingsForm from '@/components/settings/SettingsForm'
import BrandingForm from '@/components/settings/BrandingForm'
import TeamList from '@/components/settings/TeamList'
import InviteTeamMember from '@/components/settings/InviteTeamMember'
import EngagementLetterTemplates from '@/components/settings/EngagementLetterTemplates'
import ClauseLibrary from '@/components/settings/ClauseLibrary'
import { useRole } from '@/hooks/useRole'

export default function SettingsPage() {
  const [refresh, setRefresh] = useState(0)
  const { can } = useRole()

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your firm settings and team</p>
      </div>

      {can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-4">Firm Settings</h2>
          <SettingsForm />
        </div>
      )}

      {can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-4">Branding</h2>
          <BrandingForm />
        </div>
      )}

      {can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-1">Engagement Letter Templates</h2>
          <p className="text-sm text-gray-500 mb-4">Create reusable templates for client engagement letters</p>
          <EngagementLetterTemplates />
        </div>
      )}

      {can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-1">Clause Library & Compliance Checklist</h2>
          <p className="text-sm text-gray-500 mb-4">Manage governing-body clause text and checklist requirements for engagement letters</p>
          <ClauseLibrary />
        </div>
      )}

      {can.manageTeam && (
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
      )}

      {!can.manageSettings && !can.manageTeam && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">You don't have permission to manage settings.</p>
          <p className="text-gray-400 text-xs mt-1">Contact your Practice Owner or Manager.</p>
        </div>
      )}
    </div>
  )
}
