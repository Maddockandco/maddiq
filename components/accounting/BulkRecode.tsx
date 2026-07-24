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

const STATUS_OPTIONS = ['draft', 'awaiting_payment', 'partially_paid', 'paid']

type ConditionField = 'status' | 'account' | 'date' | 'total' | 'tax_rate' | 'contact' | 'reference' | 'entered_by'

interface Condition {
  id: string
  field: ConditionField
  value: string
  value2: string // used for date/total ranges
}

interface LineRow {
  lineId: string
  parentId: string
  date: string
  reference: string
  contactName: string
  status: string
  description: string
  currentAccountCode: string
  currentAccountName: string
  netAmount: number
  vatAmount: number
  vatRateName: string
  inFiledPeriod: { start: string; end: string } | null
}

const FIELD_LABELS: Record<ConditionField, string> = {
  status: 'Status',
  account: 'Account',
  date: 'Date',
  total: 'Transaction Total',
  tax_rate: 'Tax Rate',
  contact: 'Contact',
  reference: 'Invoice Number / Reference',
  entered_by: 'Entered By',
}

export default function BulkRecode({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [view, setView] = useState<'find' | 'history'>('find')
  const [direction, setDirection] = useState<'sales' | 'purchases'>('purchases')
  const [accounts, setAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [firmUsers, setFirmUsers] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [openContactDropdown, setOpenContactDropdown] = useState<string | null>(null)
  const [filedPeriods, setFiledPeriods] = useState<{ start: string; end: string }[]>([])

  const [matchAll, setMatchAll] = useState(true)
  const [conditions, setConditions] = useState<Condition[]>([{ id: crypto.randomUUID(), field: 'account', value: '', value2: '' }])

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

  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => { fetchStaticData() }, [clientId, direction])

  async function fetchStaticData() {
    const [accountsRes, vatRes, returnsRes, usersRes, contactsRes] = await Promise.all([
      supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('vat_returns').select('period_start, period_end').eq('client_id', clientId).eq('status', 'filed'),
      supabase.from('firm_users').select('user_id, full_name').eq('is_active', true),
      supabase.from('contacts').select('id, name').eq('client_id', clientId).eq(direction === 'sales' ? 'is_customer' : 'is_supplier', true).eq('is_active', true).order('name'),
    ])
    const category = direction === 'sales' ? 'income' : 'expense'
    setAccounts((accountsRes.data || []).filter((a: any) => TYPE_TO_CATEGORY[a.account_type] === category))
    setVatRates(vatRes.data || [])
    setFiledPeriods((returnsRes.data || []).map((r: any) => ({ start: r.period_start, end: r.period_end })))
    setFirmUsers(usersRes.data || [])
    setContacts(contactsRes.data || [])
    setRows([])
    setSelected(new Set())
    setSearched(false)
  }

  async function fetchHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('accounting_audit_log')
      .select('*')
      .eq('client_id', clientId)
      .eq('action', 'bulk_recoded')
      .order('created_at', { ascending: false })
      .limit(100)
    setHistory(data || [])
    setLoadingHistory(false)
  }

  function findFiledPeriod(date: string) {
    return filedPeriods.find((p) => date >= p.start && date <= p.end) || null
  }

  function addCondition() {
    setConditions((prev) => [...prev, { id: crypto.randomUUID(), field: 'status', value: '', value2: '' }])
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCondition(id: string, patch: Partial<Condition>) {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  // Applies one condition's filter to a query. Used both for AND-chaining all
  // conditions onto one query, and for running each condition as its own
  // independent query in OR mode (safer/more reliable than trying to build
  // one cross-table OR filter string by hand).
  function applyCondition(query: any, condition: Condition, parentTable: string, dateField: string, refField: string) {
    switch (condition.field) {
      case 'status':
        return condition.value ? query.eq(`${parentTable}.status`, condition.value) : query
      case 'account': {
        const accountField = direction === 'sales' ? 'income_account_id' : 'expense_account_id'
        return condition.value ? query.eq(accountField, condition.value) : query
      }
      case 'date': {
        let q = query
        if (condition.value) q = q.gte(`${parentTable}.${dateField}`, condition.value)
        if (condition.value2) q = q.lte(`${parentTable}.${dateField}`, condition.value2)
        return q
      }
      case 'total': {
        let q = query
        if (condition.value) q = q.gte('line_total', parseFloat(condition.value))
        if (condition.value2) q = q.lte('line_total', parseFloat(condition.value2))
        return q
      }
      case 'tax_rate':
        return condition.value ? query.eq('vat_rate_id', condition.value) : query
      case 'reference':
        return condition.value ? query.ilike(`${parentTable}.${refField}`, `%${condition.value}%`) : query
      case 'entered_by':
        return condition.value ? query.eq(`${parentTable}.created_by`, condition.value) : query
      default:
        return query
    }
  }

  async function handleSearch() {
    setError('')
    setSearching(true)
    setResultMessage('')

    const table = direction === 'sales' ? 'sales_invoice_lines' : 'purchase_bill_lines'
    const parentTable = direction === 'sales' ? 'sales_invoices' : 'purchase_bills'
    const dateField = direction === 'sales' ? 'invoice_date' : 'bill_date'
    const refField = direction === 'sales' ? 'invoice_number' : 'bill_number'
    const accountField = direction === 'sales' ? 'income_account_id' : 'expense_account_id'
    const selectCols = `id, description, quantity, unit_price, line_total, vat_amount, vat_rate_id, vat_rates(name), chart_of_accounts!${accountField}(code, name), ${parentTable}!inner(id, ${dateField}, ${refField}, status, client_id, contact_id, contacts(name))`

    // "Contact" - if a specific contact was picked from the autocomplete,
    // filter on that id directly (precise). Otherwise fall back to matching
    // by whatever's been typed, in case someone didn't pick a suggestion.
    const contactCondition = conditions.find((c) => c.field === 'contact' && (c.value2 || c.value))
    let contactIds: string[] | null = null
    if (contactCondition) {
      if (contactCondition.value2) {
        contactIds = [contactCondition.value2]
      } else {
        const { data: matches } = await supabase.from('contacts').select('id').eq('client_id', clientId).ilike('name', `%${contactCondition.value}%`)
        contactIds = (matches || []).map((c: any) => c.id)
      }
      if (contactIds.length === 0) {
        setRows([]); setSelected(new Set()); setSearching(false); setSearched(true)
        return
      }
    }

    const otherConditions = conditions.filter((c) => c.field !== 'contact' && (c.value || c.field === 'date' || c.field === 'total'))
      .filter((c) => c.value || c.value2)

    function baseQuery() {
      let q = supabase
        .from(table)
        .select(selectCols)
        .eq(`${parentTable}.client_id`, clientId)
        .not(`${parentTable}.status`, 'in', '(cancelled,void)')
      if (contactIds) q = q.in(`${parentTable}.contact_id`, contactIds)
      return q
    }

    let data: any[] = []
    let searchError: any = null

    if (otherConditions.length === 0) {
      const res = await baseQuery().limit(500)
      data = res.data || []
      searchError = res.error
    } else if (matchAll) {
      let q = baseQuery()
      for (const c of otherConditions) q = applyCondition(q, c, parentTable, dateField, refField)
      const res = await q.limit(500)
      data = res.data || []
      searchError = res.error
    } else {
      // ANY: run each condition as its own query, union the results by line id
      const seen = new Map<string, any>()
      for (const c of otherConditions) {
        const q = applyCondition(baseQuery(), c, parentTable, dateField, refField)
        const res = await q.limit(500)
        if (res.error) { searchError = res.error; break }
        for (const row of res.data || []) seen.set(row.id, row)
      }
      data = Array.from(seen.values())
    }

    if (searchError) { setError(searchError.message); setSearching(false); return }

    const mapped: LineRow[] = data.map((l: any) => {
      const parent = l[parentTable]
      const date = parent[dateField]
      return {
        lineId: l.id,
        parentId: parent.id,
        date,
        reference: parent[refField],
        contactName: parent.contacts?.name || '—',
        status: parent.status,
        description: l.description,
        currentAccountCode: l.chart_of_accounts?.code || '',
        currentAccountName: l.chart_of_accounts?.name || '—',
        netAmount: parseFloat(l.line_total),
        vatAmount: parseFloat(l.vat_amount),
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

      const toAccountName = toAccountId ? accounts.find((a) => a.id === toAccountId)?.name : null
      const filedNote = parentRows.some((r) => r.inFiledPeriod)
        ? ' — includes line(s) already captured in a filed VAT return; check Error Corrections if the VAT rate changed.'
        : ''

      await supabase.rpc('log_accounting_audit', {
        p_client_id: clientId,
        p_entity_type: direction === 'sales' ? 'sales_invoice' : 'purchase_bill',
        p_entity_id: parentId,
        p_action: 'bulk_recoded',
        p_old_data: null,
        p_new_data: { account: toAccountName, vat_rate: newRate?.name || null },
        p_description: `Bulk recoded ${parentRows.length} line(s)${toAccountName ? ` to account "${toAccountName}"` : ''}${newRate ? `, VAT rate to ${newRate.name}` : ''} — reason: ${reason.trim()}${filedNote}`,
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

  function renderConditionValueInputs(c: Condition) {
    switch (c.field) {
      case 'status':
        return (
          <select value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )
      case 'account':
        return (
          <select value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass}>
            <option value="">Any account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        )
      case 'tax_rate':
        return (
          <select value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass}>
            <option value="">Any rate</option>
            {vatRates.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )
      case 'entered_by':
        return (
          <select value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass}>
            <option value="">Anyone</option>
            {firmUsers.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
          </select>
        )
      case 'date':
        return (
          <div className="flex gap-2">
            <input type="date" value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass} placeholder="From" />
            <input type="date" value={c.value2} onChange={(e) => updateCondition(c.id, { value2: e.target.value })} className={inputClass} placeholder="To" />
          </div>
        )
      case 'total':
        return (
          <div className="flex gap-2">
            <input type="number" value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass} placeholder="Min £" />
            <input type="number" value={c.value2} onChange={(e) => updateCondition(c.id, { value2: e.target.value })} className={inputClass} placeholder="Max £" />
          </div>
        )
      case 'contact': {
        const matches = c.value.length > 0
          ? contacts.filter((ct) => ct.name.toLowerCase().includes(c.value.toLowerCase())).slice(0, 8)
          : []
        return (
          <div className="relative">
            <input
              type="text"
              value={c.value}
              onChange={(e) => {
                updateCondition(c.id, { value: e.target.value, value2: '' })
                setOpenContactDropdown(c.id)
              }}
              onFocus={() => setOpenContactDropdown(c.id)}
              onBlur={() => setTimeout(() => setOpenContactDropdown((cur) => (cur === c.id ? null : cur)), 150)}
              className={inputClass}
              placeholder="Start typing a contact name..."
            />
            {openContactDropdown === c.id && matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {matches.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => { updateCondition(c.id, { value: ct.name, value2: ct.id }); setOpenContactDropdown(null) }}
                    className="block w-full text-left px-3 py-2 text-sm text-brand-dark hover:bg-gray-50 transition"
                  >
                    {ct.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      }
      case 'reference':
        return <input type="text" value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })} className={inputClass} placeholder="Reference contains..." />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Bulk Recode Transactions</h3>
          <p className="text-sm text-gray-500 mt-1">
            Find transactions by any combination of conditions and move them to a new account and/or VAT rate at once.
            Anything already captured in a filed VAT return is flagged before you commit.
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView('find')} className={`text-sm font-medium px-4 py-2 rounded-md transition ${view === 'find' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
            Find & Recode
          </button>
          <button onClick={() => { setView('history'); fetchHistory() }} className={`text-sm font-medium px-4 py-2 rounded-md transition ${view === 'history' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
            Recode History
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loadingHistory ? (
            <p className="text-sm text-gray-400 p-6">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">No bulk recodes yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((h) => (
                <div key={h.id} className="p-4">
                  <p className="text-sm text-brand-dark">{h.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(h.created_at).toLocaleString('en-GB')} · {h.performed_by_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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

            <div className="flex items-center gap-2 text-sm text-brand-dark">
              <span>Find transactions that match</span>
              <select value={matchAll ? 'all' : 'any'} onChange={(e) => setMatchAll(e.target.value === 'all')} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                <option value="all">All</option>
                <option value="any">Any</option>
              </select>
              <span>of the following conditions:</span>
            </div>

            <div className="space-y-2">
              {conditions.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <select
                    value={c.field}
                    onChange={(e) => updateCondition(c.id, { field: e.target.value as ConditionField, value: '', value2: '' })}
                    className="w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm flex-shrink-0"
                  >
                    {(Object.keys(FIELD_LABELS) as ConditionField[]).map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                  </select>
                  <div className="flex-1">{renderConditionValueInputs(c)}</div>
                  <button onClick={() => removeCondition(c.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0 px-2">✕</button>
                </div>
              ))}
            </div>

            <button onClick={addCondition} className="text-sm text-brand-dark font-medium hover:underline">
              + Add condition
            </button>

            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
            {resultMessage && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">{resultMessage}</div>}

            <button onClick={handleSearch} disabled={searching} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searched && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-100 p-4 text-sm text-gray-500">
                {rows.length === 0 ? 'No transactions found for those conditions.' : `${rows.length} line(s) found`}
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
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Current Account</th>
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
                            <td className="px-4 py-2 text-gray-600">{r.currentAccountCode} — {r.currentAccountName}</td>
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
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
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
        </>
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
