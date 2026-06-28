'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    if (data.user) {
      // Check if this user is a portal user
      const { data: portalUser } = await supabase
        .from('client_portal_users')
        .select('id, status')
        .eq('user_id', data.user.id)
        .single()

      if (!portalUser || portalUser.status !== 'active') {
        await supabase.auth.signOut()
        setError('No active portal account found for this email')
        setLoading(false)
        return
      }

      window.location.href = '/portal'
    }
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark">Maddiq</h1>
          <p className="text-sm text-brand-gold font-medium mt-1">Client Portal</p>
          <p className="text-sm text-gray-500 mt-2">Sign in to view your documents</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 mt-6 text-sm"
        >
          {loading ? 'Signing in...' : 'Sign in to portal'}
        </button>
      </div>
    </div>
  )
}
