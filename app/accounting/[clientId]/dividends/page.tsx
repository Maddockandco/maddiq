'use client'
import DividendsWorkspace from '@/components/accounting/DividendsWorkspace'

export default function DividendsPage({ params }: { params: { clientId: string } }) {
  return <DividendsWorkspace clientId={params.clientId} />
}
