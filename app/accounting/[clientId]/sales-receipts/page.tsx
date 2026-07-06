'use client'
import SalesReceipts from '@/components/accounting/SalesReceipts'

export default function SalesReceiptsPage({ params }: { params: { clientId: string } }) {
  return <SalesReceipts clientId={params.clientId} />
}
