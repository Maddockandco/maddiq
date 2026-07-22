import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken, buildFraudPreventionHeaders, hmrcApiRequest } from '@/lib/hmrc'
import { ClientFraudPreventionData } from '@/lib/hmrcFraudPreventionClient'

export async function POST(req: NextRequest) {
  const { clientId, fraudPreventionData } = (await req.json()) as {
    clientId: string
    fraudPreventionData: ClientFraudPreventionData
  }

  if (!clientId || !fraudPreventionData) {
    return NextResponse.json({ error: 'Missing clientId or fraudPreventionData' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
  )

  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: connection } = await userSupabase
    .from('hmrc_connections')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'Not connected to HMRC for this client' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(connection, async (tokens) => {
      await userSupabase.from('hmrc_connections').update({ ...tokens, updated_at: new Date().toISOString() }).eq('id', connection.id)
    })

    // Client's public IP as seen by our server - required for both
    // Gov-Client-Public-IP and as the "for" value in Gov-Vendor-Forwarded.
    const clientPublicIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || ''

    const fraudHeaders = await buildFraudPreventionHeaders(fraudPreventionData, {
      clientPublicIp,
      userId: user.id,
    })

    // Default window: open obligations only. HMRC requires a date range
    // (max 366 days) even when filtering by status.
    const to = new Date()
    const from = new Date()
    from.setFullYear(from.getFullYear() - 1)
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      status: 'O',
    })

    const data = await hmrcApiRequest(
      `/organisations/vat/${connection.vrn}/obligations?${params.toString()}`,
      accessToken,
      fraudHeaders
    )

    return NextResponse.json({ obligations: data.obligations || [] })
  } catch (err: any) {
    await userSupabase.from('hmrc_connections').update({ last_error: err.message, updated_at: new Date().toISOString() }).eq('id', connection.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
