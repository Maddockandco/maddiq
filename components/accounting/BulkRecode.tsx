'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ConfirmModal from '@/components/ui/ConfirmModal'

const TYPE_TO_CATEGORY: Record<string, string> = {
  bank: 'asset', current_asset: 'asset', fixed_asset: 'asset', inventory: 'asset', non_current_asset: 'asset', prepayment: 'asset',
  current_liability: 'liability', non_current_liability: 'liability', liability: 'liability',
  equity: 'equity',
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}

interface LineRow {
  lineId: string
  parentId: string
  parentTable: 'sales_invoice_lines' | 'purchase_bill_lines'
  parentType: 'sales_invoice' | 'purchase_bill'
  date: string
  reference: string
  contactName: string
  status: string
  description: string
  netAmount: number
  vatAmount: number
  vatRateId: string | null
  vatRateName: string
  inFiledPeriod: { start: string; end: string } | null
}

export default function BulkRecode({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [direction, setDirection] = useState<'sales' | 'purchases'>('purchases')
  const [accounts, setAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [filedPeriods, setFiledPeriods] = useState<{ start: string; end: string }[]>([])

  const [fromAccountId, setFromAccountId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [rows, setRows] = useState<LineRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const [toAccountId, setToAccountId] = useState('')
  const [toVatRateId, setToVatRateId] = useState('')
  const [reason, setReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [resultMessage, setResultMessage] = useState('')

  useEffect(() => { fetchStaticData() }, [clientId, direction])

  async function fetchStaticData() {
    const [accountsRes, vatRes, returnsRes] = await Promise.all([
      supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('vat_returns').select('period_start, period_end').eq('client_id', clientId).eq('status', 'filed'),
    ])
    const category = direction === 'sales' ? 'income' : 'expense'
    setAccounts((accountsRes.data || []).filter((a: any) => TYPE_TO_CATEGORY[a.account_type] === category))
    setVatRates(vatRes.data || [])
    setFiledPeriods((returnsRes.data || []).map((r: any) => ({ start: r.period_start, end: r.period_end })))
    setFromAccountId('')
    setToAccountId('')
    setRows([])
    setSelected(new Set())
    setSearched(false)
  }

  function findFiledPeriod(date: string) {
    return filedPeriods.find((p) => date >= p.start && date <= p.end) || null
  }

  async function handleSearch() {
    if (!fromAccountId) { setError('Select an account to search within'); return }
    setError('')
    setSearching(true)
    setResultMessage('')

    const table = direction === 'sales' ? 'sales_invoice_lines' : 'purchase_bill_lines'
    const accountField = direction === 'sales' ? 'income_account_id' : 'expense_account_id'
    const parentTable = direction === 'sales' ? 'sales_invoices' : 'purchase_bills'
    const dateField = direction === 'sales' ? 'invoice_date' : 'bill_date'
    const refField = direction === 'sales' ? 'invoice_number' : 'bill_number'

    let query = supabase
      .from(table)
      .select(`id, description, quantity, unit_price, line_total, vat_amount, vat_rate_id, vat_rates(name), ${parentTable}!inner(id, ${dateField}, ${refField}, status, client_id, contacts(name))`)
      .eq(accountField, fromAccountId)
      .eq(`${parentTable}.client_id`, clientId)
      .not(`${parentTable}.status`, 'in', '(cancelled,void)')

    if (dateFrom) query = query.gte(`${parentTable}.${dateField}`, dateFrom)
    if (dateTo) query = query.lte(`${parentTable}.${dateField}`, dateTo)

    const { data, error: searchError } = await query.limit(500)
    if (searchError) { setError(searchError.message); setSearching(false); return }

    const mapped: LineRow[] = (data || []).map((l: any) => {
      const parent = l[parentTable]
      const date = parent[dateField]
      return {
        lineId: l.id,
        parentId: parent.id,
        parentTable: table,
        parentType: direction === 'sales' ? 'sales_invoice' : 'purchase_bill',
        date,
        reference: parent[refField],
        contactName: parent.contacts?.name || '—',
        status: parent.status,
        description: l.description,
        netAmount: parseFloat(l.line_total),
        vatAmount: parseFloat(l.vat_amount),
        vatRateId: l.vat_rate_id,
        vatRateName: l.vat_rates?.name || '—',
        inFiledPeriod: findFiledPeriod(date),
      }
    })

    setRows(mapped)
    setSelected(new Set())
    setSearching(false)
    setSearched(true)
  }

  function toggleRow(lineId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.lineId))))
  }

  const selectedRows = rows.filter((r) => selected.has(r.lineId))
  const affectedFiledCount = selectedRows.filter((r) => r.inFiledPeriod).length

  async function handleApply() {
    if (!reason.trim()) { setError('A reason is required'); return }
    if (!toAccountId && !toVatRateId) { setError('Choose a new account and/or a new VAT rate'); return }

    setApplying(true)
    setError('')

    const newRate = toVatRateId ? vatRates.find((r) => r.id === toVatRateId) : null
    const accountField = direction === 'sales' ? 'income_account_id' : 'expense_account_id'
    const table = direction === 'sales' ? 'sales_invoice_lines' : 'purchase_bill_lines'

    const byParent = new Map<string, LineRow[]>()
    for (const row of selectedRows) {
      byParent.set(row.parentId, [...(byParent.get(row.parentId) || []), row])
    }

    for (const [parentId, parentRows] of Array.from(byParent.entries())) {
      for (const row of parentRows) {
        const updatePayload: any = {}
        if (toAccountId) updatePayload[accountField] = toAccountId
        if (toVatRateId && newRate) {
          updatePayload.vat_rate_id = toVatRateId
          updatePayload.vat_amount = Math.round(row.netAmount * (parseFloat(newRate.rate) / 100) * 100) / 100
        }
        await supabase.from(table).update(updatePayload).eq('id', row.lineId)
      }

      const fromAccountName = accounts.find((a) => a.id === fromAccountId)?.name || 'previous account'
      const toAccountName = toAccountId ? accounts.find((a) => a.id === toAccountId)?.name : null
      const filedNote = parentRows.some((r) => r.inFiledPeriod)
        ? ' — includes line(s) already captured in a filed VAT return; check Error Corrections if the VAT rate changed.'
        : ''

      await supabase.rpc('log_accounting_audit', {
        p_client_id: clientId,
        p_entity_type: direction === 'sales' ? 'sales_invoice' : 'purchase_bill',
        p_entity_id: parentId,
        p_action: 'bulk_recoded',
        p_old_data: { account: fromAccountName },
        p_new_data: { account: toAccountName, vat_rate: newRate?.name || null },
        p_description: `Bulk recoded ${parentRows.length} line(s) from "${fromAccountName}"${toAccountName ? ` to "${toAccountName}"` : ''}${newRate ? `, VAT rate to ${newRate.name}` : ''} — reason: ${reason.trim()}${filedNote}`,
      })
    }

    setShowConfirm(false)
    setApplying(false)
    setResultMessage(`Recoded ${selectedRows.length} line(s) across ${byParent.size} document(s).`)
    setToAccountId('')
    setToVatRateId('')
    setReason('')
    handleSearch()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Bulk Recode Transactions</h3>
        <p className="text-sm text-gray-500 mt-1">
          Move a batch of transactions to a different account and/or VAT rate at once — works on drafts and already-approved
          transactions alike. Anything already captured in a filed VAT return is flagged before you commit.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['purchases', 'sales'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`text-sm font-medium px-4 py-2 rounded-md transition capitalize ${direction === d ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account to search within</label>
            <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={inputClass}>
              <option value="">Select account...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date from (optional)</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date to (optional)</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
        {resultMessage && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">{resultMessage}</div>}

        <button onClick={handleSearch} disabled={searching} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
          {searching ? 'Searching...' : 'Find Transactions'}
        </button>
      </div>

      {searched && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 p-4 text-sm text-gray-500">
            {rows.length === 0 ? 'No transactions found for that account/date range.' : `${rows.length} line(s) found`}
          </div>

          {rows.length > 0 && (
            <>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left"><input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} /></th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Reference</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Contact</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Net</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">VAT</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.lineId} className="border-t border-gray-100">
                        <td className="px-4 py-2"><input type="checkbox" checked={selected.has(r.lineId)} onChange={() => toggleRow(r.lineId)} /></td>
                        <td className="px-4 py-2 text-brand-dark">{new Date(r.date).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-2 font-mono text-brand-dark">{r.reference}</td>
                        <td className="px-4 py-2 text-brand-dark">{r.contactName}</td>
                        <td className="px-4 py-2 text-gray-600">{r.description}</td>
                        <td className="px-4 py-2 text-right text-brand-dark">£{r.netAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-brand-dark">£{r.vatAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-500">{r.vatRateName}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 capitalize">{r.status}</span>
                          {r.inFiledPeriod && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 ml-1">
                              Filed {new Date(r.inFiledPeriod.start).toLocaleDateString('en-GB')}–{new Date(r.inFiledPeriod.end).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {can.manageEngagements && (
                <div className="border-t border-gray-200 p-4 bg-brand-light space-y-3">
                  <p className="text-sm text-brand-dark font-medium">{selected.size} selected</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Move to account (optional)</label>
                      <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputClass}>
                        <option value="">No change</option>
                        {accounts.filter((a) => a.id !== fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Change VAT rate to (optional)</label>
                      <select value={toVatRateId} onChange={(e) => setToVatRateId(e.target.value)} className={inputClass}>
                        <option value="">No change</option>
                        {vatRates.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Reason (required)</label>
                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. These were miscoded to the wrong expense account" className={inputClass} />
                  </div>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={selected.size === 0}
                    className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-40"
                  >
                    Apply to {selected.size} selected
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Apply this bulk recode?"
        message={`This changes ${selected.size} line(s) across ${new Set(selectedRows.map((r) => r.parentId)).size} document(s).${affectedFiledCount > 0 ? ` ${affectedFiledCount} of these are already captured in a filed VAT return — if the VAT rate changes on those, a correction will be logged automatically for review in Error Corrections.` : ''}`}
        confirmLabel={applying ? 'Applying...' : 'Apply Recode'}
        confirming={applying}
        danger={affectedFiledCount > 0}
        onConfirm={handleApply}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
