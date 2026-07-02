import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, recipientName, firmName, quoteUrl } = await request.json()

    if (!email || !quoteUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Maddiq <hello@maddockandco.com>',
        to: email,
        subject: `Your quote from ${firmName || 'our team'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #343b46; font-size: 24px;">Your quote is ready</h1>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              Hi ${recipientName || 'there'},
            </p>
            <p style="color: #666; font-size: 15px; line-height: 1.6;">
              <strong>${firmName || 'We'}</strong> have prepared a quote for you. Please click the button below to view the full details and let us know if you'd like to go ahead.
            </p>
            <a href="${quoteUrl}"
               style="display: inline-block; background: #343b46; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">
              View your quote
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              This link is unique to you and does not require creating an account.
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
