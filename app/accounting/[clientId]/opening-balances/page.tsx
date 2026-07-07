'use client'
import OpeningBalances from '@/components/accounting/OpeningBalances'

export default function OpeningBalancesPage({ params }: { params: { clientId: string } }) {
  return <OpeningBalances clientId={params.clientId} />
}
