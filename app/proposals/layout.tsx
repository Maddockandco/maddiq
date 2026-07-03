'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import { createClient } from '@/lib/supabase/client'

export default function ProposalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileHeader />
      <div className="lg:ml-64">
        <main className="p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}
