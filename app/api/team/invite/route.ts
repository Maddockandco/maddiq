import { NextResponse } from 'next/server'

const roleLabels: Record<string, string> = {
  practice_manager: 'Practice Manager',
  client_manager: 'Client Manager',
  bookkeeper: 'Bookkeeper',
  admin_staff: 'Admin Staff',
  payroll_manager: 'Payroll Manager',
}

export async function POST(request: Request) {
  try {
    const { email, role, firmName, inviteUrl } = await request.json()

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Maddiq <hello@maddockandco.com>',
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
      return NextResponse.json({ error: emailError.message || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
