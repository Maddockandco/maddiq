import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, company_number, next_accounts_due, next_confirmation_due, firm_id')
    .eq('type', 'company')
    .not('company_number', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: 'No company clients to sync', count: 0 })
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

      const accountsChanged = newAccountsDue !== client.next_accounts_due
      const confirmationChanged = newConfirmationDue !== client.next_confirmation_due

      await supabase
        .from('clients')
        .update({
          next_accounts_due: newAccountsDue,
          next_confirmation_due: newConfirmationDue,
        })
        .eq('id', client.id)

      if (accountsChanged || confirmationChanged) {
        await supabase.rpc('generate_client_deadlines', { p_client_id: client.id })
      }

      results.push({
        id: client.id,
        name: client.name,
        company_number: client.company_number,
        accounts_due: newAccountsDue,
        confirmation_due: newConfirmationDue,
        accounts_changed: accountsChanged,
        confirmation_changed: confirmationChanged,
        company_status: companyStatus,
      })

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
