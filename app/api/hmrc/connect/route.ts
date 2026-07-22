import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { buildAuthorizationUrl } from '@/lib/hmrc'

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const supabase = bearerToken
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
    : await createClient()

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

  const { data: vatSettings } = await supabase
    .from('vat_settings')
    .select('vat_registration_number')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!vatSettings?.vat_registration_number) {
    return NextResponse.json({ error: 'Set a VAT Registration Number in VAT Setup before connecting to HMRC' }, { status: 400 })
  }

  const { data: authRequest, error: insertError } = await supabase
    .from('hmrc_auth_requests')
    .insert({ firm_id: firmUser.firm_id, client_id: clientId, requested_by: user.id })
    .select()
    .single()

  if (insertError || !authRequest) {
    return NextResponse.json({ error: insertError?.message || 'Could not start connection' }, { status: 500 })
  }

  return NextResponse.json({ url: buildAuthorizationUrl(authRequest.id) })
}
