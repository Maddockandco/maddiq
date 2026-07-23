'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NicaiWidget from '@/components/ui/NicaiWidget'
export default function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { clientId: string }
}) {
  const { clientId } = params
  const pathname = usePathname()
  const supabase = createClient()
  const [clientName, setClientName] = useState('')
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)
  const [salesDropdownOpen, setSalesDropdownOpen] = useState(false)
  const [purchasesDropdownOpen, setPurchasesDropdownOpen] = useState(false)
  const [accountingDropdownOpen, setAccountingDropdownOpen] = useState(false)
  const [taxesDropdownOpen, setTaxesDropdownOpen] = useState(false)
  const salesDropdownRef = useRef<HTMLDivElement>(null)
  const purchasesDropdownRef = useRef<HTMLDivElement>(null)
  const accountingDropdownRef = useRef<HTMLDivElement>(null)
  const taxesDropdownRef = useRef<HTMLDivElement>(null)
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
    async function checkAccess() {
      setAccessChecked(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setHasAccess(false); setAccessChecked(true); return }
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('id, role')
        .eq('user_id', user.id)
        .single()
      if (!firmUser) { setHasAccess(false); setAccessChecked(true); return }
      // Practice owners see every client by default - everyone else needs an explicit assignment
      if (firmUser.role === 'practice_owner') { setHasAccess(true); setAccessChecked(true); return }
      const { data: assignment } = await supabase
        .from('client_assignments')
        .select('id')
        .eq('client_id', clientId)
        .eq('firm_user_id', firmUser.id)
        .maybeSingle()
      setHasAccess(!!assignment)
      setAccessChecked(true)
    }
    checkAccess()
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
      if (taxesDropdownRef.current && !taxesDropdownRef.current.contains(e.target as Node)) {
        setTaxesDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const basePath = `/accounting/${clientId}`
  const salesSubPages = [
    { href: `${basePath}/sales-quotes`, label: 'Quotes' },
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
    { href: `${basePath}/bank-transactions`, label: 'Bank Transactions' },
    { href: `${basePath}/journal-entries`, label: 'Journal Entries' },
    { href: `${basePath}/opening-balances`, label: 'Opening Balances' },
    { href: `${basePath}/capture`, label: 'Capture (Receipts & Invoices)' },
    { href: `${basePath}/dividends`, label: 'Dividends & Shareholders' },
    { href: `${basePath}/audit-trail`, label: 'Audit Trail' },
    { href: `${basePath}/settings`, label: 'Settings' },
  ]
  const taxesSubPages = [
    { href: `${basePath}/vat-return`, label: 'VAT Returns' },
    { href: `${basePath}/corporation-tax`, label: 'Corporation Tax' },
  ]
  const isOnSalesSubPage = salesSubPages.some((p) => pathname === p.href)
  const isOnPurchasesSubPage = purchasesSubPages.some((p) => pathname === p.href)
  const isOnAccountingSubPage = accountingSubPages.some((p) => pathname === p.href)
  const isOnTaxesSubPage = taxesSubPages.some((p) => pathname === p.href)
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
              <Link
                key={p.href}
                href={p.href}
                onClick={() => setIsOpen(false)}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition ${
                  pathname === p.href ? 'text-brand-gold font-semibold' : 'text-brand-dark'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (accessChecked && !hasAccess) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold text-brand-dark">You don't have access to this client</h1>
          <p className="text-sm text-gray-500">
            Ask your practice owner to assign you to "{clientName || 'this client'}" from its Team tab before you can view its accounting.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-brand-light">
      <div className="bg-brand-dark px-8 pt-6 pb-0">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Accounting</p>
        <h1 className="text-white text-xl font-semibold mb-4">{clientName || 'Loading client...'}</h1>
        <nav className="flex items-center gap-2">
          <Link href={basePath} className={tabClass(pathname === basePath)}>
            Dashboard
          </Link>
          <Link href={`${basePath}/contacts`} className={tabClass(pathname === `${basePath}/contacts`)}>
            Contacts
          </Link>
          {renderDropdown('Sales', salesDropdownOpen, setSalesDropdownOpen, salesDropdownRef, isOnSalesSubPage, salesSubPages)}
          {renderDropdown('Purchases', purchasesDropdownOpen, setPurchasesDropdownOpen, purchasesDropdownRef, isOnPurchasesSubPage, purchasesSubPages)}
          <Link href={`${basePath}/projects`} className={tabClass(pathname === `${basePath}/projects`)}>
            Projects
          </Link>
          {renderDropdown('Accounting', accountingDropdownOpen, setAccountingDropdownOpen, accountingDropdownRef, isOnAccountingSubPage, accountingSubPages)}
          {renderDropdown('Taxes', taxesDropdownOpen, setTaxesDropdownOpen, taxesDropdownRef, isOnTaxesSubPage, taxesSubPages)}
          <Link href={`${basePath}/fixed-assets`} className={tabClass(pathname === `${basePath}/fixed-assets`)}>
            Fixed Assets
          </Link>
          <Link href={`${basePath}/reports`} className={tabClass(pathname === `${basePath}/reports`)}>
            Reports
          </Link>
          <Link href={`${basePath}/advisor`} className={tabClass(pathname === `${basePath}/advisor`)}>
            ✨ Nicai
          </Link>
        </nav>
      </div>
      <div className="p-8">{children}</div>
      {!pathname.endsWith('/advisor') && <NicaiWidget clientId={clientId} />}
    </div>
  )
}
