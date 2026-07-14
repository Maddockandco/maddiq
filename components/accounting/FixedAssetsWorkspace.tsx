'use client'

import { useState } from 'react'
import FixedAssetRegister from '@/components/accounting/FixedAssetRegister'
import CapitalAllowancesCalculator from '@/components/accounting/CapitalAllowancesCalculator'

export default function FixedAssetsWorkspace({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'register' | 'allowances'>('register')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'register', label: 'Asset Register' },
          { key: 'allowances', label: 'Capital Allowances' },
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

      {tab === 'register' ? <FixedAssetRegister clientId={clientId} /> : <CapitalAllowancesCalculator clientId={clientId} />}
    </div>
  )
}
