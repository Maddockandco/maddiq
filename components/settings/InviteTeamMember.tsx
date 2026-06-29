'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InviteTeamMember({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('bookkeeper')
  const [canBill, setCanBill] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showing, setShowing] = useState(false)
  const supabase = createClient()

  async function handleInvite() {
    setSending(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Step 1 failed: Not authenticated'); setSending(false); return }

    const { data: firmUser, error: firmError } = await supabase
      .from('firm_users')
      .select('firm_id, id, firms(name)')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) { setError(`Step 2 failed: ${firmError?.message}`); setSending(false); return }

    const firmName = (firmUser.firms as any)?.name || 'Your firm'

    const { data: invite, error: inviteError } = await supabase
      .from('firm_invites')
      .insert({
        firm_id: firmUser.firm_id,
        email,
        role,
        can_bill: canBill,
        invited_by: firmUser.id,
      })
      .select()
      .single()

    if (inviteError) { setError(`Step 3 failed: ${inviteError.message}`); setSending(false); return }

    const inviteUrl = `${window.location.origin}/invite/accept?token=${invite.token}`

    const roleLabels: Record<string, string> = {
      practice_manager: 'Practice Manager',
      client_manager: 'Client Manager',
      bookkeeper: 'Bookkeeper',
      admin_staff: 'Admin Staff',
      payroll_manager: 'Payroll Manager',
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: `You've been invited to join ${firmName} on Maddiq`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #343b46; font-size: 24px;">You've been invited!</h1>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              <strong>${firmName}</strong> has invited you to join their practice on Maddiq as a
              <strong>${roleLabels[role] || role}</strong>.
            </p>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              Click the button below to accept your invitation and set up your account.
            </p>
            <a href="${inviteUrl}"
               style="display: inline-block; background: #343b46; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">
              Accept invitation
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you weren't expecting this invitation you can ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const emailError = await emailResponse.json()
      setError(`Step 4 failed: ${emailError.message || 'Failed to send email'}`)
      setSending(false)
      return
    }

    setSuccess(true)
    setShowing(false)
    setEmail('')
    setRole('bookkeeper')
    setCanBill(false)
    onInvited()
    setSending(false)
  }

  const roleLabels: Record<string, string> = {
    practice_manager: 'Practice Manager',
    client_manager: 'Client Manager',
    bookkeeper: 'Bookkeeper',
    admin_staff: 'Admin Staff',
    payroll_manager: 'Payroll Manager',
  }

  if (success) return (
    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">
      ✅ Invite sent successfully!
    </div>
  )

  return (
    <div>
      {!showing ? (
        <button onClick={() => setShowing(true)}
          className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
          + Invite team member
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Invite team member</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {role === 'client_manager' && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={canBill} onChange={(e) => setCanBill(e.target.checked)}
                className="w-4 h-4 accent-brand-dark" />
              <span className="text-sm font-medium text-brand-dark">Enable billing access</span>
            </label>
          )}
          <div className="flex gap-3">
            <button onClick={handleInvite} disabled={sending || !email}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {sending ? 'Sending...' : 'Send invite'}
            </button>
            <button onClick={() => { setShowing(false); setEmail('') }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
