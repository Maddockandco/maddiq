'use client'
import SalesInvoices from '@/components/accounting/SalesInvoices'

export default function SalesInvoicesPage({ params }: { params: { clientId: string } }) {
  return <SalesInvoices clientId={params.clientId} />
}
