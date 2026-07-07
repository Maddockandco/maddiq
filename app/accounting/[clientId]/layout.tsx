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
  const [salesDropdownOpen, setSalesDropdownOpen] = useState(false)
  const [purchasesDropdownOpen, setPurchasesDropdownOpen] = useState(false)
  const [accountingDropdownOpen, setAccountingDropdownOpen] = useState(false)
  const salesDropdownRef = useRef<HTMLDivElement>(null)
  const purchasesDropdownRef = useRef<HTMLDivElement>(null)
  const accountingDropdownRef = useRef<HTMLDivElement>(null)

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
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(e.target as Node)) {
        setSalesDropdownOpen(false)
      }
      if (purchasesDropdownRef.current && !purchasesDropdownRef.current.contains(e.target as Node)) {
        setPurchasesDropdownOpen(false)
      }
      if (accountingDropdownRef.current && !accountingDropdownRef.current.contains(e.target as Node)) {
        setAccountingDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const basePath = `/accounting/${clientId}`

  const salesSubPages = [
    { href: `${basePath}/sales-orders`, label: 'Sales Orders' },
    { href: `${basePath}/sales-invoices`, label: 'Sales Invoices' },
    { href: `${basePath}/sales-receipts`, label: 'Receipts' },
  ]

  const purchasesSubPages = [
    { href: `${basePath}/purchase-orders`, label: 'Purchase Orders' },
    { href: `${basePath}/purchase-bills`, label: 'Purchase Bills' },
    { href: `${basePath}/purchase-payments`, label: 'Payments' },
  ]

  const accountingSubPages = [
    { href: `${basePath}/chart-of-accounts`, label: 'Chart of Accounts' },
    { href: `${basePath}/journal-entries`, label: 'Journal Entries' },
    { href: `${basePath}/opening-balances`, label: 'Opening Balances' },
    { href: `${basePath}/settings`, label: 'Settings' },
  ]

  const isOnSalesSubPage = salesSubPages.some((p) => pathname === p.href)
  const isOnPurchasesSubPage = purchasesSubPages.some((p) => pathname === p.href)
  const isOnAccountingSubPage = accountingSubPages.some((p) => pathname === p.href)

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition ${
      active ? 'bg-brand-gold text-brand-dark' : 'text-white hover:bg-white/10'
    }`

  function renderDropdown(
    label: string,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    ref: React.RefObject<HTMLDivElement>,
    isActive: boolean,
    subPages: { href: string; label: string }[]
  ) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 ${tabClass(isActive)}`}
        >
          {label}
          <ChevronDown size={14} />
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-10">
            {subPages.map((p) => (
              <button
                key={p.href}
                onClick={() => { router.push(p.href); setIsOpen(false) }}
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
    )
  }

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

          {renderDropdown('Sales', salesDropdownOpen, setSalesDropdownOpen, salesDropdownRef, isOnSalesSubPage, salesSubPages)}

          {renderDropdown('Purchases', purchasesDropdownOpen, setPurchasesDropdownOpen, purchasesDropdownRef, isOnPurchasesSubPage, purchasesSubPages)}

          {renderDropdown('Accounting', accountingDropdownOpen, setAccountingDropdownOpen, accountingDropdownRef, isOnAccountingSubPage, accountingSubPages)}

          <button onClick={() => router.push(`${basePath}/reports`)} className={tabClass(pathname === `${basePath}/reports`)}>
            Reports
          </button>
        </nav>
      </div>

      <div className="p-8">{children}</div>
    </div>
  )
}
