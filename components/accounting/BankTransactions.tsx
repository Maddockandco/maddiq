'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

// --- Lightweight CSV parsing (no external dependency needed) ---
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') { current += '"'; i++ } else { inQuotes = false }
        } else current += char
      } else {
        if (char === '"') inQuotes = true
        else if (char === ',') { result.push(current); current = '' }
        else current += char
      }
    }
    result.push(current)
    return result.map((s) => s.trim())
  }
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function parseDate(raw: string, format: 'dmy' | 'ymd' | 'mdy'): string | null {
  const cleaned = raw.trim()
  const parts = cleaned.split(/[\/\-.]/)
  if (parts.length !== 3) return null
  let day: string, month: string, year: string
  if (format === 'dmy') { [day, month, year] = parts }
  else if (format === 'mdy') { [month, day, year] = parts }
  else { [year, month, day] = parts }
  day = day.padStart(2, '0')
  month = month.padStart(2, '0')
  if (year.length === 2) year = '20' + year
  const iso = `${year}-${month}-${day}`
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  return iso
}

function parseAmount(raw: string): number {
  let s = raw.trim().replace(/[£$,]/g, '')
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1) }
  const num = parseFloat(s)
  if (isNaN(num)) return 0
  return negative ? -Math.abs(num) : num
}

const STATUS_STYLES: Record<string, string> = {
  unreconciled: 'bg-amber-100 text-amber-700',
  reconciled: 'bg-green-100 text-green-700',
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  sales_receipt: 'Matched to Receipt',
  purchase_payment: 'Matched to Payment',
  journal_entry: 'Reconciled (new entry)',
}

