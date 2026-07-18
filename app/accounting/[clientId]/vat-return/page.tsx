'use client'
import VatReturn from '@/components/accounting/VatReturn'

export default function VatReturnPage({ params }: { params: { clientId: string } }) {
  return <VatReturn clientId={params.clientId} />
}
