'use client'
import SalesQuotes from '@/components/accounting/SalesQuotes'

export default function SalesQuotesPage({ params }: { params: { clientId: string } }) {
  return <SalesQuotes clientId={params.clientId} />
}
