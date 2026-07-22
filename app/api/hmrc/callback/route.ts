import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, encryptToken, debugCredentialFingerprint } from '@/lib/hmrc'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const hmrcError = req.nextUrl.searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!state) {
    return NextResponse.redirect(`${appUrl}/clients?hmrc_connect_error=missing_state`)
  }

  const { data: authRequest } = await supabase
    .from('hmrc_auth_requests')
    .select('*')
    .eq('id', state)
    .single()

  if (!authRequest) {
    return NextResponse.redirect(`${appUrl}/clients?hmrc_connect_error=unknown_request`)
  }

  const returnPath = `/accounting/${authRequest.client_id}/vat-return?tab=setup`

  if (hmrcError || !code) {
    await supabase.from('hmrc_auth_requests').delete().eq('id', state)
    return NextResponse.redirect(`${appUrl}${returnPath}&hmrc_connect_error=${hmrcError || 'no_code'}`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const { data: vatSettings } = await supabase
      .from('vat_settings')
      .select('vat_registration_number')
      .eq('client_id', authRequest.client_id)
      .maybeSingle()

    if (!vatSettings?.vat_registration_number) {
      await supabase.from('hmrc_auth_requests').delete().eq('id', state)
      return NextResponse.redirect(`${appUrl}${returnPath}&hmrc_connect_error=no_vrn`)
    }

    await supabase.from('hmrc_connections').upsert(
      {
        firm_id: authRequest.firm_id,
        client_id: authRequest.client_id,
        vrn: vatSettings.vat_registration_number,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        status: 'active',
        last_error: null,
        connected_by: authRequest.requested_by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    )

    await supabase.from('hmrc_auth_requests').delete().eq('id', state)

    return NextResponse.redirect(`${appUrl}${returnPath}&hmrc_connected=1`)
  } catch (err: any) {
    await supabase.from('hmrc_auth_requests').delete().eq('id', state)
    const fingerprint = encodeURIComponent(debugCredentialFingerprint())
    return NextResponse.redirect(`${appUrl}${returnPath}&hmrc_connect_error=${encodeURIComponent(err.message)}&debug=${fingerprint}`)
  }
}
