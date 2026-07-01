'use client'

import Link from 'next/link'
import QuoteList from '@/components/quotes/QuoteList'
import { useRole } from '@/hooks/useRole'

export default function QuotesPage() {
  const { can } = useRole()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">Create and track quotes for prospects and clients</p>
        </div>
        {can.managePipeline && (
          <Link
            href="/quotes/new"
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Quote
          </Link>
        )}
      </div>
      <QuoteList />
    </div>
  )
}
