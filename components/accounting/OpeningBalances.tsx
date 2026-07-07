'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'

type LineDraft = {
  account_id: string
  debit: string
  credit: string
}

export default function OpeningBalances({ clientId }: { clientId: string }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [existingEntries, setExistingEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [conversionDate, setConversionDate] = useState(new Date().toISOString().split('T')[0])
  const [lines, setLines] = useState<LineDraft[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const accountsResult = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('code', { ascending: true })

    const entriesResult = await supabase
      .from('journal_entries')
      .select('*')
      .eq('client_id', clientId)
      .eq('source', 'opening_balance')
      .order('entry_date', { ascending: false })

    if (accountsResult.data) setAccounts(accountsResult.data)
    if (entriesResult.data) setExistingEntries(entriesResult.data)
    setLoading(false)
  }

  async function logAudit(params: {
    entityType: string
    entityId: string
    action: string
    newData?: any
    description: string
  }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_action: params.action,
      p_old_data: null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  function addLine() {
    setLines([...lines, { account_id: '', debit: '', credit: '' }])
  }

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  function calculateBalance() {
    let totalDebit = 0
    let totalCredit = 0
    lines.forEach((l) => {
      totalDebit += parseFloat(l.debit) || 0
      totalCredit += parseFloat(l.credit) || 0
    })
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0 }
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const { totalDebit, totalCredit, isBalanced } = calculateBalance()

    if (!isBalanced) {
      setError(`Opening balances do not balance — Debits £${totalDebit.toFixed(2)} vs Credits £${totalCredit.toFixed(2)}. This should match your client's trial balance as at the conversion date exactly.`)
      setSaving(false)
      return
    }

    const validLines = lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
    if (validLines.length < 1) {
      setError('At least one account with a balance is required')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: conversionDate,
        reference: 'OPENING',
        description: `Opening balances as at ${new Date(conversionDate).toLocaleDateString('en-GB')}`,
        source: 'opening_balance',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) { setError(entryError.message); setSaving(false); return }

    const linesToInsert = validLines.map((l, i) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: 'Opening balance',
      sort_order: i,
    }))

    const { data: insertedLines, error: linesError } = await supabase
      .from('journal_lines')
      .insert(linesToInsert)
      .select('*, chart_of_accounts(code, name)')

    if (linesError) { setError(linesError.message); setSaving(false); return }

    await logAudit({
      entityType: 'journal_entry',
      entityId: entry.id,
      action: 'opening_balances_recorded',
      newData: { ...entry, lines: insertedLines },
      description: `Recorded opening balances as at ${new Date(conversionDate).toLocaleDateString('en-GB')} — ${validLines.length} accounts, £${totalDebit.toFixed(2)} total`,
    })

    setCreating(false)
    setConversionDate(new Date().toISOString().split('T')[0])
    setLines([
      { account_id: '', debit: '', credit: '' },
      { account_id: '', debit: '', credit: '' },
    ])
    fetchData()
    setSaving(false)
  }

  const { totalDebit, totalCredit, isBalanced } = calculateBalance()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading opening balances...</p>
    </div>
  )

  if (accounts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No accounts available</p>
      <p className="text-gray-400 text-xs">Set up the Chart of Accounts first before entering opening balances</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 text-blue-700 text-xs rounded-lg px-4 py-3">
        Use this screen once, when bringing a client's existing books onto Maddiq — enter the full trial balance from their previous system as at the conversion date, including bank balances. This is the only place bank accounts can be posted to manually.
      </div>

      {existingEntries.length > 0 && (
        <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-4 py-3">
          Opening balances have already been recorded for this client (most recently {new Date(existingEntries[0].entry_date).toLocaleDateString('en-GB')}). Adding another set here will add to the ledger rather than replace the existing one — check Journal Entries (with "show system-generated postings" ticked) if you're not sure what's already there.
        </div>
      )}

      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + Enter Opening Balances
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Opening Balances</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Conversion date</label>
            <DatePicker value={conversionDate} onChange={setConversionDate} className="max-w-xs" />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-6">Account</div>
              <div className="col-span-2">Debit (£)</div>
              <div className="col-span-2">Credit (£)</div>
              <div className="col-span-2"></div>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                  className="col-span-6 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={line.debit}
                  onChange={(e) => updateLine(index, 'debit', e.target.value)}
                  placeholder="0.00"
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
                <input
                  type="number"
                  value={line.credit}
                  onChange={(e) => updateLine(index, 'credit', e.target.value)}
                  placeholder="0.00"
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
                <button
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 2}
                  className="col-span-2 text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                >
                  ✕ Remove
                </button>
              </div>
            ))}
          </div>

          <button onClick={addLine} className="text-xs text-brand-dark font-medium hover:underline">
            + Add account
          </button>

          <div className={`rounded-xl p-4 flex justify-between items-center ${isBalanced ? 'bg-green-50' : 'bg-amber-50'}`}>
            <div className="text-sm">
              <span className="text-gray-500">Debits: </span>
              <span className="font-semibold text-brand-dark">£{totalDebit.toFixed(2)}</span>
              <span className="text-gray-500 ml-4">Credits: </span>
              <span className="font-semibold text-brand-dark">£{totalCredit.toFixed(2)}</span>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {isBalanced ? '✓ Balanced' : 'Not balanced'}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !isBalanced}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save opening balances'}
            </button>
            <button onClick={() => setCreating(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {existingEntries.length > 0 && !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Conversion date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {existingEntries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(e.entry_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-3 text-sm text-brand-dark">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
