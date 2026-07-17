'use client'

import { useState } from 'react'
import ShareholderRegister from '@/components/accounting/ShareholderRegister'
import Dividends from '@/components/accounting/Dividends'

export default function DividendsWorkspace({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'dividends' | 'shareholders'>('dividends')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'dividends', label: 'Dividends' },
          { key: 'shareholders', label: 'Shareholder Register' },
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

      {tab === 'dividends' && <Dividends clientId={clientId} />}
      {tab === 'shareholders' && <ShareholderRegister clientId={clientId} />}
    </div>
  )
}
