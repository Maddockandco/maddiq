'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QuoteBuilder from '@/components/quotes/QuoteBuilder'

export default function NewQuotePage() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id') || undefined
  const leadId = searchParams.get('lead_id') || undefined

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/quotes" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to quotes
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-dark mb-8">New Quote</h1>
      <QuoteBuilder prefillClientId={clientId} prefillLeadId={leadId} />
    </div>
  )
}
