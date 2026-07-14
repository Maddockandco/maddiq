'use client'
import FixedAssetsWorkspace from '@/components/accounting/FixedAssetsWorkspace'

export default function FixedAssetsPage({ params }: { params: { clientId: string } }) {
  return <FixedAssetsWorkspace clientId={params.clientId} />
}
