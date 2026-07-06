'use client'
import PurchaseBills from '@/components/accounting/PurchaseBills'

export default function PurchaseBillsPage({ params }: { params: { clientId: string } }) {
  return <PurchaseBills clientId={params.clientId} />
}
