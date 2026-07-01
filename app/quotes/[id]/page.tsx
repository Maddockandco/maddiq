'use client'

import Link from 'next/link'
import QuoteDetail from '@/components/quotes/QuoteDetail'

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/quotes" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to quotes
        </Link>
      </div>
      <QuoteDetail quoteId={params.id} />
    </div>
  )
}
