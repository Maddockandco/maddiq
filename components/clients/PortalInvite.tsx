'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PortalInvite({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showing, setShowing] = useState(false)
  const supabase = createClient()

  async function handleInvite() {
    setSending(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSending(false); return }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, firms(name)')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) { setError('Could not find your firm'); setSending(false); return }

    const firmName = (firmUser.firms as any)?.name || 'Your accountant'

    // Create portal user record
    const { error: portalError } = await supabase
      .from('client_portal_users')
      .upsert({
        client_id: clientId,
        firm_id: firmUser.firm_id,
        email,
        status: 'invited',
        invited_at: new Date().toISOString(),
      }, { onConflict: 'client_id,email' })

    if (portalError) { setError(portalError.message); setSending(false); return }

    // Get session token to pass to API
    const { data: { session } } = await supabase.auth.getSession()

    // Send invite email
    const response = await fetch('/api/portal/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ clientId, email, clientName, firmName }),
    })

    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Failed to send invite email')
      setSending(false)
      return
    }

    setSuccess(true)
    setShowing(false)
    setSending(false)
  }

  if (success) return (
    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">
      ✅ Portal invite sent successfully!
    </div>
  )

  return (
    <div>
      {!showing ? (
        <button
          onClick={() => setShowing(true)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition w-full"
        >
          🔗 Invite to client portal
        </button>
      ) : (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm font-medium text-brand-dark">Send portal invite</p>
          {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
          <div className="flex gap-2">
            <button
              onClick={handleInvite}
              disabled={sending || !email}
              className="flex-1 bg-brand-dark text-white text-xs font-semibold py-2 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send invite'}
            </button>
            <button
              onClick={() => { setShowing(false); setEmail('') }}
              className="flex-1 bg-gray-100 text-gray-600 text-xs font-semibold py-2 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
