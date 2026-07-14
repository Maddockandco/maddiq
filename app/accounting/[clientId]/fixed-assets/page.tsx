'use client'
import FixedAssetRegister from '@/components/accounting/FixedAssetRegister'

export default function FixedAssetsPage({ params }: { params: { clientId: string } }) {
  return <FixedAssetRegister clientId={params.clientId} />
}
