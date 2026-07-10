import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAccountTransactions } from '@/lib/enableBanking'

export async function POST(req: NextRequest) {
  const { connectionId } = await req.json()
  if (!connectionId) {
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
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

  const { data: connection } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  if (!connection.enable_banking_account_id) {
    return NextResponse.json({ error: 'This connection has no linked account yet' }, { status: 400 })
  }

  try {
    const dateFrom = connection.last_synced_at
      ? connection.last_synced_at.split('T')[0]
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const result = await getAccountTransactions(connection.enable_banking_account_id, dateFrom)
    const transactions = result.transactions || []

    const { data: existing } = await supabase
      .from('bank_transactions')
      .select('reference')
      .eq('bank_account_id', connection.bank_account_id)
      .not('reference', 'is', null)

    const existingRefs = new Set((existing || []).map((t: any) => t.reference))

    const rowsToInsert = transactions
      .map((t: any) => {
        const ref = t.entry_reference || t.transaction_id || `${t.booking_date}-${t.transaction_amount?.amount}-${t.remittance_information?.[0] || ''}`
        const amount = parseFloat(t.transaction_amount?.amount || '0')
        const isCredit = t.credit_debit_indicator === 'CRDT'
        return {
          firm_id: connection.firm_id,
          client_id: connection.client_id,
          bank_account_id: connection.bank_account_id,
          transaction_date: t.booking_date || t.value_date,
          description: (t.remittance_information || []).join(' ') || t.creditor?.name || t.debtor?.name || 'Bank transaction',
          reference: ref,
          amount: isCredit ? Math.abs(amount) : -Math.abs(amount),
          status: 'unreconciled',
          created_by: null,
        }
      })
      .filter((r: any) => r.transaction_date && !existingRefs.has(r.reference))

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('bank_transactions').insert(rowsToInsert)
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    await supabase
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId)

    return NextResponse.json({ imported: rowsToInsert.length, total_fetched: transactions.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
