'use client'

import { useState } from 'react'
import VatReturn from '@/components/accounting/VatReturn'
import VatSettings from '@/components/accounting/VatSettings'

export default function VatWorkspace({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'returns' | 'setup'>('returns')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'returns', label: 'VAT Returns' },
          { key: 'setup', label: 'VAT Setup' },
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

      {tab === 'returns' && <VatReturn clientId={clientId} />}
      {tab === 'setup' && <VatSettings clientId={clientId} />}
    </div>
  )
}
