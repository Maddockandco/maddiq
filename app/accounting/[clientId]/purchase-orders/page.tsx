'use client'
import PurchaseOrders from '@/components/accounting/PurchaseOrders'

export default function PurchaseOrdersPage({ params }: { params: { clientId: string } }) {
  return <PurchaseOrders clientId={params.clientId} />
}
