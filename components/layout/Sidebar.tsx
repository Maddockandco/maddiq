'use client'

import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  FileText,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/layout/SearchBar'
import { useRole } from '@/hooks/useRole'

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const { can, role } = useRole()

  const isRestricted = ['bookkeeper', 'payroll_manager'].includes(role || '')

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleNavClick(href: string) {
    window.location.href = href
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    { label: 'Clients', href: '/clients', icon: Users, show: true },
    { label: 'Tasks', href: '/tasks', icon: CheckSquare, show: true },
    { label: 'Deadlines', href: '/deadlines', icon: Calendar, show: true },
    { label: 'Documents', href: '/documents', icon: FileText, show: true },
    { label: 'Pipeline', href: '/pipeline', icon: TrendingUp, show: can.managePipeline },
  ].filter(item => item.show)

  return (
    <aside style={{ width: '256px', minWidth: '256px' }} className="fixed top-0 left-0 h-full bg-brand-dark flex flex-col z-50">

      <div
        onClick={() => handleNavClick('/dashboard')}
        className="px-6 py-6 border-b border-white/10 hover:bg-white/5 transition block cursor-pointer"
      >
        <h1 className="text-2xl font-bold text-white">Maddiq</h1>
        <p className="text-xs text-brand-gold mt-0.5">AI-native accounting</p>
      </div>

      <div className="px-4 py-3 border-b border-white/10">
        <SearchBar />
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <div
              key={item.href}
              onClick={() => handleNavClick(item.href)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-brand-gold text-brand-dark'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              {item.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-dark" />}
            </div>
          )
        })}
      </nav>

      <div className="px-6 py-3 bg-white/5 border-t border-white/10">
        <p className="text-xs text-white/40 uppercase tracking-wider">Current page</p>
        <p className="text-xs text-white/70 font-medium mt-0.5 capitalize">
          {pathname.split('/').filter(Boolean)[0] || 'dashboard'}
        </p>
      </div>

      <div className="px-4 py-4 border-t border-white/10 space-y-1">
        <div
          onClick={() => handleNavClick('/settings')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            pathname === '/settings'
              ? 'bg-brand-gold text-brand-dark'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings size={18} />
          Settings
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
