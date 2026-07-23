'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState<any>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (t) {
      setToken(t)
      fetchInvite(t)
    }
  }, [])

  async function fetchInvite(t: string) {
    const { data } = await supabase
      .from('firm_invites')
      .select('id, email, role, firm_id, accepted_at, firms(name)')
      .eq('token', t)
      .single()

    if (data) setInvite(data)
    setLoading(false)
  }

  async function handleAccept() {
    setSaving(true)
    setError('')

    if (!firstName || !lastName || !password) {
      setError('Please fill in all fields')
      setSaving(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setSaving(false)
      return
    }

    // Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
    })

    if (signUpError) { setError(signUpError.message); setSaving(false); return }

    if (data.user) {
      // Create firm_user record
      const { error: firmUserError } = await supabase
        .from('firm_users')
        .insert({
          firm_id: invite.firm_id,
          user_id: data.user.id,
          full_name: `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          role: invite.role,
          is_active: true,
        })

      if (firmUserError) { setError(firmUserError.message); setSaving(false); return }

      // Mark invite as accepted
      await supabase
        .from('firm_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token)

      window.location.href = '/dashboard'
    }
  }

  const roleLabels: Record<string, string> = {
    practice_manager: 'Practice Manager',
    client_manager: 'Client Manager',
    bookkeeper: 'Bookkeeper',
    admin_staff: 'Admin Staff',
    payroll_manager: 'Payroll Manager',
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <p className="text-gray-500 text-sm">Loading invitation...</p>
    </main>
  )

  if (!invite) return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-brand-dark mb-4">Invalid invitation</h1>
        <p className="text-gray-500 text-sm">This invitation link is invalid or has expired.</p>
      </div>
    </main>
  )

  if (invite.accepted_at) return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-brand-dark mb-4">Already accepted</h1>
        <p className="text-gray-500 text-sm">This invitation has already been accepted.</p>
        <a href="/login" className="inline-block mt-4 text-brand-gold font-medium hover:underline text-sm">
          Sign in instead →
        </a>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark">Maddiq</h1>
          <p className="text-sm text-gray-500 mt-1">Accept your invitation</p>
        </div>

        <div className="bg-brand-light rounded-xl p-4 mb-6">
          <p className="text-sm text-brand-dark">
            You've been invited to join <strong>{(invite.firms as any)?.name}</strong> as a{' '}
            <strong>{roleLabels[invite.role] || invite.role}</strong>
          </p>
          <p className="text-xs text-gray-500 mt-1">{invite.email}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Create a password</label>
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
          onClick={handleAccept}
          disabled={saving}
          className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 mt-6 text-sm"
        >
          {saving ? 'Setting up your account...' : 'Accept invitation'}
        </button>
      </div>
    </main>
  )
}
