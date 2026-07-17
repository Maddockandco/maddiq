'use client'
import PurchaseOrderDetail from '@/components/accounting/PurchaseOrderDetail'

export default function PurchaseOrderDetailPage({ params }: { params: { clientId: string; orderId: string } }) {
  return <PurchaseOrderDetail clientId={params.clientId} orderId={params.orderId} />
}
