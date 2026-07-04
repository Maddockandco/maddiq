'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const accountingToolItems = [
  { label: 'Chart of Accounts', path: '/chart-of-accounts' },
  { label: 'Journal Entries', path: '/journal-entries' },
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function isActive(path: string) {
    const fullPath = `/accounting/${params.clientId}${path}`
    if (path === '') return pathname === `/accounting/${params.clientId}`
    return pathname === fullPath
  }

  const isAccountingToolActive = accountingToolItems.some((item) => isActive(item.path))

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
            <button
              onClick={() => router.push(`/accounting/${params.clientId}`)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                isActive('')
                  ? 'border-brand-gold text-white'
                  : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              Dashboard
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                  isAccountingToolActive
                    ? 'border-brand-gold text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Accounting
                <span className={`text-xs transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[200px] z-50">
                  {accountingToolItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        router.push(`/accounting/${params.clientId}${item.path}`)
                        setDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        isActive(item.path)
                          ? 'bg-brand-light text-brand-dark font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => router.push(`/accounting/${params.clientId}/reports`)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                isActive('/reports')
                  ? 'border-brand-gold text-white'
                  : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              Reports
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
