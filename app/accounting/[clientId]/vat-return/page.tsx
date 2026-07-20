'use client'
import VatWorkspace from '@/components/accounting/VatWorkspace'

export default function VatReturnPage({ params }: { params: { clientId: string } }) {
  return <VatWorkspace clientId={params.clientId} />
}
