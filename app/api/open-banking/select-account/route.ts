import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { authRequestId, accountIndex } = await req.json()

  if (!authRequestId || accountIndex === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const supabase = bearerToken
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
    : await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: authRequest } = await supabase
    .from('bank_auth_requests')
    .select('*')
    .eq('id', authRequestId)
    .single()

  if (!authRequest || !authRequest.accounts_json) {
    return NextResponse.json({ error: 'Request not found or has expired' }, { status: 404 })
  }

  const account = authRequest.accounts_json[accountIndex]
  if (!account) {
    return NextResponse.json({ error: 'Invalid account selection' }, { status: 400 })
  }

  const { error: insertError } = await supabase.from('bank_connections').insert({
    firm_id: authRequest.firm_id,
    client_id: authRequest.client_id,
    bank_account_id: authRequest.bank_account_id,
    aspsp_name: authRequest.aspsp_name,
    aspsp_country: authRequest.aspsp_country,
    aspsp_logo_url: authRequest.aspsp_logo_url,
    session_id: authRequest.session_id,
    enable_banking_account_id: account?.uid || account?.account_id?.iban || null,
    iban: account?.account_id?.iban || null,
    status: 'active',
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  await supabase.from('bank_auth_requests').delete().eq('id', authRequestId)

  return NextResponse.json({ success: true })
}
