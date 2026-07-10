import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/enableBanking'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const bankError = req.nextUrl.searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!state) {
    return NextResponse.redirect(`${appUrl}/accounting?bank_connect_error=missing_state`)
  }

  const supabase = await createClient()

  const { data: authRequest } = await supabase
    .from('bank_auth_requests')
    .select('*')
    .eq('id', state)
    .single()

  if (!authRequest) {
    return NextResponse.redirect(`${appUrl}/accounting?bank_connect_error=unknown_request`)
  }

  const returnPath = `/accounting/${authRequest.client_id}/bank-transactions`

  if (bankError || !code) {
    return NextResponse.redirect(`${appUrl}${returnPath}?bank_connect_error=${bankError || 'no_code'}`)
  }

  try {
    const session = await createSession(code)
    const account = session.accounts?.[0]

    await supabase.from('bank_connections').insert({
      firm_id: authRequest.firm_id,
      client_id: authRequest.client_id,
      bank_account_id: authRequest.bank_account_id,
      aspsp_name: authRequest.aspsp_name,
      aspsp_country: authRequest.aspsp_country,
      session_id: session.session_id,
      enable_banking_account_id: account?.uid || account?.account_id?.iban || null,
      iban: account?.account_id?.iban || null,
      status: 'active',
      valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })

    await supabase.from('bank_auth_requests').delete().eq('id', state)

    return NextResponse.redirect(`${appUrl}${returnPath}?bank_connected=1`)
  } catch (err: any) {
    return NextResponse.redirect(`${appUrl}${returnPath}?bank_connect_error=${encodeURIComponent(err.message)}`)
  }
}
