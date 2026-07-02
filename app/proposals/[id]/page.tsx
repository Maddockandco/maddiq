'use client'

import Link from 'next/link'
import ProposalDetail from '@/components/proposals/ProposalDetail'

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/proposals" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to proposals
        </Link>
      </div>
      <ProposalDetail proposalId={params.id} />
    </div>
  )
}
