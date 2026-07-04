'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Dashboard', path: '' },
  { label: 'Chart of Accounts', path: '/chart-of-accounts' },
  { label: 'Journal Entries', path: '/journal-entries' },
  { label: 'Reports', path: '/reports' },
]

export default function AccountingClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { clientId: string }
}) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('id, name, type')
        .eq('id', params.clientId)
        .single()
      if (data) setClient(data)
      setLoading(false)
    }
    fetchClient()
  }, [params.clientId])

  function isActive(path: string) {
    const fullPath = `/accounting/${params.clientId}${path}`
    if (path === '') return pathname === `/accounting/${params.clientId}`
    return pathname === fullPath
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading books...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="bg-brand-dark">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/accounting')}
                className="text-white/60 hover:text-white text-sm transition"
              >
                ← Clients
              </button>
              <div className="w-px h-5 bg-white/20" />
              <h1 className="text-white font-bold text-lg">{client?.name || 'Loading...'}</h1>
              <span className="text-xs text-brand-gold capitalize bg-white/10 px-2 py-0.5 rounded-full">
                {client?.type}
              </span>
            </div>
            <div className="text-xs text-white/40">Maddiq Accounting</div>
          </div>
          <nav className="flex gap-1 -mb-px">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(`/accounting/${params.clientId}${item.path}`)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  isActive(item.path)
                    ? 'border-brand-gold text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
