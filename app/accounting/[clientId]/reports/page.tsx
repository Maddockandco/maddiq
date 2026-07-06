'use client'
import Reports from '@/components/accounting/Reports'

export default function ReportsPage({ params }: { params: { clientId: string } }) {
  return <Reports clientId={params.clientId} />
}
