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
  const [activeAccountTab, setActiveAccountTab] = useState<'reconcile' | 'statements' | 'transactions'>('reconcile')

  function switchAccountTab(tab: 'reconcile' | 'statements' | 'transactions') {
    setActiveAccountTab(tab)
    if (tab === 'reconcile') setStatusFilter('unreconciled')
    else if (tab === 'transactions') setStatusFilter('reconciled')
    else setStatusFilter('all')
  }

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

  // Reconciliation state - keyed per transaction id, so every pending line
  // shows its own match panel simultaneously (matching the Xero-style layout)
  const [txnPanel, setTxnPanel] = useState<Record<string, 'match' | 'create' | 'comment'>>({})
  const [txnMatches, setTxnMatches] = useState<Record<string, any[]>>({})
  const [txnMatchesLoaded, setTxnMatchesLoaded] = useState<Record<string, boolean>>({})
  const [txnSelectedMatch, setTxnSelectedMatch] = useState<Record<string, any>>({})
  const [txnOffsetAccount, setTxnOffsetAccount] = useState<Record<string, string>>({})
  const [txnCreateDesc, setTxnCreateDesc] = useState<Record<string, string>>({})
  const [txnComment, setTxnComment] = useState<Record<string, string>>({})
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null)
  const [detailInfo, setDetailInfo] = useState<Record<string, any>>({})
  const [detailLoading, setDetailLoading] = useState(false)
  const [txnBusy, setTxnBusy] = useState<Record<string, boolean>>({})
  const [txnError, setTxnError] = useState<Record<string, string>>({})

  const { can } = useRole()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Open Banking connection state
  const [connections, setConnections] = useState<any[]>([])
  const [showConnectPicker, setShowConnectPicker] = useState(false)
  const [connectBankAccountId, setConnectBankAccountId] = useState('')
  const [aspspList, setAspspList] = useState<any[]>([])
  const [aspspSource, setAspspSource] = useState('')
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
      const accountFromUrl = searchParams.get('account')
      if (accountFromUrl && data.some((a) => a.id === accountFromUrl)) {
        setSelectedBankAccountId(accountFromUrl)
      } else if (data.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(data[0].id)
      }
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
      setAspspSource(data.source || '')
    } catch (err: any) {
      setConnectError(err.message)
    }
    setLoadingAspsps(false)
  }

  async function handleConnectBank(aspspName: string, aspspCountry: string, logoUrl?: string) {
    if (!connectBankAccountId) {
      setConnectError('Select which bank account this connection is for')
      return
    }
    setConnecting(true)
    setConnectError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/open-banking/connect', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          clientId,
          bankAccountId: connectBankAccountId,
          aspspName,
          aspspCountry,
          aspspLogoUrl: logoUrl || null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.debug ? `${data.error} — ${JSON.stringify(data.debug)}` : data.error)
      window.location.href = data.url
    } catch (err: any) {
      setConnectError(err.message)
      setConnecting(false)
    }
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/open-banking/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
  async function ensureMatchesLoaded(txn: any) {
    if (txnMatchesLoaded[txn.id]) return

    const matchedIdsRes = await supabase
      .from('bank_transactions')
      .select('matched_id')
      .eq('client_id', clientId)
      .not('matched_id', 'is', null)

    const alreadyMatchedIds = new Set((matchedIdsRes.data || []).map((r: any) => r.matched_id))

    let matches: any[] = []
    if (txn.amount > 0) {
      const { data } = await supabase
        .from('sales_receipts')
        .select('*, contacts(name)')
        .eq('client_id', clientId)
        .eq('bank_account_id', txn.bank_account_id)
        .eq('amount', txn.amount)
      matches = (data || []).filter((r: any) => !alreadyMatchedIds.has(r.id)).map((r: any) => ({ ...r, matchType: 'sales_receipt' }))
    } else {
      const { data } = await supabase
        .from('purchase_payments')
        .select('*, contacts(name)')
        .eq('client_id', clientId)
        .eq('bank_account_id', txn.bank_account_id)
        .eq('amount', Math.abs(txn.amount))
      matches = (data || []).filter((r: any) => !alreadyMatchedIds.has(r.id)).map((r: any) => ({ ...r, matchType: 'purchase_payment' }))
    }

    setTxnMatches((prev) => ({ ...prev, [txn.id]: matches }))
    setTxnMatchesLoaded((prev) => ({ ...prev, [txn.id]: true }))
  }

  function switchTxnPanel(txn: any, panel: 'match' | 'create' | 'comment') {
    setTxnPanel((prev) => ({ ...prev, [txn.id]: panel }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))
    if (panel === 'match') ensureMatchesLoaded(txn)
    if (panel === 'create' && !(txn.id in txnCreateDesc)) {
      setTxnCreateDesc((prev) => ({ ...prev, [txn.id]: txn.description }))
    }
    if (panel === 'comment' && !(txn.id in txnComment)) {
      setTxnComment((prev) => ({ ...prev, [txn.id]: txn.notes || '' }))
    }
  }

  function selectMatch(txnId: string, match: any) {
    setTxnSelectedMatch((prev) => ({ ...prev, [txnId]: prev[txnId]?.id === match.id ? null : match }))
  }

  async function confirmMatch(txn: any) {
    const match = txnSelectedMatch[txn.id]
    if (!match) return
    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))

    const { error } = await supabase.rpc('reconcile_bank_transaction_match', {
      p_transaction_id: txn.id,
      p_matched_type: match.matchType,
      p_matched_id: match.id,
      p_journal_entry_id: match.journal_entry_id,
    })

    if (error) {
      setTxnError((prev) => ({ ...prev, [txn.id]: error.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
    fetchTransactions()
  }

  async function confirmCreate(txn: any) {
    const accountId = txnOffsetAccount[txn.id]
    if (!accountId) {
      setTxnError((prev) => ({ ...prev, [txn.id]: 'Select an account' }))
      return
    }
    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))

    const { error } = await supabase.rpc('reconcile_bank_transaction_new', {
      p_transaction_id: txn.id,
      p_offset_account_id: accountId,
      p_description: txnCreateDesc[txn.id] || txn.description,
    })

    if (error) {
      setTxnError((prev) => ({ ...prev, [txn.id]: error.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
    fetchTransactions()
  }

  async function saveComment(txn: any) {
    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    const { error } = await supabase
      .from('bank_transactions')
      .update({ notes: txnComment[txn.id] || null })
      .eq('id', txn.id)
    setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
    if (!error) fetchTransactions()
  }

  async function toggleDetail(txn: any) {
    if (expandedDetailId === txn.id) {
      setExpandedDetailId(null)
      return
    }
    setExpandedDetailId(txn.id)
    if (!(txn.id in txnComment)) {
      setTxnComment((prev) => ({ ...prev, [txn.id]: txn.notes || '' }))
    }
    if (detailInfo[txn.id] || !txn.matched_type || !txn.matched_id) return

    setDetailLoading(true)
    let info: any = null
    if (txn.matched_type === 'sales_receipt') {
      const { data } = await supabase.from('sales_receipts').select('*, contacts(name)').eq('id', txn.matched_id).single()
      info = data
    } else if (txn.matched_type === 'purchase_payment') {
      const { data } = await supabase.from('purchase_payments').select('*, contacts(name)').eq('id', txn.matched_id).single()
      info = data
    }
    setDetailInfo((prev) => ({ ...prev, [txn.id]: info }))
    setDetailLoading(false)
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
                  <div className="flex items-center gap-3">
                    {conn.aspsp_logo_url ? (
                      <img src={conn.aspsp_logo_url} alt="" className="w-8 h-8 object-contain rounded" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-dark flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-semibold">{conn.aspsp_name?.[0] || '?'}</span>
                      </div>
                    )}
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
            ) : aspspList.length === 0 ? (
              <p className="text-sm text-amber-600">
                No banks returned at all, even without a country filter — this points to a Control Panel configuration issue rather than our code. Check that your sandbox application has at least Mock ASPSP enabled under "API applications" in the Enable Banking Control Panel.
              </p>
            ) : (
              <>
                {aspspSource === 'unfiltered_fallback' && (
                  <p className="text-xs text-amber-600">Showing all available banks — none were tagged specifically under GB.</p>
                )}
                <div className="max-h-64 overflow-y-auto space-y-1">
                {aspspList
                  .filter((b: any) => b.name.toLowerCase().includes(aspspSearch.toLowerCase()))
                  .slice(0, 30)
                  .map((b: any) => {
                    const logoUrl = b.logo || b.logo_url || b.icon || b.image_url
                    return (
                      <button
                        key={`${b.name}-${b.country}`}
                        onClick={() => handleConnectBank(b.name, b.country, logoUrl)}
                        disabled={connecting}
                        className="w-full flex items-center gap-3 text-left text-sm bg-white hover:bg-brand-light rounded-lg px-3 py-2 transition disabled:opacity-50"
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-6 h-6 object-contain rounded" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-100 flex-shrink-0" />
                        )}
                        {b.name}
                      </button>
                    )
                  })}
              </div>
              </>
            )}
            <button onClick={() => setShowConnectPicker(false)} className="text-xs text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <select value={selectedBankAccountId} onChange={(e) => setSelectedBankAccountId(e.target.value)} className={inputClass}>
          {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
        {can.manageEngagements && !importing && (
          <button onClick={() => setImporting(true)} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Import CSV
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'reconcile', label: 'Reconcile' },
          { key: 'statements', label: 'Bank Statements' },
          { key: 'transactions', label: 'Account Transactions' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchAccountTab(tab.key)}
            className={`text-sm font-medium px-4 py-2 rounded-md transition ${activeAccountTab === tab.key ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeAccountTab === 'statements' && (
        <p className="text-xs text-gray-400">Every transaction on this account, as it appears on the bank statement — reconciled or not.</p>
      )}
      {activeAccountTab === 'transactions' && (
        <p className="text-xs text-gray-400">Only transactions that have actually been reconciled into the books.</p>
      )}

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
          <p className="text-gray-500 text-sm">
            {activeAccountTab === 'reconcile' ? 'Nothing left to reconcile on this account' :
             activeAccountTab === 'transactions' ? 'No reconciled transactions yet' :
             'No transactions on this account yet'}
          </p>
        </div>
      ) : !importing && activeAccountTab !== 'reconcile' && (
        <div className="space-y-2">
          {transactions.map((txn) => {
            const isExpanded = expandedDetailId === txn.id
            const info = detailInfo[txn.id]
            return (
              <div key={txn.id} className={`bg-white rounded-2xl border overflow-hidden transition ${isExpanded ? 'border-brand-gold' : 'border-gray-200'}`}>
                <div className="p-4 flex items-center justify-between">
                  <button onClick={() => toggleDetail(txn)} className="flex-1 text-left">
                    <p className="text-sm font-medium text-brand-dark hover:underline">{txn.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(txn.transaction_date).toLocaleDateString('en-GB')}
                      {txn.reference && ` · ${txn.reference}`}
                      {txn.notes && <span className="italic"> · 💬 "{txn.notes}"</span>}
                    </p>
                  </button>
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleDetail(txn)} className={`text-sm font-semibold hover:underline ${txn.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {txn.amount >= 0 ? '+' : ''}£{txn.amount.toFixed(2)}
                    </button>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[txn.status]}`}>
                      {txn.status === 'reconciled' ? (MATCH_TYPE_LABELS[txn.matched_type] || 'Reconciled') : 'Unreconciled'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-brand-light/40 p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Date</p>
                        <p className="text-sm text-brand-dark">{new Date(txn.transaction_date).toLocaleDateString('en-GB')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Reference</p>
                        <p className="text-sm text-brand-dark">{txn.reference || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                        <p className="text-sm text-brand-dark">{txn.status === 'reconciled' ? (MATCH_TYPE_LABELS[txn.matched_type] || 'Reconciled') : 'Unreconciled'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Amount</p>
                        <p className={`text-sm font-semibold ${txn.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {txn.amount >= 0 ? '+' : ''}£{txn.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {txn.matched_type && txn.matched_id && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Matched to</p>
                        {detailLoading && !info ? (
                          <p className="text-sm text-gray-400">Loading...</p>
                        ) : info ? (
                          <div>
                            <p className="text-sm font-medium text-brand-dark">{info.contacts?.name}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(info.receipt_date || info.payment_date).toLocaleDateString('en-GB')} · £{parseFloat(info.amount).toFixed(2)}
                              {info.reference && ` · ${info.reference}`}
                              {info.voided && <span className="text-red-600 font-medium"> · Voided</span>}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 capitalize">{txn.matched_type.replace(/_/g, ' ')} — created directly from this bank line</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Comment</label>
                      <textarea
                        value={txnComment[txn.id] ?? txn.notes ?? ''}
                        onChange={(e) => setTxnComment((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                        placeholder="Add an explanation for this transaction..."
                        rows={2}
                        className={`${inputClass} w-full bg-white`}
                      />
                      <button
                        onClick={() => saveComment(txn)}
                        disabled={txnBusy[txn.id]}
                        className="mt-2 bg-brand-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                      >
                        {txnBusy[txn.id] ? 'Saving...' : 'Save comment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!importing && activeAccountTab === 'reconcile' && transactions.length > 0 && (
        <div className="space-y-4">
          {transactions.map((txn) => {
            const panel = txnPanel[txn.id] || 'match'
            const selected = txnSelectedMatch[txn.id]
            const busy = txnBusy[txn.id]
            const error = txnError[txn.id]
            const matches = txnMatches[txn.id] || []

            return (
              <div key={txn.id} className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Left — the actual bank statement line */}
                <div className={`p-5 bg-white border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col justify-center transition ${selected ? 'bg-brand-gold/10' : ''}`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bank statement line</p>
                  <p className="text-sm font-medium text-brand-dark">{txn.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5 mb-3">
                    {new Date(txn.transaction_date).toLocaleDateString('en-GB')}
                    {txn.reference && ` · ${txn.reference}`}
                  </p>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-xs text-gray-400">Spent</p>
                      <p className="text-sm font-semibold text-red-600">{txn.amount < 0 ? `£${Math.abs(txn.amount).toFixed(2)}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Received</p>
                      <p className="text-sm font-semibold text-green-700">{txn.amount >= 0 ? `£${txn.amount.toFixed(2)}` : '—'}</p>
                    </div>
                  </div>
                  {txn.notes && (
                    <p className="text-xs text-gray-400 italic mt-3">💬 "{txn.notes}"</p>
                  )}
                </div>

                {/* Right — match / create / comment panel */}
                <div className={`p-5 bg-brand-light/40 transition ${selected ? 'bg-brand-gold/10' : ''}`}>
                  <div className="flex gap-1 bg-white rounded-lg p-1 w-fit border border-gray-200 mb-3">
                    {([
                      { key: 'match', label: 'Match' },
                      { key: 'create', label: 'Create' },
                      { key: 'comment', label: 'Comment' },
                    ] as const).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => switchTxnPanel(txn, t.key)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${panel === t.key ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}

                  {panel === 'match' && (
                    <div className="space-y-3">
                      {matches.length === 0 ? (
                        <p className="text-sm text-gray-400">No matching {txn.amount > 0 ? 'receipts' : 'payments'} found for £{Math.abs(txn.amount).toFixed(2)} — try "Create" instead.</p>
                      ) : (
                        <div className="space-y-2">
                          {matches.map((m) => {
                            const isSelected = selected?.id === m.id
                            return (
                              <button
                                key={m.id}
                                onClick={() => selectMatch(txn.id, m)}
                                className={`w-full text-left flex items-center justify-between rounded-lg px-4 py-2.5 border-2 transition ${
                                  isSelected ? 'border-brand-gold bg-white' : 'border-transparent bg-white hover:border-gray-200'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-medium text-brand-dark">{m.contacts?.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(m.receipt_date || m.payment_date).toLocaleDateString('en-GB')} · £{parseFloat(m.amount).toFixed(2)} · {m.reference || 'no reference'}
                                  </p>
                                </div>
                                {isSelected && <span className="text-brand-dark text-sm">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {selected && (
                        <button
                          onClick={() => confirmMatch(txn)}
                          disabled={busy}
                          className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                        >
                          {busy ? 'Reconciling...' : 'Reconcile'}
                        </button>
                      )}
                    </div>
                  )}

                  {panel === 'create' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Offset account (e.g. Bank Charges, Interest Received)</label>
                        <select
                          value={txnOffsetAccount[txn.id] || ''}
                          onChange={(e) => setTxnOffsetAccount((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        >
                          <option value="">Select account</option>
                          {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={txnCreateDesc[txn.id] ?? txn.description}
                          onChange={(e) => setTxnCreateDesc((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        />
                      </div>
                      <button
                        onClick={() => confirmCreate(txn)}
                        disabled={busy}
                        className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                      >
                        {busy ? 'Reconciling...' : 'Create entry & reconcile'}
                      </button>
                    </div>
                  )}

                  {panel === 'comment' && (
                    <div className="space-y-3">
                      <textarea
                        value={txnComment[txn.id] ?? txn.notes ?? ''}
                        onChange={(e) => setTxnComment((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                        placeholder="Add an explanation for this transaction — it stays attached even once reconciled."
                        rows={3}
                        className={`${inputClass} w-full bg-white`}
                      />
                      <button
                        onClick={() => saveComment(txn)}
                        disabled={busy}
                        className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                      >
                        {busy ? 'Saving...' : 'Save comment'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>

  )
}
