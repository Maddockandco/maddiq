import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { token, action, name, reason } = await request.json()

    if (!token || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: quote, error: fetchError } = await supabase
      .from('quotes')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.status !== 'sent') {
      return NextResponse.json({ error: 'This quote has already been responded to' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown'

    if (action === 'accept') {
      if (!name) {
        return NextResponse.json({ error: 'Name is required to accept' }, { status: 400 })
      }

      let clientId = quote.client_id

      // If linked to a pipeline lead, convert it to a client
      if (quote.pipeline_lead_id && !clientId) {
        const { data: lead } = await supabase
          .from('pipeline_leads')
          .select('*')
          .eq('id', quote.pipeline_lead_id)
          .single()

        if (lead) {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({
              firm_id: quote.firm_id,
              name: lead.company || lead.name,
              type: 'company',
              status: 'onboarding',
              email: lead.email || null,
              phone: lead.phone || null,
            })
            .select()
            .single()

          if (newClient) {
            clientId = newClient.id
            await supabase.from('pipeline_leads').update({ stage: 'won' }).eq('id', lead.id)
          }
        }
      }

      // If standalone prospect, create a new client
      if (!quote.pipeline_lead_id && !quote.client_id && !clientId) {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            firm_id: quote.firm_id,
            name: quote.prospect_company || quote.prospect_name,
            type: 'company',
            status: 'onboarding',
            email: quote.prospect_email || null,
          })
          .select()
          .single()

        if (newClient) clientId = newClient.id
      }

      await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          accepted_name: name,
          accepted_ip: ip,
          client_id: clientId,
        })
        .eq('id', quote.id)

      // Create a proposal record linked to this quote
      await supabase.from('proposals').insert({
        firm_id: quote.firm_id,
        quote_id: quote.id,
        client_id: clientId,
        status: 'accepted',
      })

    } else if (action === 'decline') {
      await supabase
        .from('quotes')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
          decline_reason: reason || null,
        })
        .eq('id', quote.id)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
