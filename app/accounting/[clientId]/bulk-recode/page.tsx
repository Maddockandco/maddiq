'use client'
import BulkRecode from '@/components/accounting/BulkRecode'

export default function BulkRecodePage({ params }: { params: { clientId: string } }) {
  return <BulkRecode clientId={params.clientId} />
}
