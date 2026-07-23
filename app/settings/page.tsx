'use client'

import { useState } from 'react'
import SettingsForm from '@/components/settings/SettingsForm'
import BrandingForm from '@/components/settings/BrandingForm'
import TeamList from '@/components/settings/TeamList'
import InviteTeamMember from '@/components/settings/InviteTeamMember'
import EngagementLetterTemplates from '@/components/settings/EngagementLetterTemplates'
import ClauseLibrary from '@/components/settings/ClauseLibrary'
import AiAdvisorKnowledgeReview from '@/components/settings/AiAdvisorKnowledgeReview'
import { useRole } from '@/hooks/useRole'

export default function SettingsPage() {
  const [refresh, setRefresh] = useState(0)
  const [activeTab, setActiveTab] = useState('firm')
  const { can } = useRole()

  if (!can.manageSettings && !can.manageTeam) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">You don't have permission to manage settings.</p>
          <p className="text-gray-400 text-xs mt-1">Contact your Practice Owner or Manager.</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'firm', label: 'Firm', show: can.manageSettings },
    { id: 'branding', label: 'Branding', show: can.manageSettings },
    { id: 'letters', label: 'Engagement Letters', show: can.manageSettings },
    { id: 'clauses', label: 'Clause Library', show: can.manageSettings },
    { id: 'ai_advisor', label: 'AI Advisor', show: can.manageSettings },
    { id: 'team', label: 'Team', show: can.manageTeam },
  ].filter((t) => t.show)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your firm settings and team</p>
      </div>

      <div className="flex gap-2 mb-6 bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-brand-dark text-white' : 'text-gray-500 hover:text-brand-dark hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'firm' && can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-4">Firm Settings</h2>
          <SettingsForm />
        </div>
      )}

      {activeTab === 'branding' && can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-4">Branding</h2>
          <BrandingForm />
        </div>
      )}

      {activeTab === 'letters' && can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-1">Engagement Letter Templates</h2>
          <p className="text-sm text-gray-500 mb-4">Create reusable templates for client engagement letters</p>
          <EngagementLetterTemplates />
        </div>
      )}

      {activeTab === 'clauses' && can.manageSettings && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-1">Clause Library & Compliance Checklist</h2>
          <p className="text-sm text-gray-500 mb-4">Manage governing-body clause text and checklist requirements for engagement letters</p>
          <ClauseLibrary />
        </div>
      )}

      {activeTab === 'ai_advisor' && can.manageSettings && (
        <AiAdvisorKnowledgeReview />
      )}

      {activeTab === 'team' && can.manageTeam && (
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
    </div>
  )
}
