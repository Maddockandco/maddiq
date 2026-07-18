'use client'

import { useState } from 'react'
import CorporationTax from '@/components/accounting/CorporationTax'
import AssociatedCompanies from '@/components/accounting/AssociatedCompanies'

export default function CorporationTaxWorkspace({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'ct' | 'associated'>('ct')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'ct', label: 'Corporation Tax' },
          { key: 'associated', label: 'Associated Companies' },
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

      {tab === 'ct' && <CorporationTax clientId={clientId} />}
      {tab === 'associated' && <AssociatedCompanies clientId={clientId} />}
    </div>
  )
}
