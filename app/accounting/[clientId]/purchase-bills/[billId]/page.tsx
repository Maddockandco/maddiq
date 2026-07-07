'use client'
import PurchaseBillDetail from '@/components/accounting/PurchaseBillDetail'

export default function PurchaseBillDetailPage({ params }: { params: { clientId: string; billId: string } }) {
  return <PurchaseBillDetail clientId={params.clientId} billId={params.billId} />
}
