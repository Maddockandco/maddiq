'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const GRANULAR_TO_CATEGORY: Record<string, string> = {
  bank: 'asset', current_asset: 'asset', fixed_asset: 'asset', inventory: 'asset', non_current_asset: 'asset', prepayment: 'asset',
  current_liability: 'liability', non_current_liability: 'liability', liability: 'liability',
  equity: 'equity',
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense', corporation_tax: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}
function categoryOf(accountType: string): string {
  return GRANULAR_TO_CATEGORY[accountType] || 'other'
}
function monthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

// ---------- Revenue & Expense Trend ----------
export function RevenueTrendWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTrend() }, [clientId])

  async function fetchTrend() {
    setLoading(true)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit, chart_of_accounts(account_type), journal_entries!inner(entry_date, client_id)')
      .eq('journal_entries.client_id', clientId)
      .gte('journal_entries.entry_date', startDate)

    const months: Record<string, { income: number; expense: number }> = {}
    const cursor = new Date(twelveMonthsAgo)
    for (let i = 0; i < 12; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      months[key] = { income: 0, expense: 0 }
      cursor.setMonth(cursor.getMonth() + 1)
    }

    for (const l of lines || []) {
      const acc: any = (l as any).chart_of_accounts
      const entryDate = (l as any).journal_entries?.entry_date
      if (!acc || !entryDate) continue
      const category = categoryOf(acc.account_type)
      if (category !== 'income' && category !== 'expense') continue
      const d = new Date(entryDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) continue
      if (category === 'income') months[key].income += (parseFloat(l.credit as any) || 0) - (parseFloat(l.debit as any) || 0)
      else months[key].expense += (parseFloat(l.debit as any) || 0) - (parseFloat(l.credit as any) || 0)
    }

    setData(Object.entries(months).map(([key, v]) => {
      const [y, m] = key.split('-')
      return { month: monthLabel(new Date(parseInt(y), parseInt(m) - 1, 1)), Income: Math.round(v.income * 100) / 100, Expenses: Math.round(v.expense * 100) / 100 }
    }))
    setLoading(false)
  }

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Revenue & Expense Trend</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : (
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => `£${v}`} />
            <Legend />
            <Line type="monotone" dataKey="Income" stroke="#c9af69" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Expenses" stroke="#e57373" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------- Aging Summary (Debtors vs Payables) ----------
export function AgingSummaryWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAging() }, [clientId])

  async function fetchAging() {
    setLoading(true)
    const today = new Date()
    const bucketOf = (days: number) => days <= 0 ? 'Current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'
    const buckets = ['Current', '1-30', '31-60', '61-90', '90+']

    const [invRes, billRes] = await Promise.all([
      supabase.from('sales_invoices').select('total, amount_paid, due_date').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
      supabase.from('purchase_bills').select('total, amount_paid, due_date').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
    ])

    const debtors: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    const payables: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inv of invRes.data || []) {
      const outstanding = parseFloat(inv.total) - parseFloat(inv.amount_paid || 0)
      if (outstanding <= 0.005) continue
      const days = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000)
      debtors[bucketOf(days)] += outstanding
    }
    for (const bill of billRes.data || []) {
      const outstanding = parseFloat(bill.total) - parseFloat(bill.amount_paid || 0)
      if (outstanding <= 0.005) continue
      const days = Math.floor((today.getTime() - new Date(bill.due_date).getTime()) / 86400000)
      payables[bucketOf(days)] += outstanding
    }
    setData(buckets.map((b) => ({ bucket: b, Debtors: Math.round(debtors[b] * 100) / 100, Payables: Math.round(payables[b] * 100) / 100 })))
    setLoading(false)
  }

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Debtors vs Payables Aging</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : (
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => `£${v}`} />
            <Legend />
            <Bar dataKey="Debtors" fill="#c9af69" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Payables" fill="#343b46" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------- Top Customers / Suppliers (shared implementation, different table) ----------
function useTopContacts(clientId: string, table: 'sales_invoices' | 'purchase_bills') {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTop() {
      setLoading(true)
      const { data: rows } = await supabase
        .from(table)
        .select('total, amount_paid, contacts(name)')
        .eq('client_id', clientId)
        .in('status', ['awaiting_payment', 'partially_paid'])
      const totals: Record<string, number> = {}
      for (const r of rows || []) {
        const name = (r as any).contacts?.name || 'Unknown'
        const outstanding = parseFloat(r.total) - parseFloat(r.amount_paid || 0)
        if (outstanding <= 0.005) continue
        totals[name] = (totals[name] || 0) + outstanding
      }
      setData(Object.entries(totals).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5))
      setLoading(false)
    }
    fetchTop()
  }, [clientId, table])

  return { data, loading }
}

