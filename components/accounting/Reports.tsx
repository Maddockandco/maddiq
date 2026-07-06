'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReportType = 'trial_balance' | 'profit_loss' | 'balance_sheet'

const ASSET_TYPES = ['bank', 'current_asset', 'fixed_asset', 'inventory', 'non_current_asset', 'prepayment']
const LIABILITY_TYPES = ['current_liability', 'non_current_liability', 'liability']
const EQUITY_TYPES = ['equity']
const INCOME_TYPES = ['sales', 'revenue', 'other_income']
const EXPENSE_TYPES = ['direct_costs', 'expense', 'overhead', 'depreciation']

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank', current_asset: 'Current Asset', fixed_asset: 'Fixed Asset', inventory: 'Inventory',
  non_current_asset: 'Non-current Asset', prepayment: 'Prepayment',
  current_liability: 'Current Liability', non_current_liability: 'Non-current Liability', liability: 'Liability',
  equity: 'Equity',
  direct_costs: 'Direct Costs', expense: 'Expense', overhead: 'Overhead', depreciation: 'Depreciation',
  sales: 'Sales', revenue: 'Revenue', other_income: 'Other Income',
}

function firstDayOfYear() {
  const now = new Date()
  return `${now.getFullYear()}-01-01`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function Reports({ clientId }: { clientId: string }) {
  const [reportType, setReportType] = useState<ReportType>('trial_balance')
  const [asOfDate, setAsOfDate] = useState(today())
  const [periodStart, setPeriodStart] = useState(firstDayOfYear())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => { fetchLines() }, [clientId, reportType, asOfDate, periodStart, periodEnd])

  async function fetchLines() {
    setLoading(true)
    setError('')

    let query = supabase
      .from('journal_lines')
      .select('debit, credit, account_id, chart_of_accounts(code, name, account_type), journal_entries!inner(entry_date, client_id)')
      .eq('journal_entries.client_id', clientId)

    if (reportType === 'profit_loss') {
      query = query.gte('journal_entries.entry_date', periodStart).lte('journal_entries.entry_date', periodEnd)
    } else {
      query = query.lte('journal_entries.entry_date', asOfDate)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setLines([])
    } else {
      setLines(data || [])
    }
    setLoading(false)
  }

  function accountBalances(typeFilter: string[]) {
    const balances: Record<string, { code: string; name: string; account_type: string; debit: number; credit: number }> = {}

    lines.forEach((l: any) => {
      const acc = l.chart_of_accounts
      if (!acc || !typeFilter.includes(acc.account_type)) return
      if (!balances[l.account_id]) {
        balances[l.account_id] = { code: acc.code, name: acc.name, account_type: acc.account_type, debit: 0, credit: 0 }
      }
      balances[l.account_id].debit += parseFloat(l.debit) || 0
      balances[l.account_id].credit += parseFloat(l.credit) || 0
    })

    return Object.values(balances).sort((a, b) => a.code.localeCompare(b.code))
  }

  function calculateNetProfit() {
    const income = accountBalances(INCOME_TYPES).reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const expenses = accountBalances(EXPENSE_TYPES).reduce((sum, a) => sum + (a.debit - a.credit), 0)
    return income - expenses
  }

  function renderTrialBalance() {
    const allTypes = [...ASSET_TYPES, ...LIABILITY_TYPES, ...EQUITY_TYPES, ...INCOME_TYPES, ...EXPENSE_TYPES]
    const rows = accountBalances(allTypes)
    let totalDebit = 0
    let totalCredit = 0

    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Code</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Account</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Debit</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const net = row.debit - row.credit
              const debitCol = net > 0 ? net : 0
              const creditCol = net < 0 ? -net : 0
              totalDebit += debitCol
              totalCredit += creditCol
              if (Math.abs(net) < 0.005) return null
              return (
                <tr key={row.code} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">{row.code}</td>
                  <td className="px-6 py-3 text-sm font-medium text-brand-dark">{row.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{TYPE_LABELS[row.account_type]}</td>
                  <td className="px-6 py-3 text-sm text-right">{debitCol > 0 ? `£${debitCol.toFixed(2)}` : ''}</td>
                  <td className="px-6 py-3 text-sm text-right">{creditCol > 0 ? `£${creditCol.toFixed(2)}` : ''}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={3} className="px-6 py-3 text-sm text-brand-dark">Total</td>
              <td className="px-6 py-3 text-sm text-right text-brand-dark">£{totalDebit.toFixed(2)}</td>
              <td className="px-6 py-3 text-sm text-right text-brand-dark">£{totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        {Math.abs(totalDebit - totalCredit) > 0.01 && (
          <div className="bg-red-50 text-red-600 text-sm px-6 py-3">
            ⚠ Trial balance does not balance — this indicates a data issue and should be investigated.
          </div>
        )}
      </div>
    )
  }

  function renderProfitLoss() {
    const income = accountBalances(INCOME_TYPES)
    const expenses = accountBalances(EXPENSE_TYPES)
    const incomeTotal = income.reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const expenseTotal = expenses.reduce((sum, a) => sum + (a.debit - a.credit), 0)
    const netProfit = incomeTotal - expenseTotal

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Income</p>
          {income.length === 0 ? (
            <p className="text-sm text-gray-400">No income recorded in this period</p>
          ) : (
            <div className="space-y-1">
              {income.map((row) => (
                <div key={row.code} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.code} — {row.name}</span>
                  <span className="font-medium text-brand-dark">£{(row.credit - row.debit).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total Income</span>
            <span className="text-brand-dark">£{incomeTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Expenses</p>
          {expenses.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded in this period</p>
          ) : (
            <div className="space-y-1">
              {expenses.map((row) => (
                <div key={row.code} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.code} — {row.name}</span>
                  <span className="font-medium text-brand-dark">£{(row.debit - row.credit).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total Expenses</span>
            <span className="text-brand-dark">£{expenseTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className={`rounded-xl p-4 flex justify-between items-center ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <span className="text-sm font-semibold text-brand-dark">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
          <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            £{Math.abs(netProfit).toFixed(2)}
          </span>
        </div>
      </div>
    )
  }

  function renderBalanceSheet() {
    const assets = accountBalances(ASSET_TYPES)
    const liabilities = accountBalances(LIABILITY_TYPES)
    const equity = accountBalances(EQUITY_TYPES)

    const assetTotal = assets.reduce((sum, a) => sum + (a.debit - a.credit), 0)
    const liabilityTotal = liabilities.reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const equityTotal = equity.reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const retainedEarnings = calculateNetProfit() - (incomeExpenseWithinBalanceSheetPeriod())

    // Net profit up to the as-of date, treated as unallocated retained earnings for a live/unclosed ledger
    function incomeExpenseWithinBalanceSheetPeriod() {
      // This is intentionally 0 here — calculateNetProfit() above already reflects
      // all income/expense lines up to asOfDate since lines are fetched with that filter
      // when reportType is not 'profit_loss'. Kept as a named function for clarity.
      return 0
    }

    const totalEquityWithRetained = equityTotal + retainedEarnings
    const totalLiabilitiesAndEquity = liabilityTotal + totalEquityWithRetained

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Assets</p>
          {assets.length === 0 ? (
            <p className="text-sm text-gray-400">No assets recorded</p>
          ) : (
            <div className="space-y-1">
              {assets.map((row) => (
                <div key={row.code} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.code} — {row.name}</span>
                  <span className="font-medium text-brand-dark">£{(row.debit - row.credit).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total Assets</span>
            <span className="text-brand-dark">£{assetTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Liabilities</p>
          {liabilities.length === 0 ? (
            <p className="text-sm text-gray-400">No liabilities recorded</p>
          ) : (
            <div className="space-y-1">
              {liabilities.map((row) => (
                <div key={row.code} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.code} — {row.name}</span>
                  <span className="font-medium text-brand-dark">£{(row.credit - row.debit).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total Liabilities</span>
            <span className="text-brand-dark">£{liabilityTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Equity</p>
          <div className="space-y-1">
            {equity.map((row) => (
              <div key={row.code} className="flex justify-between text-sm">
                <span className="text-gray-600">{row.code} — {row.name}</span>
                <span className="font-medium text-brand-dark">£{(row.credit - row.debit).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Retained Earnings (calculated)</span>
              <span className="font-medium text-brand-dark">£{calculateNetProfit().toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total Equity</span>
            <span className="text-brand-dark">£{(equityTotal + calculateNetProfit()).toFixed(2)}</span>
          </div>
        </div>

        <div className={`rounded-xl p-4 flex justify-between items-center ${Math.abs(assetTotal - (liabilityTotal + equityTotal + calculateNetProfit())) < 0.01 ? 'bg-green-50' : 'bg-red-50'}`}>
          <span className="text-sm font-semibold text-brand-dark">Total Liabilities + Equity</span>
          <span className="text-lg font-bold text-brand-dark">£{(liabilityTotal + equityTotal + calculateNetProfit()).toFixed(2)}</span>
        </div>
        {Math.abs(assetTotal - (liabilityTotal + equityTotal + calculateNetProfit())) > 0.01 && (
          <p className="text-xs text-red-600">⚠ Balance sheet does not balance — Assets (£{assetTotal.toFixed(2)}) should equal Liabilities + Equity.</p>
        )}
      </div>
    )
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      active ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`

  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setReportType('trial_balance')} className={tabClass(reportType === 'trial_balance')}>Trial Balance</button>
          <button onClick={() => setReportType('profit_loss')} className={tabClass(reportType === 'profit_loss')}>Profit & Loss</button>
          <button onClick={() => setReportType('balance_sheet')} className={tabClass(reportType === 'balance_sheet')}>Balance Sheet</button>
        </div>

        {reportType === 'profit_loss' ? (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">As at</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">Loading report...</p>
        </div>
      ) : (
        <>
          {reportType === 'trial_balance' && renderTrialBalance()}
          {reportType === 'profit_loss' && renderProfitLoss()}
          {reportType === 'balance_sheet' && renderBalanceSheet()}
        </>
      )}
    </div>
  )
}
