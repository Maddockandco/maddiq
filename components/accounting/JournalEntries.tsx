'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'

type LineDraft = {
  account_id: string
  debit: string
  credit: string
  description: string
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  opening_balance: 'Opening Balance',
  sales_invoice: 'Sales Invoice',
  sales_invoice_void: 'Invoice Void',
  purchase_bill: 'Purchase Bill',
  purchase_bill_void: 'Bill Void',
  sales_receipt: 'Receipt',
  purchase_payment: 'Payment',
}

export default function JournalEntries({ clientId }: { clientId: string }) {
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedLines, setExpandedLines] = useState<any[]>([])
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId, showAll])

  async function fetchData() {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('client_id', clientId)
      .order('entry_date', { ascending: false })

    if (!showAll) {
      query = query.eq('source', 'manual')
    }

    const entriesResult = await query

    const accountsResult = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (entriesResult.data) setEntries(entriesResult.data)
    if (accountsResult.data) setAccounts(accountsResult.data.filter((a) => a.account_type !== 'bank'))
    setLoading(false)
  }

  async function logAudit(params: {
    entityType: string
    entityId: string
    action: string
    oldData?: any
    newData?: any
    description: string
  }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_action: params.action,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  function addLine() {
    setLines([...lines, { account_id: '', debit: '', credit: '', description: '' }])
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
      setError(`Entry does not balance — Debits £${totalDebit.toFixed(2)} vs Credits £${totalCredit.toFixed(2)}`)
      setSaving(false)
      return
    }

    const validLines = lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
    if (validLines.length < 2) {
      setError('At least two lines with an account and amount are required')
      setSaving(false)
      return
    }

    const accountIds = new Set(accounts.map((a) => a.id))
    const hasInvalidAccount = validLines.some((l) => !accountIds.has(l.account_id))
    if (hasInvalidAccount) {
      setError('One or more selected accounts are not valid for manual journal entries (bank accounts are not allowed here)')
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
        entry_date: entryDate,
        reference: reference || null,
        description: description || null,
        source: 'manual',
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
      description: l.description || null,
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
      action: 'posted',
      newData: { ...entry, lines: insertedLines },
      description: `Posted manual journal entry${reference ? ` "${reference}"` : ''} dated ${new Date(entryDate).toLocaleDateString('en-GB')} — ${validLines.length} lines, £${totalDebit.toFixed(2)} total${description ? `: ${description}` : ''}`,
    })

    setCreating(false)
    setEntryDate(new Date().toISOString().split('T')[0])
    setReference('')
    setDescription('')
    setLines([
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' },
    ])
    fetchData()
    setSaving(false)
  }

  async function toggleExpand(entryId: string) {
    if (expandedId === entryId) {
      setExpandedId(null)
      return
    }
    const { data } = await supabase
      .from('journal_lines')
      .select('*, chart_of_accounts(code, name)')
      .eq('journal_entry_id', entryId)
      .order('sort_order', { ascending: true })
    if (data) setExpandedLines(data)
    setExpandedId(entryId)
  }

  const { totalDebit, totalCredit, isBalanced } = calculateBalance()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading journal entries...</p>
    </div>
  )

  if (accounts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No non-bank accounts available</p>
      <p className="text-gray-400 text-xs">Set up the Chart of Accounts first before posting journal entries</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 text-blue-700 text-xs rounded-lg px-4 py-3">
        This screen is for manual entries only — adjustments, accruals, prepayments, and year-end corrections. Postings from invoices, bills, receipts, and payments are managed on their own screens and won't clutter this list unless you choose to show them below. <strong>Bank accounts cannot be posted to here</strong> — bank movements come from Receipts, Payments, or bank reconciliation. For bringing across existing bank balances when onboarding a client, use the Opening Balances screen instead.
      </div>

      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="rounded" />
          Show system-generated postings too
        </label>
        {can.manageEngagements && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Journal Entry
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New Journal Entry</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <DatePicker value={entryDate} onChange={setEntryDate} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. YE-ADJ-001" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Accrued year-end expenses" className={inputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-4">Account</div>
              <div className="col-span-3">Line description</div>
              <div className="col-span-2">Debit (£)</div>
              <div className="col-span-2">Credit (£)</div>
              <div className="col-span-1"></div>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                  className="col-span-4 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(index, 'description', e.target.value)}
                  className="col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
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
                  className="col-span-1 text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button onClick={addLine} className="text-xs text-brand-dark font-medium hover:underline">
            + Add line
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
              {saving ? 'Posting...' : 'Post journal entry'}
            </button>
            <button onClick={() => setCreating(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">
            {showAll ? 'No journal entries posted yet' : 'No manual journal entries yet — check "Show system-generated postings" to see automatic postings from invoices, bills, receipts, and payments'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleExpand(entry.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-left"
              >
                <div>
                  <p className="text-sm font-medium text-brand-dark">
                    {entry.description || 'Journal entry'}
                    {entry.reference && <span className="text-gray-400 font-normal ml-2">({entry.reference})</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.entry_date).toLocaleDateString('en-GB')} ·{' '}
                    <span className={entry.source === 'manual' ? 'text-brand-dark font-medium' : ''}>
                      {SOURCE_LABELS[entry.source] || entry.source}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-gray-400">{expandedId === entry.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === entry.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase tracking-wider">
                        <th className="text-left pb-2">Account</th>
                        <th className="text-left pb-2">Description</th>
                        <th className="text-right pb-2">Debit</th>
                        <th className="text-right pb-2">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedLines.map((line) => (
                        <tr key={line.id} className="border-t border-gray-200">
                          <td className="py-2 text-brand-dark">
                            {line.chart_of_accounts?.code} — {line.chart_of_accounts?.name}
                          </td>
                          <td className="py-2 text-gray-500">{line.description || '—'}</td>
                          <td className="py-2 text-right font-medium">{line.debit > 0 ? `£${parseFloat(line.debit).toFixed(2)}` : ''}</td>
                          <td className="py-2 text-right font-medium">{line.credit > 0 ? `£${parseFloat(line.credit).toFixed(2)}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
