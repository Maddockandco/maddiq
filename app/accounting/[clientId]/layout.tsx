'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { clientId: string }
}) {
  const { clientId } = params
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [clientName, setClientName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single()
      if (data) setClientName(data.name)
    }
    fetchClient()
  }, [clientId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const basePath = `/accounting/${clientId}`

  const accountingSubPages = [
    { href: `${basePath}/chart-of-accounts`, label: 'Chart of Accounts' },
    { href: `${basePath}/journal-entries`, label: 'Journal Entries' },
    { href: `${basePath}/settings`, label: 'Settings' },
  ]

  const isOnAccountingSubPage = accountingSubPages.some((p) => pathname === p.href)

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition ${
      active ? 'bg-brand-gold text-brand-dark' : 'text-white hover:bg-white/10'
    }`

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="bg-brand-dark px-8 pt-6 pb-0">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Accounting</p>
        <h1 className="text-white text-xl font-semibold mb-4">{clientName || 'Loading client...'}</h1>

        <nav className="flex items-center gap-2">
          <button onClick={() => router.push(basePath)} className={tabClass(pathname === basePath)}>
            Dashboard
          </button>

          <button onClick={() => router.push(`${basePath}/contacts`)} className={tabClass(pathname === `${basePath}/contacts`)}>
            Contacts
          </button>

          <button onClick={() => router.push(`${basePath}/sales-orders`)} className={tabClass(pathname === `${basePath}/sales-orders`)}>
            Sales Orders
          </button>

          <button onClick={() => router.push(`${basePath}/sales-invoices`)} className={tabClass(pathname === `${basePath}/sales-invoices`)}>
            Sales Invoices
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-1 ${tabClass(isOnAccountingSubPage)}`}
            >
              Accounting
              <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-10">
                {accountingSubPages.map((p) => (
                  <button
                    key={p.href}
                    onClick={() => { router.push(p.href); setDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition ${
                      pathname === p.href ? 'text-brand-gold font-semibold' : 'text-brand-dark'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => router.push(`${basePath}/reports`)} className={tabClass(pathname === `${basePath}/reports`)}>
            Reports
          </button>
        </nav>
      </div>

      <div className="p-8">{children}</div>
    </div>
  )
}