export function TopCustomersWidget({ clientId }: { clientId: string }) {
  const { data, loading } = useTopContacts(clientId, 'sales_invoices')
  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Top Customers by Amount Owed</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : data.length === 0 ? <p className="text-xs text-gray-400">No outstanding balances</p> : (
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={(v: any) => `£${v}`} />
            <Bar dataKey="value" fill="#c9af69" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function TopSuppliersWidget({ clientId }: { clientId: string }) {
  const { data, loading } = useTopContacts(clientId, 'purchase_bills')
  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Top Suppliers by Amount Owed</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : data.length === 0 ? <p className="text-xs text-gray-400">No outstanding balances</p> : (
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={(v: any) => `£${v}`} />
            <Bar dataKey="value" fill="#343b46" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------- Cash Balance ----------
export function CashBalanceWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBalances() {
      setLoading(true)
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('debit, credit, account_id, chart_of_accounts(code, name, account_type), journal_entries!inner(client_id)')
        .eq('journal_entries.client_id', clientId)
        .eq('chart_of_accounts.account_type', 'bank')

      const balances: Record<string, { code: string; name: string; balance: number }> = {}
      for (const l of lines || []) {
        const acc: any = (l as any).chart_of_accounts
        if (!acc) continue
        if (!balances[l.account_id]) balances[l.account_id] = { code: acc.code, name: acc.name, balance: 0 }
        balances[l.account_id].balance += (parseFloat(l.debit as any) || 0) - (parseFloat(l.credit as any) || 0)
      }
      setAccounts(Object.values(balances))
      setLoading(false)
    }
    fetchBalances()
  }, [clientId])

  const total = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Cash Balance</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-3xl font-bold text-brand-dark text-center">£{total.toFixed(2)}</p>
          <div className="mt-3 space-y-1">
            {accounts.map((a) => (
              <div key={a.code} className="flex justify-between text-xs">
                <span className="text-gray-500">{a.name}</span>
                <span className="text-brand-dark font-medium">£{a.balance.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Profit Snapshot (current calendar month) ----------
export function ProfitSnapshotWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [result, setResult] = useState<{ income: number; expense: number; profit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSnapshot() {
      setLoading(true)
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const end = now.toISOString().split('T')[0]

      const { data: lines } = await supabase
        .from('journal_lines')
        .select('debit, credit, chart_of_accounts(account_type), journal_entries!inner(entry_date, client_id)')
        .eq('journal_entries.client_id', clientId)
        .gte('journal_entries.entry_date', start)
        .lte('journal_entries.entry_date', end)

      let income = 0, expense = 0
      for (const l of lines || []) {
        const acc: any = (l as any).chart_of_accounts
        if (!acc) continue
        const category = categoryOf(acc.account_type)
        if (category === 'income') income += (parseFloat(l.credit as any) || 0) - (parseFloat(l.debit as any) || 0)
        if (category === 'expense') expense += (parseFloat(l.debit as any) || 0) - (parseFloat(l.credit as any) || 0)
      }
      setResult({ income, expense, profit: income - expense })
      setLoading(false)
    }
    fetchSnapshot()
  }, [clientId])

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">This Month's Profit</p>
      {loading || !result ? <p className="text-xs text-gray-400">Loading...</p> : (
        <div className="flex-1 flex flex-col justify-center space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Income</span><span className="text-brand-dark font-medium">£{result.income.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Expenses</span><span className="text-brand-dark font-medium">£{result.expense.toFixed(2)}</span></div>
          <div className={`flex justify-between text-lg font-bold border-t border-gray-100 pt-2 ${result.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span>Profit</span><span>£{result.profit.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Recent Transactions ----------
export function RecentTransactionsWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecent() {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('id, entry_date, description')
        .eq('client_id', clientId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8)
      setTransactions(data || [])
      setLoading(false)
    }
    fetchRecent()
  }, [clientId])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Recent Activity</p>
      {loading ? <p className="text-xs text-gray-400">Loading...</p> : transactions.length === 0 ? <p className="text-xs text-gray-400">No activity yet</p> : (
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {transactions.map((t) => (
            <div key={t.id} className="text-xs border-b border-gray-50 pb-1.5">
              <p className="text-brand-dark truncate">{t.description}</p>
              <p className="text-gray-400">{new Date(t.entry_date).toLocaleDateString('en-GB')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
