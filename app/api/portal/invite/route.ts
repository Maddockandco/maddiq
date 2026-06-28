import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { clientId, email, clientName } = await request.json()

  // Get firm details
  const { data: firmUser } = await supabase
    .from('firm_users')
    .select('firm_id, firms(name)')
    .eq('user_id', user.id)
    .single()

  if (!firmUser) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

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

  if (portalError) return NextResponse.json({ error: portalError.message }, { status: 500 })

  // Send invite email via Resend
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `${firmName} has invited you to their client portal`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #343b46; font-size: 24px;">You've been invited!</h1>
          <p style="color: #666; font-size: 15px; line-height: 1.6;">
            ${firmName} has invited you to access your secure client portal on Maddiq, 
            where you can view and download your documents.
          </p>
          <p style="color: #666; font-size: 15px; line-height: 1.6;">
            Click the button below to set up your account and access your portal.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/login" 
             style="display: inline-block; background: #343b46; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">
            Access your portal
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 30px;">
            If you have any questions, contact ${firmName} directly.
          </p>
        </div>
      `,
    }),
  })

  if (!resendResponse.ok) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
