'use client'
import AuditTrail from '@/components/accounting/AuditTrail'

export default function AuditTrailPage({ params }: { params: { clientId: string } }) {
  return <AuditTrail clientId={params.clientId} />
}
