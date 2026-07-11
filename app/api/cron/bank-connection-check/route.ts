import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fourteenDaysFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: connections, error } = await supabase
    .from('bank_connections')
    .select('id, firm_id, client_id, aspsp_name, valid_until, clients(name)')
    .eq('status', 'active')
    .lte('valid_until', fourteenDaysFromNow)
    .gte('valid_until', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: 'No connections expiring soon', count: 0 })
  }

  const byFirm: Record<string, any[]> = {}
  connections.forEach((c: any) => {
    if (!byFirm[c.firm_id]) byFirm[c.firm_id] = []
    byFirm[c.firm_id].push(c)
  })

  const results = []

  for (const [firmId, firmConnections] of Object.entries(byFirm)) {
    try {
      const { data: owners } = await supabase
        .from('firm_users')
        .select('user_id')
        .eq('firm_id', firmId)
        .in('role', ['practice_owner', 'practice_manager'])

      if (!owners || owners.length === 0) {
        results.push({ firmId, error: 'No practice owner/manager found to notify' })
        continue
      }

      const emails: string[] = []
      for (const owner of owners) {
        const { data: userData } = await supabase.auth.admin.getUserById(owner.user_id)
        if (userData?.user?.email) emails.push(userData.user.email)
      }

      if (emails.length === 0) {
        results.push({ firmId, error: 'No email addresses found for practice owner/manager' })
        continue
      }

      const listItems = firmConnections
        .map((c: any) => {
          const days = Math.ceil((new Date(c.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          return `<li style="margin-bottom: 8px;"><strong>${c.clients?.name || 'Unknown client'}</strong> — ${c.aspsp_name}, expires in ${days} day${days === 1 ? '' : 's'}</li>`
        })
        .join('')

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Maddiq <hello@maddockandco.com>',
          to: emails,
          subject: `${firmConnections.length} bank connection${firmConnections.length === 1 ? '' : 's'} expiring soon`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #343b46; font-size: 22px;">Bank connections expiring soon</h1>
              <p style="color: #666; font-size: 15px; line-height: 1.6;">
                The following client bank connections will need reconnecting soon to keep automatic transaction syncing working:
              </p>
              <ul style="color: #343b46; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                ${listItems}
              </ul>
              <p style="color: #666; font-size: 15px; line-height: 1.6;">
                Reconnect from each client's Dashboard in Maddiq — look for the "Reconnect" button on the affected bank account.
              </p>
            </div>
          `,
        }),
      })

      results.push({
        firmId,
        connectionsCount: firmConnections.length,
        emailsSent: emails.length,
        emailStatus: emailResponse.status,
      })
    } catch (err: any) {
      results.push({ firmId, error: err.message })
    }
  }

  return NextResponse.json({
    firmsNotified: results.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
