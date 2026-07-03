'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QuoteDetail from '@/components/quotes/QuoteDetail'
import { createClient } from '@/lib/supabase/client'

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
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
    return <QuoteDetail quoteId={params.id} />
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/quotes" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to quotes
        </Link>
      </div>
      <QuoteDetail quoteId={params.id} />
    </div>
  )
}
