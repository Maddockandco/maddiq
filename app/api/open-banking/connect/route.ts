import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startAuthorization } from '@/lib/enableBanking'

export async function POST(req: NextRequest) {
  const { clientId, bankAccountId, aspspName, aspspCountry } = await req.json()

  if (!clientId || !bankAccountId || !aspspName || !aspspCountry) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: firmUser } = await supabase
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .single()

  if (!firmUser) {
    return NextResponse.json({ error: 'Could not find your firm' }, { status: 400 })
  }

  const { data: authRequest, error: insertError } = await supabase
    .from('bank_auth_requests')
    .insert({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      bank_account_id: bankAccountId,
      aspsp_name: aspspName,
      aspsp_country: aspspCountry,
    })
    .select()
    .single()

  if (insertError || !authRequest) {
    return NextResponse.json({ error: insertError?.message || 'Could not start connection' }, { status: 500 })
  }

  try {
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/open-banking/callback`
    const result = await startAuthorization({
      aspspName,
      aspspCountry,
      redirectUrl,
      state: authRequest.id,
    })
    return NextResponse.json({ url: result.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
