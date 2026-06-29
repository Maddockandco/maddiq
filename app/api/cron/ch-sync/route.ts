import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = await createClient()
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  // Get all company clients with a company number
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company_number, next_accounts_due, next_confirmation_due')
    .eq('type', 'company')
    .not('company_number', 'is', null)

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: 'No company clients to sync' })
  }

  const results = []

  for (const client of clients) {
    try {
      const res = await fetch(
        `https://api.company-information.service.gov.uk/company/${client.company_number}`,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            Accept: 'application/json',
          },
        }
      )

      if (!res.ok) {
        results.push({ id: client.id, name: client.name, error: `CH returned ${res.status}` })
        continue
      }

      const data = await res.json()

      const newAccountsDue = data.accounts?.next_due || null
      const newConfirmationDue = data.confirmation_statement?.next_due || null
      const companyStatus = data.company_status || null

      // Check if anything changed
      const accountsChanged = newAccountsDue !== client.next_accounts_due
      const confirmationChanged = newConfirmationDue !== client.next_confirmation_due

      // Update the client record
      await supabase
        .from('clients')
        .update({
          next_accounts_due: newAccountsDue,
          next_confirmation_due: newConfirmationDue,
          status: companyStatus === 'dissolved' ? 'offboarded' : undefined,
        })
        .eq('id', client.id)

      // If dates changed regenerate deadlines
      if (accountsChanged || confirmationChanged) {
        await supabase.rpc('generate_client_deadlines', { p_client_id: client.id })
      }

      results.push({
        id: client.id,
        name: client.name,
        accounts_due: newAccountsDue,
        confirmation_due: newConfirmationDue,
        accounts_changed: accountsChanged,
        confirmation_changed: confirmationChanged,
      })

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))

    } catch (err: any) {
      results.push({ id: client.id, name: client.name, error: err.message })
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
