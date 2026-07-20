'use client'
import QuoteDetail from '@/components/accounting/QuoteDetail'

export default function QuoteDetailPage({ params }: { params: { clientId: string; quoteId: string } }) {
  return <QuoteDetail clientId={params.clientId} quoteId={params.quoteId} />
}
