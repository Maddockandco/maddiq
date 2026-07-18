'use client'
import CorporationTaxWorkspace from '@/components/accounting/CorporationTaxWorkspace'

export default function CorporationTaxPage({ params }: { params: { clientId: string } }) {
  return <CorporationTaxWorkspace clientId={params.clientId} />
}
