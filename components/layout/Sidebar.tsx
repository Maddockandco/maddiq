'use client'

import Link from 'next/link'
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

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Deadlines', href: '/deadlines', icon: Calendar },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Pipeline', href: '/pipeline', icon: TrendingUp },
]

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-brand-dark flex flex-col z-50">

      {/* Logo — clicking takes you to dashboard */}
      <Link href="/dashboard" className="px-6 py-6 border-b border-white/10 hover:bg-white/5 transition">
        <h1 className="text-2xl font-bold text-white">Maddiq</h1>
        <p className="text-xs text-brand-gold mt-0.5">AI-native accounting</p>
      </Link>

      {/* Nav Items */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
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

      {/* Bottom — Settings + Logout */}
      <div className="px-4 py-6 border-t border-white/10 space-y-1">
        <Link
          href="/settings"
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

    </aside>
  )
}
