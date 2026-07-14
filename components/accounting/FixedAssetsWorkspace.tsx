'use client'

import { useState } from 'react'
import FixedAssetRegister from '@/components/accounting/FixedAssetRegister'
import CapitalAllowancesCalculator from '@/components/accounting/CapitalAllowancesCalculator'
import DepreciationCalculator from '@/components/accounting/DepreciationCalculator'

export default function FixedAssetsWorkspace({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'register' | 'allowances' | 'depreciation'>('register')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'register', label: 'Asset Register' },
          { key: 'allowances', label: 'Capital Allowances' },
          { key: 'depreciation', label: 'Depreciation' },
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

      {tab === 'register' && <FixedAssetRegister clientId={clientId} />}
      {tab === 'allowances' && <CapitalAllowancesCalculator clientId={clientId} />}
      {tab === 'depreciation' && <DepreciationCalculator clientId={clientId} />}
    </div>
  )
}
