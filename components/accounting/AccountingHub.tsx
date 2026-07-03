'use client'

import { useState } from 'react'
import ChartOfAccounts from '@/components/accounting/ChartOfAccounts'
import JournalEntries from '@/components/accounting/JournalEntries'

const subTabs = [
  { id: 'chart', label: 'Chart of Accounts' },
  { id: 'journal', label: 'Journal Entries' },
  { id: 'reports', label: 'Reports' },
]

export default function AccountingHub({ clientId }: { clientId: string }) {
  const [activeSubTab, setActiveSubTab] = useState('chart')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-gray-200">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeSubTab === tab.id
                ? 'border-brand-gold text-brand-dark'
                : 'border-transparent text-gray-500 hover:text-brand-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'chart' && <ChartOfAccounts clientId={clientId} />}
      {activeSubTab === 'journal' && <JournalEntries clientId={clientId} />}
      {activeSubTab === 'reports' && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Reports coming soon</p>
          <p className="text-gray-400 text-xs">Trial Balance, Profit & Loss and Balance Sheet will appear here once built</p>
        </div>
      )}
    </div>
  )
}