export default function BankTransactions({ clientId }: { clientId: string }) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('')
  const [transactions, setTransactions] = useState<any[]>([])
  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'unreconciled' | 'reconciled' | 'all'>('unreconciled')

  // CSV import state
  const [importing, setImporting] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvFilename, setCsvFilename] = useState('')
  const [dateCol, setDateCol] = useState('')
  const [descriptionCol, setDescriptionCol] = useState('')
  const [referenceCol, setReferenceCol] = useState('')
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single')
  const [amountCol, setAmountCol] = useState('')
  const [moneyInCol, setMoneyInCol] = useState('')
  const [moneyOutCol, setMoneyOutCol] = useState('')
  const [dateFormat, setDateFormat] = useState<'dmy' | 'ymd' | 'mdy'>('dmy')
  const [importSaving, setImportSaving] = useState(false)
  const [importError, setImportError] = useState('')

  // Reconciliation state
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [reconcileMode, setReconcileMode] = useState<'match' | 'new'>('match')
  const [suggestedMatches, setSuggestedMatches] = useState<any[]>([])
  const [offsetAccountId, setOffsetAccountId] = useState('')
  const [reconcileDescription, setReconcileDescription] = useState('')
  const [reconciling, setReconciling] = useState(false)
  const [reconcileError, setReconcileError] = useState('')

  const { can } = useRole()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Open Banking connection state
  const [connections, setConnections] = useState<any[]>([])
  const [showConnectPicker, setShowConnectPicker] = useState(false)
  const [connectBankAccountId, setConnectBankAccountId] = useState('')
  const [aspspList, setAspspList] = useState<any[]>([])
  const [aspspSearch, setAspspSearch] = useState('')
  const [loadingAspsps, setLoadingAspsps] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [callbackBanner, setCallbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const connected = searchParams.get('bank_connected')
    const errorMsg = searchParams.get('bank_connect_error')
    if (connected) {
      setCallbackBanner({ type: 'success', message: 'Bank account connected successfully.' })
      router.replace(`/accounting/${clientId}/bank-transactions`)
    } else if (errorMsg) {
      setCallbackBanner({ type: 'error', message: `Connection failed: ${decodeURIComponent(errorMsg)}` })
      router.replace(`/accounting/${clientId}/bank-transactions`)
    }
  }, [searchParams])

  useEffect(() => { fetchBankAccounts() }, [clientId])
  useEffect(() => { if (selectedBankAccountId) fetchTransactions() }, [selectedBankAccountId, statusFilter])

  async function fetchBankAccounts() {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .eq('account_type', 'bank')
      .order('code')

    const { data: all } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('code')

    if (data) {
      setBankAccounts(data)
      if (data.length > 0 && !selectedBankAccountId) setSelectedBankAccountId(data[0].id)
    }
    if (all) setAllAccounts(all.filter((a) => a.account_type !== 'bank'))

    const { data: conns } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (conns) setConnections(conns)

    setLoading(false)
  }

  async function openConnectPicker() {
    setShowConnectPicker(true)
    setConnectBankAccountId(selectedBankAccountId)
    setConnectError('')
    setLoadingAspsps(true)
    try {
      const res = await fetch('/api/open-banking/aspsps?country=GB')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAspspList(data.aspsps || [])
    } catch (err: any) {
      setConnectError(err.message)
    }
    setLoadingAspsps(false)
  }

  async function handleConnectBank(aspspName: string, aspspCountry: string) {
    if (!connectBankAccountId) {
      setConnectError('Select which bank account this connection is for')
      return
    }
    setConnecting(true)
    setConnectError('')
    try {
      const res = await fetch('/api/open-banking/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          bankAccountId: connectBankAccountId,
          aspspName,
          aspspCountry,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (err: any) {
      setConnectError(err.message)
      setConnecting(false)
    }
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    try {
      const res = await fetch('/api/open-banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await fetchBankAccounts()
      if (selectedBankAccountId) await fetchTransactions()
    } catch (err: any) {
      setCallbackBanner({ type: 'error', message: `Sync failed: ${err.message}` })
    }
    setSyncingId(null)
  }

  async function fetchTransactions() {
    setLoading(true)
    let query = supabase
      .from('bank_transactions')
      .select('*')
      .eq('client_id', clientId)
      .eq('bank_account_id', selectedBankAccountId)
      .order('transaction_date', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) setTransactions(data)
    setLoading(false)
  }

  // --- CSV import ---
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFilename(file.name)
    setImportError('')

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (headers.length === 0) {
        setImportError('Could not read any columns from this file')
        return
      }
      setCsvHeaders(headers)
      setCsvRows(rows)
      // Best-effort auto-detect common column names
      const lower = headers.map((h) => h.toLowerCase())
      const guess = (candidates: string[]) => {
        const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)))
        return idx >= 0 ? headers[idx] : ''
      }
      setDateCol(guess(['date']))
      setDescriptionCol(guess(['description', 'narrative', 'details', 'memo']))
      setReferenceCol(guess(['reference', 'ref']))
      setAmountCol(guess(['amount']))
      setMoneyInCol(guess(['credit', 'money in', 'paid in', 'deposit']))
      setMoneyOutCol(guess(['debit', 'money out', 'paid out', 'withdrawal']))
    }
    reader.readAsText(file)
  }

  function buildPreviewRows() {
    const dateIdx = csvHeaders.indexOf(dateCol)
    const descIdx = csvHeaders.indexOf(descriptionCol)
    const refIdx = csvHeaders.indexOf(referenceCol)
    const amountIdx = csvHeaders.indexOf(amountCol)
    const inIdx = csvHeaders.indexOf(moneyInCol)
    const outIdx = csvHeaders.indexOf(moneyOutCol)

    return csvRows.map((row) => {
      const iso = dateIdx >= 0 ? parseDate(row[dateIdx] || '', dateFormat) : null
      const description = descIdx >= 0 ? row[descIdx] : ''
      const reference = refIdx >= 0 ? row[refIdx] : ''
      let amount = 0
      if (amountMode === 'single') {
        amount = amountIdx >= 0 ? parseAmount(row[amountIdx] || '0') : 0
      } else {
        const inAmt = inIdx >= 0 ? parseAmount(row[inIdx] || '0') : 0
        const outAmt = outIdx >= 0 ? parseAmount(row[outIdx] || '0') : 0
        amount = Math.abs(inAmt) - Math.abs(outAmt)
      }
      return { date: iso, description, reference, amount, valid: !!iso && !!description }
    })
  }

  async function handleConfirmImport() {
    setImportSaving(true)
    setImportError('')

    const preview = buildPreviewRows()
    const validRows = preview.filter((r) => r.valid)

    if (validRows.length === 0) {
      setImportError('No valid rows found — check your column mapping and date format')
      setImportSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setImportError('Could not find your firm'); setImportSaving(false); return }

    const { data: batch, error: batchError } = await supabase
      .from('bank_import_batches')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        bank_account_id: selectedBankAccountId,
        filename: csvFilename,
        row_count: validRows.length,
        imported_by: user!.id,
      })
      .select()
      .single()

    if (batchError) { setImportError(batchError.message); setImportSaving(false); return }

    const rowsToInsert = validRows.map((r) => ({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      bank_account_id: selectedBankAccountId,
      transaction_date: r.date,
      description: r.description,
      reference: r.reference || null,
      amount: r.amount,
      status: 'unreconciled',
      import_batch_id: batch.id,
      created_by: user!.id,
    }))

    const { error: insertError } = await supabase.from('bank_transactions').insert(rowsToInsert)
    if (insertError) { setImportError(insertError.message); setImportSaving(false); return }

    setImporting(false)
    setCsvHeaders([])
    setCsvRows([])
    setCsvFilename('')
    fetchTransactions()
    setImportSaving(false)
  }

  // --- Reconciliation ---
  async function openReconcile(txn: any) {
    setReconcilingId(txn.id)
    setReconcileMode('match')
    setOffsetAccountId('')
    setReconcileDescription(txn.description)
    setReconcileError('')

    const matchedIdsRes = await supabase
      .from('bank_transactions')
      .select('matched_id')
      .eq('client_id', clientId)
      .not('matched_id', 'is', null)

    const alreadyMatchedIds = new Set((matchedIdsRes.data || []).map((r: any) => r.matched_id))

    if (txn.amount > 0) {
      const { data } = await supabase
        .from('sales_receipts')
        .select('*, contacts(name)')
        .eq('client_id', clientId)
        .eq('bank_account_id', txn.bank_account_id)
        .eq('amount', txn.amount)
      setSuggestedMatches((data || []).filter((r: any) => !alreadyMatchedIds.has(r.id)).map((r: any) => ({ ...r, matchType: 'sales_receipt' })))
    } else {
      const { data } = await supabase
        .from('purchase_payments')
        .select('*, contacts(name)')
        .eq('client_id', clientId)
        .eq('bank_account_id', txn.bank_account_id)
        .eq('amount', Math.abs(txn.amount))
      setSuggestedMatches((data || []).filter((r: any) => !alreadyMatchedIds.has(r.id)).map((r: any) => ({ ...r, matchType: 'purchase_payment' })))
    }
  }

  async function handleMatch(match: any) {
    setReconciling(true)
    setReconcileError('')

    const { error } = await supabase.rpc('reconcile_bank_transaction_match', {
      p_transaction_id: reconcilingId,
      p_matched_type: match.matchType,
      p_matched_id: match.id,
      p_journal_entry_id: match.journal_entry_id,
    })

    if (error) {
      setReconcileError(error.message)
      setReconciling(false)
      return
    }

    setReconcilingId(null)
    setReconciling(false)
    fetchTransactions()
  }

  async function handleCreateNew() {
    if (!offsetAccountId) {
      setReconcileError('Select an account')
      return
    }
    setReconciling(true)
    setReconcileError('')

    const { error } = await supabase.rpc('reconcile_bank_transaction_new', {
      p_transaction_id: reconcilingId,
      p_offset_account_id: offsetAccountId,
      p_description: reconcileDescription,
    })

    if (error) {
      setReconcileError(error.message)
      setReconciling(false)
      return
    }

    setReconcilingId(null)
    setReconciling(false)
    fetchTransactions()
  }

  async function handleUnreconcile(transactionId: string) {
    const { error } = await supabase.rpc('unreconcile_bank_transaction', { p_transaction_id: transactionId })
    if (!error) fetchTransactions()
  }

  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const preview = importing ? buildPreviewRows() : []

  if (bankAccounts.length === 0 && !loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No bank accounts set up</p>
      <p className="text-gray-400 text-xs">Add a Bank-type account in Chart of Accounts first</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {callbackBanner && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between ${callbackBanner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          <span>{callbackBanner.message}</span>
          <button onClick={() => setCallbackBanner(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Open Banking Connections</h3>
          {can.manageEngagements && (
            <button onClick={openConnectPicker} className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition">
              + Connect Bank
            </button>
          )}
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-gray-400">No banks connected yet — transactions can still be imported via CSV below, or connect a bank for automatic syncing.</p>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => {
              const account = bankAccounts.find((a) => a.id === conn.bank_account_id)
              return (
                <div key={conn.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brand-dark">{conn.aspsp_name} ({conn.aspsp_country})</p>
                    <p className="text-xs text-gray-400">
                      {account ? `${account.code} — ${account.name}` : 'Unknown account'} ·{' '}
                      {conn.status === 'active' ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-500 capitalize">{conn.status}</span>
                      )}
                      {conn.last_synced_at && ` · Last synced ${new Date(conn.last_synced_at).toLocaleString('en-GB')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncingId === conn.id}
                    className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                  >
                    {syncingId === conn.id ? 'Syncing...' : 'Sync now'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {showConnectPicker && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3">
            {connectError && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{connectError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Which bank account is this connection for?</label>
              <select value={connectBankAccountId} onChange={(e) => setConnectBankAccountId(e.target.value)} className={`${inputClass} w-full`}>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search for the client's bank (UK)</label>
              <input
                type="text"
                value={aspspSearch}
                onChange={(e) => setAspspSearch(e.target.value)}
                placeholder="e.g. Barclays, HSBC, Monzo..."
                className={`${inputClass} w-full`}
              />
            </div>
            {loadingAspsps ? (
              <p className="text-sm text-gray-400">Loading banks...</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {aspspList
                  .filter((b: any) => b.name.toLowerCase().includes(aspspSearch.toLowerCase()))
                  .slice(0, 30)
                  .map((b: any) => (
                    <button
                      key={`${b.name}-${b.country}`}
                      onClick={() => handleConnectBank(b.name, b.country)}
                      disabled={connecting}
                      className="w-full text-left text-sm bg-white hover:bg-brand-light rounded-lg px-3 py-2 transition disabled:opacity-50"
                    >
                      {b.name}
                    </button>
                  ))}
              </div>
            )}
            <button onClick={() => setShowConnectPicker(false)} className="text-xs text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select value={selectedBankAccountId} onChange={(e) => setSelectedBankAccountId(e.target.value)} className={inputClass}>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['unreconciled', 'reconciled', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition capitalize ${statusFilter === s ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {can.manageEngagements && !importing && (
          <button onClick={() => setImporting(true)} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Import CSV
          </button>
        )}
      </div>

      {importing && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Import Bank Statement (CSV)</h3>
          {importError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{importError}</div>}

          {csvHeaders.length === 0 ? (
            <div>
              <input type="file" accept=".csv" onChange={handleFileSelect} className="text-sm" />
              <p className="text-xs text-gray-400 mt-2">Upload a CSV export from the client's bank</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">File: <span className="font-medium text-brand-dark">{csvFilename}</span> — {csvRows.length} rows found</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date column</label>
                  <select value={dateCol} onChange={(e) => setDateCol(e.target.value)} className={`${inputClass} w-full`}>
                    <option value="">Select column</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date format</label>
                  <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as any)} className={`${inputClass} w-full`}>
                    <option value="dmy">DD/MM/YYYY (UK)</option>
                    <option value="mdy">MM/DD/YYYY (US)</option>
                    <option value="ymd">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description column</label>
                  <select value={descriptionCol} onChange={(e) => setDescriptionCol(e.target.value)} className={`${inputClass} w-full`}>
                    <option value="">Select column</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reference column (optional)</label>
                  <select value={referenceCol} onChange={(e) => setReferenceCol(e.target.value)} className={`${inputClass} w-full`}>
                    <option value="">None</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Amount format</p>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-3">
                  <button onClick={() => setAmountMode('single')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${amountMode === 'single' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                    Single signed amount
                  </button>
                  <button onClick={() => setAmountMode('split')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${amountMode === 'split' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                    Separate Money In / Money Out
                  </button>
                </div>
                {amountMode === 'single' ? (
                  <div className="max-w-xs">
                    <select value={amountCol} onChange={(e) => setAmountCol(e.target.value)} className={`${inputClass} w-full`}>
                      <option value="">Select column</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Money In column</label>
                      <select value={moneyInCol} onChange={(e) => setMoneyInCol(e.target.value)} className={`${inputClass} w-full`}>
                        <option value="">Select column</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Money Out column</label>
                      <select value={moneyOutCol} onChange={(e) => setMoneyOutCol(e.target.value)} className={`${inputClass} w-full`}>
                        <option value="">Select column</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Preview (first 5 rows)</p>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase tracking-wider">
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Valid?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-gray-200">
                          <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleDateString('en-GB') : <span className="text-red-500">Invalid</span>}</td>
                          <td className="px-3 py-2">{r.description || <span className="text-red-500">Missing</span>}</td>
                          <td className="px-3 py-2 text-right">£{r.amount.toFixed(2)}</td>
                          <td className="px-3 py-2">{r.valid ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {preview.filter((r) => r.valid).length} of {preview.length} rows will be imported
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={handleConfirmImport} disabled={importSaving}
                  className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                  {importSaving ? 'Importing...' : `Import ${preview.filter((r) => r.valid).length} transactions`}
                </button>
                <button onClick={() => { setImporting(false); setCsvHeaders([]); setCsvRows([]) }}
                  className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">Loading transactions...</p>
        </div>
      ) : transactions.length === 0 && !importing ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No {statusFilter !== 'all' ? statusFilter : ''} transactions for this account</p>
        </div>
      ) : !importing && (
        <div className="space-y-2">
          {transactions.map((txn) => (
            <div key={txn.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-dark">{txn.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(txn.transaction_date).toLocaleDateString('en-GB')}
                    {txn.reference && ` · ${txn.reference}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${txn.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {txn.amount >= 0 ? '+' : ''}£{txn.amount.toFixed(2)}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[txn.status]}`}>
                    {txn.status === 'reconciled' ? (MATCH_TYPE_LABELS[txn.matched_type] || 'Reconciled') : 'Unreconciled'}
                  </span>
                  {can.manageEngagements && txn.status === 'unreconciled' && (
                    <button onClick={() => openReconcile(txn)} className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition">
                      Reconcile
                    </button>
                  )}
                  {can.manageEngagements && txn.status === 'reconciled' && (
                    <button onClick={() => handleUnreconcile(txn.id)} className="text-xs text-gray-400 hover:text-red-600 transition">
                      Undo
                    </button>
                  )}
                </div>
              </div>

              {reconcilingId === txn.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                  {reconcileError && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{reconcileError}</div>}

                  <div className="flex gap-1 bg-white rounded-lg p-1 w-fit border border-gray-200">
                    <button onClick={() => setReconcileMode('match')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${reconcileMode === 'match' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}>
                      Match existing
                    </button>
                    <button onClick={() => setReconcileMode('new')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${reconcileMode === 'new' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}>
                      Create new entry
                    </button>
                  </div>

                  {reconcileMode === 'match' ? (
                    suggestedMatches.length === 0 ? (
                      <p className="text-sm text-gray-400">No matching {txn.amount > 0 ? 'receipts' : 'payments'} found for £{Math.abs(txn.amount).toFixed(2)} on this bank account — try "Create new entry" instead.</p>
                    ) : (
                      <div className="space-y-2">
                        {suggestedMatches.map((m) => (
                          <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-gray-200">
                            <div>
                              <p className="text-sm font-medium text-brand-dark">{m.contacts?.name}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(m.receipt_date || m.payment_date).toLocaleDateString('en-GB')} · £{parseFloat(m.amount).toFixed(2)} · {m.reference || 'no reference'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleMatch(m)}
                              disabled={reconciling}
                              className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                            >
                              Match
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Offset account (e.g. Bank Charges, Interest Received)</label>
                        <select value={offsetAccountId} onChange={(e) => setOffsetAccountId(e.target.value)} className={`${inputClass} w-full`}>
                          <option value="">Select account</option>
                          {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input type="text" value={reconcileDescription} onChange={(e) => setReconcileDescription(e.target.value)} className={`${inputClass} w-full`} />
                      </div>
                      <button
                        onClick={handleCreateNew}
                        disabled={reconciling}
                        className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                      >
                        {reconciling ? 'Reconciling...' : 'Create entry & reconcile'}
                      </button>
                    </div>
                  )}

                  <button onClick={() => setReconcilingId(null)} className="text-sm text-gray-500 hover:underline">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
