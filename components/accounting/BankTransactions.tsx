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

function AccountSearchSelect({ accounts, value, onChange, placeholder }: { accounts: any[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = accounts.find((a) => a.id === value)
  const filtered = accounts
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    .slice(0, 30)

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? search : (selected ? `${selected.code} — ${selected.name}` : '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => { setSearch(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || 'Search accounts...'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">No matching accounts</p>
          ) : filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(a.id); setSearch(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-light transition"
            >
              {a.code} — {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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
  dividend: 'Matched to Dividend Payment',
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
  const [txnAddingAccount, setTxnAddingAccount] = useState<Record<string, 'create' | 'match_diff' | null>>({})
  const [txnNewAccountCode, setTxnNewAccountCode] = useState<Record<string, string>>({})
  const [txnNewAccountName, setTxnNewAccountName] = useState<Record<string, string>>({})
  const [txnNewAccountType, setTxnNewAccountType] = useState<Record<string, string>>({})
  const [txnNewAccountParent, setTxnNewAccountParent] = useState<Record<string, string>>({})
  const [txnNewAccountVatRateId, setTxnNewAccountVatRateId] = useState<Record<string, string>>({})
  const [txnAddAccountSaving, setTxnAddAccountSaving] = useState<Record<string, boolean>>({})
  const [txnAddAccountError, setTxnAddAccountError] = useState<Record<string, string>>({})
  const [txnLearnedRule, setTxnLearnedRule] = useState<Record<string, any>>({})
  const [txnLearnedLoaded, setTxnLearnedLoaded] = useState<Record<string, boolean>>({})

  function normalizePattern(description: string): string {
    return (description || '')
      .toLowerCase()
      .replace(/[0-9]+/g, '')
      .replace(/[^a-z\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 3)
      .join(' ')
  }
  const [txnMatchOffsetAccount, setTxnMatchOffsetAccount] = useState<Record<string, string>>({})
  const [txnCreateDesc, setTxnCreateDesc] = useState<Record<string, string>>({})
  const [txnComment, setTxnComment] = useState<Record<string, string>>({})
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null)
  const [detailInfo, setDetailInfo] = useState<Record<string, any>>({})
  const [detailLoading, setDetailLoading] = useState(false)
  const [sourceDocUrls, setSourceDocUrls] = useState<Record<string, string>>({})
  const [txnBusy, setTxnBusy] = useState<Record<string, boolean>>({})
  const [txnError, setTxnError] = useState<Record<string, string>>({})
  const [txnUnreconcileError, setTxnUnreconcileError] = useState<Record<string, string>>({})

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
  const [accountPickerRequest, setAccountPickerRequest] = useState<any>(null)
  const [selectingAccountIndex, setSelectingAccountIndex] = useState<number | null>(null)
  const [accountPickerError, setAccountPickerError] = useState('')

  useEffect(() => {
    const connected = searchParams.get('bank_connected')
    const errorMsg = searchParams.get('bank_connect_error')
    const selectAccountId = searchParams.get('bank_select_account')
    if (connected) {
      setCallbackBanner({ type: 'success', message: 'Bank account connected successfully.' })
      router.replace(`/accounting/${clientId}/bank-transactions`)
    } else if (errorMsg) {
      setCallbackBanner({ type: 'error', message: `Connection failed: ${decodeURIComponent(errorMsg)}` })
      router.replace(`/accounting/${clientId}/bank-transactions`)
    } else if (selectAccountId) {
      loadAccountPicker(selectAccountId)
    }
  }, [searchParams])

  async function loadAccountPicker(authRequestId: string) {
    const { data } = await supabase
      .from('bank_auth_requests')
      .select('*')
      .eq('id', authRequestId)
      .single()
    if (data) setAccountPickerRequest(data)
  }

  async function handleSelectAccount(accountIndex: number) {
    setSelectingAccountIndex(accountIndex)
    setAccountPickerError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/open-banking/select-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ authRequestId: accountPickerRequest.id, accountIndex }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAccountPickerRequest(null)
      setCallbackBanner({ type: 'success', message: 'Bank account connected successfully.' })
      router.replace(`/accounting/${clientId}/bank-transactions`)
      fetchBankAccounts()
    } catch (err: any) {
      setAccountPickerError(err.message)
    }
    setSelectingAccountIndex(null)
  }

  const [vatRates, setVatRates] = useState<any[]>([])
  const [txnVatRateId, setTxnVatRateId] = useState<Record<string, string>>({})

  useEffect(() => { fetchBankAccounts() }, [clientId])
  useEffect(() => {
    supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setVatRates(data)
    })
  }, [])
  useEffect(() => { if (selectedBankAccountId) fetchTransactions() }, [selectedBankAccountId, statusFilter])

  useEffect(() => {
    const autoConnect = searchParams.get('auto_connect')
    if (autoConnect && selectedBankAccountId && !showConnectPicker) {
      openConnectPicker()
      router.replace(`/accounting/${clientId}/bank-transactions?account=${selectedBankAccountId}`)
    }
  }, [selectedBankAccountId])

  useEffect(() => {
    if (activeAccountTab !== 'reconcile') return
    transactions.forEach((txn) => {
      if (txn.status === 'unreconciled') {
        ensureMatchesLoaded(txn)
        checkLearnedRule(txn)
      }
    })
  }, [transactions, activeAccountTab])

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
      .select('id, code, name, account_type, parent_id, default_vat_rate_id')
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
  function scoreCandidate(txn: any, candidate: any) {
    const candidateAmount = parseFloat(candidate.amount)
    const amountDiff = Math.abs(Math.abs(txn.amount) - candidateAmount)
    // Exact = 100, drops off quickly but still allows small differences (fees, FX rounding) through
    const amountScore = amountDiff === 0 ? 100 : Math.max(0, 100 - amountDiff * 15)

    const txnDesc = (txn.description || '').toLowerCase()
    const contactName = (candidate.contacts?.name || '').toLowerCase()
    const nameWords = contactName.split(/\s+/).filter((w: string) => w.length > 2)
    const nameMatchCount = nameWords.filter((w: string) => txnDesc.includes(w)).length
    const descScore = nameWords.length > 0 ? (nameMatchCount / nameWords.length) * 50 : 0

    const candidateDate = new Date(candidate.receipt_date || candidate.payment_date)
    const daysDiff = Math.abs((new Date(txn.transaction_date).getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24))
    const dateScore = Math.max(0, 15 - daysDiff)

    return { score: amountScore + descScore + dateScore, amountDiff, nameMatchCount }
  }

  function confidenceLabel(result: { amountDiff: number; nameMatchCount: number }) {
    if (result.amountDiff === 0 && result.nameMatchCount > 0) return { label: 'Exact match', style: 'bg-green-100 text-green-700' }
    if (result.amountDiff === 0) return { label: 'Exact amount', style: 'bg-green-100 text-green-700' }
    if (result.amountDiff <= 1) return { label: 'Likely match', style: 'bg-amber-100 text-amber-700' }
    return { label: 'Possible match', style: 'bg-gray-100 text-gray-500' }
  }

  async function checkLearnedRule(txn: any) {
    if (txnLearnedLoaded[txn.id]) return
    const pattern = normalizePattern(txn.description)
    if (!pattern) {
      setTxnLearnedLoaded((prev) => ({ ...prev, [txn.id]: true }))
      return
    }

    const { data } = await supabase
      .from('bank_transaction_rules')
      .select('*')
      .eq('client_id', clientId)
      .eq('pattern', pattern)
      .maybeSingle()

    setTxnLearnedRule((prev) => ({ ...prev, [txn.id]: data || null }))
    setTxnLearnedLoaded((prev) => ({ ...prev, [txn.id]: true }))
  }

  async function applyLearnedRule(txn: any) {
    const rule = txnLearnedRule[txn.id]
    if (!rule) return
    setTxnOffsetAccount((prev) => ({ ...prev, [txn.id]: rule.offset_account_id }))
    await confirmCreate(txn, rule.offset_account_id)
  }

  async function ensureMatchesLoaded(txn: any) {
    if (txnMatchesLoaded[txn.id]) return

    const matchedIdsRes = await supabase
      .from('bank_transactions')
      .select('matched_id')
      .eq('client_id', clientId)
      .not('matched_id', 'is', null)

    const alreadyMatchedIds = new Set((matchedIdsRes.data || []).map((r: any) => r.matched_id))

    // Broaden the search to a ±30 day window and a wider amount range, then score
    // and rank candidates rather than requiring an exact amount match.
    const txnDate = new Date(txn.transaction_date)
    const dateFrom = new Date(txnDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateTo = new Date(txnDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const targetAmount = Math.abs(txn.amount)
    const amountLow = Math.max(0, targetAmount - 10)
    const amountHigh = targetAmount + 10

    let candidates: any[] = []
    if (txn.amount > 0) {
      const { data } = await supabase
        .from('sales_receipts')
        .select('*, contacts(name)')
        .eq('client_id', clientId)
        .eq('bank_account_id', txn.bank_account_id)
        .gte('amount', amountLow)
        .lte('amount', amountHigh)
        .gte('receipt_date', dateFrom)
        .lte('receipt_date', dateTo)
      candidates = (data || []).filter((r: any) => !alreadyMatchedIds.has(r.id)).map((r: any) => ({ ...r, matchType: 'sales_receipt' }))
    } else {
      const [paymentsRes, dividendsRes] = await Promise.all([
        supabase
          .from('purchase_payments')
          .select('*, contacts(name)')
          .eq('client_id', clientId)
          .eq('bank_account_id', txn.bank_account_id)
          .gte('amount', amountLow)
          .lte('amount', amountHigh)
          .gte('payment_date', dateFrom)
          .lte('payment_date', dateTo),
        supabase
          .from('dividends')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'declared')
          .gte('total_amount', amountLow)
          .lte('total_amount', amountHigh)
          .gte('declaration_date', dateFrom)
          .lte('declaration_date', dateTo),
      ])
      const paymentCandidates = (paymentsRes.data || [])
        .filter((r: any) => !alreadyMatchedIds.has(r.id))
        .map((r: any) => ({ ...r, matchType: 'purchase_payment' }))
      const dividendCandidates = (dividendsRes.data || [])
        .filter((d: any) => !alreadyMatchedIds.has(d.id))
        .map((d: any) => ({ ...d, matchType: 'dividend', amount: d.total_amount, payment_date: d.declaration_date }))
      candidates = [...paymentCandidates, ...dividendCandidates]
    }

    const scored = candidates
      .map((c) => ({ ...c, _scoring: scoreCandidate(txn, c) }))
      .sort((a, b) => b._scoring.score - a._scoring.score)
      .slice(0, 5)

    const matches = scored
    setTxnMatches((prev) => ({ ...prev, [txn.id]: matches }))
    setTxnMatchesLoaded((prev) => ({ ...prev, [txn.id]: true }))

    // If the best match is a genuine exact-amount match, select it automatically -
    // it's already the right one, no need to make the user click it first
    if (matches.length > 0 && matches[0]._scoring?.amountDiff === 0) {
      setTxnSelectedMatch((prev) => ({ ...prev, [txn.id]: matches[0] }))
    }
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

  async function handleAddAccountInline(txn: any, target: 'create' | 'match_diff') {
    const code = txnNewAccountCode[txn.id]?.trim()
    const name = txnNewAccountName[txn.id]?.trim()
    const type = txnNewAccountType[txn.id] || 'overhead'
    const isVatRelevant = ['direct_costs', 'expense', 'overhead', 'sales', 'other_income'].includes(type)
    const newAccountVatRateId = txnNewAccountVatRateId[txn.id] || ''

    if (!code || !name) {
      setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: 'Code and name are required' }))
      return
    }

    if (isVatRelevant && !newAccountVatRateId) {
      setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: 'A VAT rate is required for this account type' }))
      return
    }

    const duplicateCode = allAccounts.some((a) => a.code === code) || bankAccounts.some((a) => a.code === code)
    if (duplicateCode) {
      setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: `Code ${code} is already used by another account — pick a different one` }))
      return
    }

    setTxnAddAccountSaving((prev) => ({ ...prev, [txn.id]: true }))
    setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: '' }))

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) {
      setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: 'Could not find your firm' }))
      setTxnAddAccountSaving((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    const { data: newAccount, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        code,
        name,
        account_type: type,
        parent_id: txnNewAccountParent[txn.id] || null,
        default_vat_rate_id: isVatRelevant ? newAccountVatRateId : null,
      })
      .select()
      .single()

    if (error) {
      setTxnAddAccountError((prev) => ({ ...prev, [txn.id]: error.message }))
      setTxnAddAccountSaving((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    setAllAccounts((prev) => [...prev, newAccount].sort((a, b) => a.code.localeCompare(b.code)))
    if (target === 'create') {
      setTxnOffsetAccount((prev) => ({ ...prev, [txn.id]: newAccount.id }))
      setTxnVatRateId((prev) => ({ ...prev, [txn.id]: newAccount.default_vat_rate_id || '' }))
    } else {
      setTxnMatchOffsetAccount((prev) => ({ ...prev, [txn.id]: newAccount.id }))
    }
    setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: null }))
    setTxnNewAccountCode((prev) => ({ ...prev, [txn.id]: '' }))
    setTxnNewAccountName((prev) => ({ ...prev, [txn.id]: '' }))
    setTxnNewAccountParent((prev) => ({ ...prev, [txn.id]: '' }))
    setTxnNewAccountVatRateId((prev) => ({ ...prev, [txn.id]: '' }))
    setTxnAddAccountSaving((prev) => ({ ...prev, [txn.id]: false }))
  }

  async function confirmDividendMatch(txn: any, dividend: any) {
    const amountDiff = Math.abs(Math.abs(txn.amount) - parseFloat(dividend.total_amount))
    if (amountDiff > 0) {
      setTxnError((prev) => ({ ...prev, [txn.id]: `This bank line doesn't exactly match the dividend total (£${amountDiff.toFixed(2)} difference) — dividend payments need to match exactly, since a partial payment would need its own separate tracking.` }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) {
      setTxnError((prev) => ({ ...prev, [txn.id]: 'Could not find your firm' }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    const { data: declarationLines } = await supabase
      .from('journal_lines')
      .select('account_id, credit')
      .eq('journal_entry_id', dividend.declaration_journal_entry_id)
      .gt('credit', 0)

    const payableAccountId = declarationLines?.[0]?.account_id

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: txn.transaction_date,
        reference: 'DIVIDEND-PAID',
        description: `Dividend paid — £${parseFloat(dividend.total_amount).toFixed(2)}`,
        source: 'dividend',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) {
      setTxnError((prev) => ({ ...prev, [txn.id]: entryError.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    await supabase.from('journal_lines').insert([
      { journal_entry_id: entry.id, account_id: payableAccountId, debit: dividend.total_amount, credit: 0, description: 'Dividend paid', sort_order: 0 },
      { journal_entry_id: entry.id, account_id: txn.bank_account_id, debit: 0, credit: dividend.total_amount, description: 'Dividend paid', sort_order: 1 },
    ])

    await supabase
      .from('dividends')
      .update({ status: 'paid', payment_date: txn.transaction_date, payment_journal_entry_id: entry.id })
      .eq('id', dividend.id)

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'dividend',
      p_entity_id: dividend.id,
      p_action: 'paid',
      p_old_data: { status: 'declared' },
      p_new_data: { status: 'paid', payment_date: txn.transaction_date },
      p_description: `Marked dividend as paid via bank reconciliation — £${parseFloat(dividend.total_amount).toFixed(2)}`,
    })

    const { error: reconcileError } = await supabase.rpc('reconcile_bank_transaction_match', {
      p_transaction_id: txn.id,
      p_matched_type: 'dividend',
      p_matched_id: dividend.id,
      p_journal_entry_id: entry.id,
      p_offset_account_id: null,
    })

    if (reconcileError) {
      setTxnError((prev) => ({ ...prev, [txn.id]: reconcileError.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
    fetchTransactions()
  }

  async function confirmMatch(txn: any) {
    const match = txnSelectedMatch[txn.id]
    if (!match) return

    const amountDiff = match._scoring?.amountDiff || 0
    const offsetAccountId = txnMatchOffsetAccount[txn.id]

    if (amountDiff > 0 && !offsetAccountId) {
      setTxnError((prev) => ({ ...prev, [txn.id]: 'Select an account for the £' + amountDiff.toFixed(2) + ' difference before reconciling' }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))

    const { error } = await supabase.rpc('reconcile_bank_transaction_match', {
      p_transaction_id: txn.id,
      p_matched_type: match.matchType,
      p_matched_id: match.id,
      p_journal_entry_id: match.journal_entry_id,
      p_offset_account_id: offsetAccountId || null,
    })

    if (error) {
      setTxnError((prev) => ({ ...prev, [txn.id]: error.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
    fetchTransactions()
  }

  function postableAccounts() {
    // Only leaf accounts (no children) can be posted to - group/parent accounts are headings only
    const parentIds = new Set(allAccounts.map((a) => a.parent_id).filter(Boolean))
    return allAccounts.filter((a) => !parentIds.has(a.id))
  }

  function getAccountVatRateId(accountId: string): string {
    const account = allAccounts.find((a) => a.id === accountId)
    return account?.default_vat_rate_id || ''
  }

  function getRelevantVatRates(accountType: string) {
    const expenseTypes = ['direct_costs', 'expense', 'overhead']
    const incomeTypes = ['sales', 'revenue', 'other_income']
    const universal = ['no_vat']
    const expenseOnly = ['reverse_charge_expense_20', 'reverse_charge_construction', 'vat_on_imports', 'ec_acquisitions_20', 'ec_acquisitions_zero']
    const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']

    if (expenseTypes.includes(accountType)) {
      return vatRates.filter((r) => r.code.endsWith('_expense') || universal.includes(r.code) || expenseOnly.includes(r.code))
    }
    if (incomeTypes.includes(accountType)) {
      return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
    }
    return vatRates
  }

  function calcVatFromGross(grossAmount: number, ratePercent: number) {
    if (!ratePercent) return 0
    return Math.round((Math.abs(grossAmount) * ratePercent / (100 + ratePercent)) * 100) / 100
  }

  async function confirmCreate(txn: any, overrideAccountId?: string) {
    const accountId = overrideAccountId || txnOffsetAccount[txn.id]
    if (!accountId) {
      setTxnError((prev) => ({ ...prev, [txn.id]: 'Select an account' }))
      return
    }
    setTxnBusy((prev) => ({ ...prev, [txn.id]: true }))
    setTxnError((prev) => ({ ...prev, [txn.id]: '' }))

    const selectedRate = vatRates.find((r) => r.id === txnVatRateId[txn.id])
    const vatAmount = selectedRate ? calcVatFromGross(txn.amount, selectedRate.rate) : 0

    const { error } = await supabase.rpc('reconcile_bank_transaction_new', {
      p_transaction_id: txn.id,
      p_offset_account_id: accountId,
      p_description: txnCreateDesc[txn.id] || txn.description,
      p_vat_amount: vatAmount,
    })

    if (error) {
      setTxnError((prev) => ({ ...prev, [txn.id]: error.message }))
      setTxnBusy((prev) => ({ ...prev, [txn.id]: false }))
      return
    }

    // Remember this pairing for next time — same normalized pattern, same offset account
    const pattern = normalizePattern(txn.description)
    if (pattern) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
      if (firmUser) {
        const { data: existingRule } = await supabase
          .from('bank_transaction_rules')
          .select('id, usage_count, offset_account_id')
          .eq('client_id', clientId)
          .eq('pattern', pattern)
          .maybeSingle()

        if (existingRule) {
          await supabase
            .from('bank_transaction_rules')
            .update({
              offset_account_id: accountId,
              usage_count: existingRule.offset_account_id === accountId ? existingRule.usage_count + 1 : 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingRule.id)
        } else {
          await supabase.from('bank_transaction_rules').insert({
            firm_id: firmUser.firm_id,
            client_id: clientId,
            pattern,
            offset_account_id: accountId,
          })
        }
      }
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
    if (txn.source_extraction_id && !sourceDocUrls[txn.id]) {
      const { data: extraction } = await supabase.from('document_extractions').select('file_path').eq('id', txn.source_extraction_id).single()
      if (extraction) {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(extraction.file_path, 3600)
        if (signed) setSourceDocUrls((prev) => ({ ...prev, [txn.id]: signed.signedUrl }))
      }
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
    } else if (txn.matched_type === 'dividend') {
      const { data } = await supabase.from('dividends').select('*').eq('id', txn.matched_id).single()
      info = data
    }
    setDetailInfo((prev) => ({ ...prev, [txn.id]: info }))
    setDetailLoading(false)
  }

  async function handleUnreconcile(transactionId: string) {
    setTxnBusy((prev) => ({ ...prev, [transactionId]: true }))
    setTxnUnreconcileError((prev) => ({ ...prev, [transactionId]: '' }))
    const { error } = await supabase.rpc('unreconcile_bank_transaction', { p_transaction_id: transactionId })
    setTxnBusy((prev) => ({ ...prev, [transactionId]: false }))
    if (error) {
      setTxnUnreconcileError((prev) => ({ ...prev, [transactionId]: error.message }))
      return
    }
    fetchTransactions()
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
      {accountPickerRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-base font-semibold text-brand-dark">Which account should we connect?</h3>
              <p className="text-sm text-gray-500 mt-1">
                {accountPickerRequest.aspsp_name} returned more than one account — pick the one that matches this bank account in Maddiq.
              </p>
            </div>
            {accountPickerError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{accountPickerError}</div>}
            <div className="space-y-2">
              {(accountPickerRequest.accounts_json || []).map((acc: any, i: number) => (
                <button
                  key={i}
                  onClick={() => handleSelectAccount(i)}
                  disabled={selectingAccountIndex !== null}
                  className="w-full text-left bg-gray-50 hover:bg-brand-light rounded-lg px-4 py-3 transition disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-brand-dark">
                    {acc.name || acc.product || acc.account_id?.iban || `Account ${i + 1}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {acc.account_id?.iban && `IBAN: ${acc.account_id.iban}`}
                    {acc.currency && ` · ${acc.currency}`}
                  </p>
                  {selectingAccountIndex === i && <p className="text-xs text-brand-dark mt-1">Connecting...</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

          {csvHeaders.length === 0 && (
            <div className="bg-brand-light rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">How this works</p>
              <p className="text-xs text-gray-600">
                Any CSV export from the bank works — you'll map its columns to the right fields in the next step,
                and choose the date format it uses. At minimum it needs a date, a description, and either a single
                signed amount column (negative for money out) or separate money-in/money-out columns.
              </p>
              <a
                href="/sample-bank-statement.csv"
                download
                className="text-xs text-brand-dark font-semibold hover:underline inline-block"
              >
                📄 Download a sample CSV to see the expected format
              </a>
            </div>
          )}

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
                  <div className="overflow-x-auto">
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

                    {sourceDocUrls[txn.id] && (
                      <a
                        href={sourceDocUrls[txn.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-brand-gold/20 text-brand-dark text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-gold/30 transition"
                      >
                        📎 View attached receipt/invoice
                      </a>
                    )}

                    {txn.matched_type && txn.matched_id && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Matched to</p>
                        {detailLoading && !info ? (
                          <p className="text-sm text-gray-400">Loading...</p>
                        ) : info ? (
                          <div>
                            <p className="text-sm font-medium text-brand-dark">
                              {txn.matched_type === 'dividend' ? 'Dividend Payment' : info.contacts?.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(info.receipt_date || info.payment_date || info.declaration_date).toLocaleDateString('en-GB')} · £{parseFloat(info.amount || info.total_amount).toFixed(2)}
                              {info.reference && ` · ${info.reference}`}
                              {info.voided && <span className="text-red-600 font-medium"> · Voided</span>}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 capitalize">{txn.matched_type.replace(/_/g, ' ')} — created directly from this bank line</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-500">Comment</label>
                      {txn.status === 'reconciled' && can.manageEngagements && (
                        <button
                          onClick={() => handleUnreconcile(txn.id)}
                          disabled={txnBusy[txn.id]}
                          className="text-xs text-red-500 font-medium hover:underline disabled:opacity-50"
                        >
                          {txnBusy[txn.id] ? 'Unreconciling...' : 'Unreconcile'}
                        </button>
                      )}
                    </div>
                    {txn.status === 'reconciled' && txnUnreconcileError[txn.id] && (
                      <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{txnUnreconcileError[txn.id]}</div>
                    )}
                    <div>
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
            const learnedRule = txnLearnedRule[txn.id]
            const learnedAccount = learnedRule ? allAccounts.find((a) => a.id === learnedRule.offset_account_id) : null

            return (
              <div key={txn.id} className={`grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden transition ${selected ? 'border-2 border-brand-gold shadow-md' : 'border border-gray-200 shadow-sm'}`}>
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

                  {learnedAccount && !selected && (
                    <div className="bg-brand-gold/20 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-brand-dark">
                        💡 Usually coded to <strong>{learnedAccount.code} — {learnedAccount.name}</strong>
                        {learnedRule.usage_count > 1 && ` (${learnedRule.usage_count}× before)`}
                      </p>
                      <button
                        onClick={() => applyLearnedRule(txn)}
                        disabled={busy}
                        className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 flex-shrink-0"
                      >
                        {busy ? 'Applying...' : 'Use this'}
                      </button>
                    </div>
                  )}

                  {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}

                  {panel === 'match' && (
                    <div className="space-y-3">
                      {matches.length === 0 ? (
                        <p className="text-sm text-gray-400">No matching {txn.amount > 0 ? 'receipts' : 'payments'} found for £{Math.abs(txn.amount).toFixed(2)} — try "Create" instead.</p>
                      ) : (
                        <div className="space-y-2">
                          {matches.map((m) => {
                            const isSelected = selected?.id === m.id
                            const confidence = confidenceLabel(m._scoring)
                            const amountDiff = m._scoring.amountDiff
                            return (
                              <button
                                key={m.id}
                                onClick={() => selectMatch(txn.id, m)}
                                className={`w-full text-left flex items-center justify-between rounded-lg px-4 py-2.5 border-2 transition ${
                                  isSelected ? 'border-brand-gold bg-white' : 'border-transparent bg-white hover:border-gray-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-brand-dark">
                                      {m.matchType === 'dividend' ? 'Dividend Payment' : m.contacts?.name}
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidence.style}`}>{confidence.label}</span>
                                  </div>
                                  <p className="text-xs text-gray-400">
                                    {new Date(m.receipt_date || m.payment_date).toLocaleDateString('en-GB')} · £{parseFloat(m.amount).toFixed(2)}
                                    {amountDiff > 0 && ` (£${amountDiff.toFixed(2)} difference)`}
                                    {' · '}{m.matchType === 'dividend' ? 'declared dividend, not yet marked paid' : (m.reference || 'no reference')}
                                  </p>
                                </div>
                                {isSelected && <span className="text-brand-dark text-sm">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {selected && (selected._scoring?.amountDiff || 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            £{selected._scoring.amountDiff.toFixed(2)} difference — where should this go? (e.g. Bank Charges)
                          </label>
                          <AccountSearchSelect
                            accounts={postableAccounts()}
                            value={txnMatchOffsetAccount[txn.id] || ''}
                            onChange={(id) => {
                              setTxnError((prev) => ({ ...prev, [txn.id]: '' }))
                              setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: null }))
                              setTxnMatchOffsetAccount((prev) => ({ ...prev, [txn.id]: id }))
                            }}
                          />
                          {txnAddingAccount[txn.id] !== 'match_diff' && (
                            <button
                              type="button"
                              onClick={() => { setTxnError((prev) => ({ ...prev, [txn.id]: '' })); setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: 'match_diff' })) }}
                              className="text-xs text-brand-dark hover:underline mt-1"
                            >
                              + Add new account
                            </button>
                          )}

                          {txnAddingAccount[txn.id] === 'match_diff' && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 mt-2">
                              {txnAddAccountError[txn.id] && (
                                <p className="text-xs text-red-600">{txnAddAccountError[txn.id]}</p>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Code (e.g. 6100)"
                                    value={txnNewAccountCode[txn.id] || ''}
                                    onChange={(e) => setTxnNewAccountCode((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                    className={`${inputClass} w-full`}
                                  />
                                  {txnNewAccountCode[txn.id] && (allAccounts.some((a) => a.code === txnNewAccountCode[txn.id]) || bankAccounts.some((a) => a.code === txnNewAccountCode[txn.id])) && (
                                    <p className="text-xs text-red-600 mt-1">Code already in use</p>
                                  )}
                                </div>
                                <select
                                  value={txnNewAccountType[txn.id] || 'overhead'}
                                  onChange={(e) => setTxnNewAccountType((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                  className={`${inputClass} w-full`}
                                >
                                  <option value="overhead">Overhead</option>
                                  <option value="direct_costs">Direct Costs</option>
                                  <option value="sales">Sales</option>
                                  <option value="other_income">Other Income</option>
                                  <option value="current_asset">Current Asset</option>
                                  <option value="current_liability">Current Liability</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                placeholder="Account name (e.g. Bank Charges)"
                                value={txnNewAccountName[txn.id] || ''}
                                onChange={(e) => setTxnNewAccountName((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                className={`${inputClass} w-full`}
                              />
                              {['direct_costs', 'expense', 'overhead', 'sales', 'other_income'].includes(txnNewAccountType[txn.id] || 'overhead') && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Default VAT rate *</label>
                                  <select
                                    value={txnNewAccountVatRateId[txn.id] || ''}
                                    onChange={(e) => setTxnNewAccountVatRateId((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                    className={`${inputClass} w-full`}
                                  >
                                    <option value="">Select VAT rate</option>
                                    {getRelevantVatRates(txnNewAccountType[txn.id] || 'overhead').map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                                  </select>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Parent account (optional, for sub-accounts)</label>
                                <select
                                  value={txnNewAccountParent[txn.id] || ''}
                                  onChange={(e) => setTxnNewAccountParent((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                  className={`${inputClass} w-full`}
                                >
                                  <option value="">None — top-level account</option>
                                  {allAccounts.filter((a) => !a.parent_id).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAddAccountInline(txn, 'match_diff')}
                                  disabled={txnAddAccountSaving[txn.id]}
                                  className="bg-brand-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                                >
                                  {txnAddAccountSaving[txn.id] ? 'Adding...' : 'Add account'}
                                </button>
                                <button
                                  onClick={() => setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: null }))}
                                  className="text-xs text-gray-500 hover:underline px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {selected && (
                        <button
                          onClick={() => selected.matchType === 'dividend' ? confirmDividendMatch(txn, selected) : confirmMatch(txn)}
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
                        <AccountSearchSelect
                          accounts={postableAccounts()}
                          value={txnOffsetAccount[txn.id] || ''}
                          onChange={(id) => {
                            setTxnError((prev) => ({ ...prev, [txn.id]: '' }))
                            setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: null }))
                            setTxnOffsetAccount((prev) => ({ ...prev, [txn.id]: id }))
                            const account = allAccounts.find((a) => a.id === id)
                            if (account && !(txn.id in txnVatRateId)) {
                              setTxnVatRateId((prev) => ({ ...prev, [txn.id]: account.default_vat_rate_id || '' }))
                            }
                          }}
                        />
                        {txnAddingAccount[txn.id] !== 'create' && (
                          <button
                            type="button"
                            onClick={() => { setTxnError((prev) => ({ ...prev, [txn.id]: '' })); setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: 'create' })) }}
                            className="text-xs text-brand-dark hover:underline mt-1"
                          >
                            + Add new account
                          </button>
                        )}
                      </div>

                      {txnAddingAccount[txn.id] === 'create' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                          {txnAddAccountError[txn.id] && (
                            <p className="text-xs text-red-600">{txnAddAccountError[txn.id]}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                type="text"
                                placeholder="Code (e.g. 6100)"
                                value={txnNewAccountCode[txn.id] || ''}
                                onChange={(e) => setTxnNewAccountCode((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                className={`${inputClass} w-full`}
                              />
                              {txnNewAccountCode[txn.id] && (allAccounts.some((a) => a.code === txnNewAccountCode[txn.id]) || bankAccounts.some((a) => a.code === txnNewAccountCode[txn.id])) && (
                                <p className="text-xs text-red-600 mt-1">Code already in use</p>
                              )}
                            </div>
                            <select
                              value={txnNewAccountType[txn.id] || 'overhead'}
                              onChange={(e) => setTxnNewAccountType((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                              className={`${inputClass} w-full`}
                            >
                              <option value="overhead">Overhead</option>
                              <option value="direct_costs">Direct Costs</option>
                              <option value="sales">Sales</option>
                              <option value="other_income">Other Income</option>
                              <option value="current_asset">Current Asset</option>
                              <option value="current_liability">Current Liability</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Account name (e.g. Bank Charges)"
                            value={txnNewAccountName[txn.id] || ''}
                            onChange={(e) => setTxnNewAccountName((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                            className={`${inputClass} w-full`}
                          />
                          {['direct_costs', 'expense', 'overhead', 'sales', 'other_income'].includes(txnNewAccountType[txn.id] || 'overhead') && (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Default VAT rate *</label>
                              <select
                                value={txnNewAccountVatRateId[txn.id] || ''}
                                onChange={(e) => setTxnNewAccountVatRateId((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                                className={`${inputClass} w-full`}
                              >
                                <option value="">Select VAT rate</option>
                                {getRelevantVatRates(txnNewAccountType[txn.id] || 'overhead').map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Parent account (optional, for sub-accounts)</label>
                            <select
                              value={txnNewAccountParent[txn.id] || ''}
                              onChange={(e) => setTxnNewAccountParent((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                              className={`${inputClass} w-full`}
                            >
                              <option value="">None — top-level account</option>
                              {allAccounts.filter((a) => !a.parent_id).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddAccountInline(txn, 'create')}
                              disabled={txnAddAccountSaving[txn.id]}
                              className="bg-brand-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                            >
                              {txnAddAccountSaving[txn.id] ? 'Adding...' : 'Add account'}
                            </button>
                            <button
                              onClick={() => setTxnAddingAccount((prev) => ({ ...prev, [txn.id]: null }))}
                              className="text-xs text-gray-500 hover:underline px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={txnCreateDesc[txn.id] ?? txn.description}
                          onChange={(e) => setTxnCreateDesc((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          VAT {txnVatRateId[txn.id] && <span className="text-brand-dark font-normal">(auto-suggested — change if needed)</span>}
                        </label>
                        <select
                          value={txnVatRateId[txn.id] || ''}
                          onChange={(e) => setTxnVatRateId((prev) => ({ ...prev, [txn.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        >
                          <option value="">No VAT</option>
                          {getRelevantVatRates(allAccounts.find((a) => a.id === txnOffsetAccount[txn.id])?.account_type || '').map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                        </select>
                        {(() => {
                          const rate = vatRates.find((r) => r.id === txnVatRateId[txn.id])
                          if (!rate) return null
                          const vat = calcVatFromGross(txn.amount, rate.rate)
                          const net = Math.abs(txn.amount) - vat
                          return (
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>Net: <strong className="text-brand-dark">£{net.toFixed(2)}</strong></span>
                              <span>VAT: <strong className="text-brand-dark">£{vat.toFixed(2)}</strong></span>
                              <span>Gross: <strong className="text-brand-dark">£{Math.abs(txn.amount).toFixed(2)}</strong></span>
                            </div>
                          )
                        })()}
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
