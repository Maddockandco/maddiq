'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  FileText,
  TrendingUp,
  FileSignature,
  FileCheck,
  Calculator,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
  { label: 'Clients', href: '/clients', icon: Users, show: true },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare, show: true },
  { label: 'Deadlines', href: '/deadlines', icon: Calendar, show: true },
  { label: 'Documents', href: '/documents', icon: FileText, show: true },
]

export default function MobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()
  const { can, role } = useRole()

  // Mirrors Sidebar.tsx exactly - Accounting is available to everyone who might
  // actually need to work in it day to day; Admin Staff is the only role excluded.
  const canAccessAccounting = [
    'practice_owner',
    'practice_manager',
    'bookkeeper',
    'payroll_manager',
    'client_manager',
  ].includes(role || '')

  const allNavItems = [
    ...navItems,
    { label: 'Accounting', href: '/accounting', icon: Calculator, show: canAccessAccounting },
    { label: 'Pipeline', href: '/pipeline', icon: TrendingUp, show: can.managePipeline },
    { label: 'Quotes', href: '/quotes', icon: FileSignature, show: can.managePipeline },
    { label: 'Proposals', href: '/proposals', icon: FileCheck, show: can.managePipeline },
  ].filter((item) => item.show)

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-brand-dark flex items-center justify-between px-4 py-4 lg:hidden">
        <Link href="/dashboard">
          <h1 className="text-xl font-bold text-white">Maddiq</h1>
          <p className="text-xs text-brand-gold">AI-native accounting</p>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="text-white p-2 rounded-lg hover:bg-white/10 transition"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-brand-dark z-50 transform transition-transform duration-300 lg:hidden ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Maddiq</h1>
            <p className="text-xs text-brand-gold">AI-native accounting</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {allNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand-gold text-brand-dark'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-6 border-t border-white/10 space-y-1">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/settings'
                ? 'bg-brand-gold text-brand-dark'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings size={18} />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
