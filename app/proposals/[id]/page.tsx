'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProposalDetail from '@/components/proposals/ProposalDetail'
import { createClient } from '@/lib/supabase/client'

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthenticated(!!user)
      setChecking(false)
    }
    checkAuth()
  }, [])

  if (checking) {
    return <p className="text-gray-500 text-sm">Loading...</p>
  }

  if (!authenticated) {
    return <ProposalDetail proposalId={params.id} />
  }

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
