'use client'
import SalesInvoiceDetail from '@/components/accounting/SalesInvoiceDetail'

export default function SalesInvoiceDetailPage({ params }: { params: { clientId: string; invoiceId: string } }) {
  return <SalesInvoiceDetail clientId={params.clientId} invoiceId={params.invoiceId} />
}
