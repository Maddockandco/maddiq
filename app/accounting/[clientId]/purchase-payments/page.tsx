'use client'
import PurchasePayments from '@/components/accounting/PurchasePayments'

export default function PurchasePaymentsPage({ params }: { params: { clientId: string } }) {
  return <PurchasePayments clientId={params.clientId} />
}
