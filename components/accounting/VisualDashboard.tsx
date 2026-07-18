'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const GRANULAR_TO_CATEGORY: Record<string, string> = {
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense', corporation_tax: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}

function categoryOf(accountType: string): string {
  return GRANULAR_TO_CATEGORY[accountType] || 'other'
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

export default function VisualDashboard({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState<any[]>([])
  const [agingData, setAgingData] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [topSuppliers, setTopSuppliers] = useState<any[]>([])

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchTrend(), fetchAging(), fetchTopContacts()])
    setLoading(false)
  }

  async function fetchTrend() {
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

    const result = Object.entries(months).map(([key, v]) => {
      const [y, m] = key.split('-')
      const label = monthLabel(new Date(parseInt(y), parseInt(m) - 1, 1))
      return { month: label, Income: Math.round(v.income * 100) / 100, Expenses: Math.round(v.expense * 100) / 100, Profit: Math.round((v.income - v.expense) * 100) / 100 }
    })
    setTrendData(result)
  }

  async function fetchAging() {
    const today = new Date()
    const bucketOf = (daysOverdue: number) => {
      if (daysOverdue <= 0) return 'Current'
      if (daysOverdue <= 30) return '1-30'
      if (daysOverdue <= 60) return '31-60'
      if (daysOverdue <= 90) return '61-90'
      return '90+'
    }

    const [invRes, billRes] = await Promise.all([
      supabase.from('sales_invoices').select('total, amount_paid, due_date').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
      supabase.from('purchase_bills').select('total, amount_paid, due_date').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
    ])

    const buckets = ['Current', '1-30', '31-60', '61-90', '90+']
    const debtorTotals: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    const payableTotals: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }

    for (const inv of invRes.data || []) {
      const outstanding = parseFloat(inv.total) - parseFloat(inv.amount_paid || 0)
      if (outstanding <= 0.005) continue
      const days = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
      debtorTotals[bucketOf(days)] += outstanding
    }
    for (const bill of billRes.data || []) {
      const outstanding = parseFloat(bill.total) - parseFloat(bill.amount_paid || 0)
      if (outstanding <= 0.005) continue
      const days = Math.floor((today.getTime() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24))
      payableTotals[bucketOf(days)] += outstanding
    }

    setAgingData(buckets.map((b) => ({ bucket: b, Debtors: Math.round(debtorTotals[b] * 100) / 100, Payables: Math.round(payableTotals[b] * 100) / 100 })))
  }

  async function fetchTopContacts() {
    const [invRes, billRes] = await Promise.all([
      supabase.from('sales_invoices').select('total, amount_paid, contacts(name)').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
      supabase.from('purchase_bills').select('total, amount_paid, contacts(name)').eq('client_id', clientId).in('status', ['awaiting_payment', 'partially_paid']),
    ])

    const customerTotals: Record<string, number> = {}
    for (const inv of invRes.data || []) {
      const name = (inv as any).contacts?.name || 'Unknown'
      const outstanding = parseFloat(inv.total) - parseFloat(inv.amount_paid || 0)
      if (outstanding <= 0.005) continue
      customerTotals[name] = (customerTotals[name] || 0) + outstanding
    }
    const supplierTotals: Record<string, number> = {}
    for (const bill of billRes.data || []) {
      const name = (bill as any).contacts?.name || 'Unknown'
      const outstanding = parseFloat(bill.total) - parseFloat(bill.amount_paid || 0)
      if (outstanding <= 0.005) continue
      supplierTotals[name] = (supplierTotals[name] || 0) + outstanding
    }

    setTopCustomers(Object.entries(customerTotals).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5))
    setTopSuppliers(Object.entries(supplierTotals).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5))
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading dashboard...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Visual Dashboard</h3>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-4">Revenue, Expenses & Profit — Last 12 Months</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `£${value}`} />
            <Legend />
            <Line type="monotone" dataKey="Income" stroke="#c9af69" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Expenses" stroke="#e57373" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Profit" stroke="#343b46" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-4">Debtors vs Payables — Aging</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={agingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `£${value}`} />
            <Legend />
            <Bar dataKey="Debtors" fill="#c9af69" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Payables" fill="#343b46" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-4">Top 5 Customers by Amount Owed</p>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-gray-400">No outstanding customer balances</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: any) => `£${value}`} />
                <Bar dataKey="value" fill="#c9af69" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-4">Top 5 Suppliers by Amount Owed</p>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-gray-400">No outstanding supplier balances</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSuppliers} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: any) => `£${value}`} />
                <Bar dataKey="value" fill="#343b46" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
