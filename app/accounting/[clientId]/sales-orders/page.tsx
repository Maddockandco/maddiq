'use client'
import SalesOrders from '@/components/accounting/SalesOrders'

export default function SalesOrdersPage({ params }: { params: { clientId: string } }) {
  return <SalesOrders clientId={params.clientId} />
}
