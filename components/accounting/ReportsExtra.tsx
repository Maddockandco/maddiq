'use client'

import { useState } from 'react'
import VisualDashboard from '@/components/accounting/VisualDashboard'
import TradeDebtors from '@/components/accounting/TradeDebtors'
import TradePayables from '@/components/accounting/TradePayables'

export default function ReportsExtra({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'dashboard' | 'debtors' | 'payables'>('dashboard')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'debtors', label: 'Trade Debtors' },
          { key: 'payables', label: 'Trade Payables' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm font-medium px-4 py-2 rounded-md transition ${tab === t.key ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <VisualDashboard clientId={clientId} />}
      {tab === 'debtors' && <TradeDebtors clientId={clientId} />}
      {tab === 'payables' && <TradePayables clientId={clientId} />}
    </div>
  )
}
