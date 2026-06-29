import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { clientId, email, clientName, firmName } = await request.json()

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Maddiq <hello@maddockandco.com>',
        to: email,
        subject: `${firmName} has invited you to their client portal`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #343b46; font-size: 24px;">You have been invited!</h1>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              ${firmName} has invited you to access your secure client portal on Maddiq,
              where you can view and download your documents.
            </p>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              Click the button below to access your portal.
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

    if (!emailResponse.ok) {
      const emailError = await emailResponse.json()
      return NextResponse.json({ error: emailError.message || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
