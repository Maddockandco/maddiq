'use client'
import ReportsExtra from '@/components/accounting/ReportsExtra'

export default function ReportsExtraPage({ params }: { params: { clientId: string } }) {
  return <ReportsExtra clientId={params.clientId} />
}
