'use client'
import SalesOrderDetail from '@/components/accounting/SalesOrderDetail'

export default function SalesOrderDetailPage({ params }: { params: { clientId: string; orderId: string } }) {
  return <SalesOrderDetail clientId={params.clientId} orderId={params.orderId} />
}
