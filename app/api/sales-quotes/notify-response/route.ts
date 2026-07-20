import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { quoteId, response } = await request.json()
  if (!quoteId || !response) return NextResponse.json({ error: 'quoteId and response are required' }, { status: 400 })

  const { data: quote, error: quoteError } = await supabase
    .from('sales_quotes')
    .select('*, contacts(name), clients(name)')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  // The quote's creator is who should hear about this, not the customer who just responded
  if (!quote.created_by) return NextResponse.json({ success: true, note: 'No creator on record to notify' })

  const { data: creatorData } = await supabase.auth.admin.getUserById(quote.created_by)
  const creatorEmail = creatorData?.user?.email
  if (!creatorEmail) return NextResponse.json({ success: true, note: 'Creator has no email on file' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maddiq.vercel.app'
  const accepted = response === 'accepted'
  const quoteDetailLink = accepted && quote.converted_to_sales_order_id
    ? `${appUrl}/accounting/${quote.client_id}/sales-orders/${quote.converted_to_sales_order_id}`
    : `${appUrl}/accounting/${quote.client_id}/sales-quotes/${quoteId}`

  const { error: sendError } = await resend.emails.send({
    from: 'hello@maddockandco.com',
    to: creatorEmail,
    subject: `Quote ${quote.quote_number} ${accepted ? 'accepted' : 'declined'} by ${quote.contacts?.name || 'customer'}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: ${accepted ? '#15803d' : '#dc2626'};">
          ${quote.contacts?.name || 'The customer'} has ${accepted ? 'accepted' : 'declined'} quote ${quote.quote_number}
        </h2>
        <p>Client: <strong>${quote.clients?.name || ''}</strong></p>
        ${accepted ? '<p>A Sales Order has been created automatically and is ready to go.</p>' : ''}
        <p style="margin: 32px 0;">
          <a href="${quoteDetailLink}" style="background: #343b46; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            {accepted ? 'View Sales Order' : 'View Quote'}
          </a>
        </p>
      </div>
    `,
  })

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
