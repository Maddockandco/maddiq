'use client'
import DividendDetail from '@/components/accounting/DividendDetail'

export default function DividendDetailPage({ params }: { params: { clientId: string; dividendId: string } }) {
  return <DividendDetail clientId={params.clientId} dividendId={params.dividendId} />
}
