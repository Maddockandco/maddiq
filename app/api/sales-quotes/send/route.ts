import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { quoteId } = await request.json()
  if (!quoteId) return NextResponse.json({ error: 'quoteId is required' }, { status: 400 })

  const { data: quote, error: quoteError } = await supabase
    .from('sales_quotes')
    .select('*, contacts(name, email), clients(name)')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!quote.contacts?.email) return NextResponse.json({ error: 'This customer has no email address on file - add one in Contacts first' }, { status: 400 })

  const { data: lines } = await supabase.from('sales_quote_lines').select('line_total, vat_amount').eq('quote_id', quoteId)
  const total = (lines || []).reduce((sum: number, l: any) => sum + parseFloat(l.line_total) + parseFloat(l.vat_amount), 0)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maddiq.vercel.app'
  const quoteLink = `${appUrl}/sales-quotes/${quote.accept_token}`
  const companyName = quote.clients?.name || 'us'

  const { error: sendError } = await resend.emails.send({
    from: 'hello@maddockandco.com',
    to: quote.contacts.email,
    subject: `Quote ${quote.quote_number} from ${companyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #343b46;">You have a new quote from ${companyName}</h2>
        <p>Hi ${quote.contacts.name},</p>
        <p>Please find your quote <strong>${quote.quote_number}</strong> below, totalling <strong>£${total.toFixed(2)}</strong>.</p>
        ${quote.expiry_date ? `<p>This quote is valid until <strong>${new Date(quote.expiry_date).toLocaleDateString('en-GB')}</strong>.</p>` : ''}
        <p style="margin: 32px 0;">
          <a href="${quoteLink}" style="background: #343b46; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View and Respond to Quote
          </a>
        </p>
        <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link: ${quoteLink}</p>
      </div>
    `,
  })

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 })

  await supabase.from('sales_quotes').update({ status: 'sent' }).eq('id', quoteId)

  return NextResponse.json({ success: true })
}
