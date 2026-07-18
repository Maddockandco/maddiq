'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DatePicker from '@/components/ui/DatePicker'

type ReportType = 'trial_balance' | 'profit_loss' | 'balance_sheet'
type Basis = 'accruals' | 'cash'

const GRANULAR_TO_CATEGORY: Record<string, string> = {
  bank: 'asset', current_asset: 'asset', fixed_asset: 'asset', inventory: 'asset', non_current_asset: 'asset', prepayment: 'asset',
  current_liability: 'liability', non_current_liability: 'liability', liability: 'liability',
  equity: 'equity',
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense', corporation_tax: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}

function categoryOf(accountType: string): string {
  if (['asset', 'liability', 'equity', 'income', 'expense'].includes(accountType)) {
    return accountType
  }
  return GRANULAR_TO_CATEGORY[accountType] || 'other'
}

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

type AccountLine = { code: string; name: string; amount: number; account_type?: string }

export default function Reports({ clientId }: { clientId: string }) {
  const [reportType, setReportType] = useState<ReportType>('trial_balance')
  const [basis, setBasis] = useState<Basis>('accruals')
  const [asOfDate, setAsOfDate] = useState(today())
  const [periodStart, setPeriodStart] = useState(firstDayOfYear())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [lines, setLines] = useState<any[]>([])
  const [cashIncome, setCashIncome] = useState<AccountLine[]>([])
  const [cashExpenses, setCashExpenses] = useState<AccountLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (reportType === 'profit_loss' && basis === 'cash') {
      fetchCashBasisPL()
    } else {
      fetchLedgerLines()
    }
  }, [clientId, reportType, basis, asOfDate, periodStart, periodEnd])

  async function fetchLedgerLines() {
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

  async function fetchCashBasisPL() {
    setLoading(true)
    setError('')

    try {
      const { data: salesAllocs, error: salesErr } = await supabase
        .from('sales_receipt_allocations')
        .select('amount_allocated, invoice_id, sales_receipts!inner(receipt_date, client_id)')
        .eq('sales_receipts.client_id', clientId)
        .gte('sales_receipts.receipt_date', periodStart)
        .lte('sales_receipts.receipt_date', periodEnd)

      if (salesErr) throw salesErr

      const invoiceIds = Array.from(new Set((salesAllocs || []).map((a: any) => a.invoice_id)))
      const incomeByAccount: Record<string, AccountLine> = {}

      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase.from('sales_invoices').select('id, total').in('id', invoiceIds)
        const { data: invoiceLines } = await supabase
          .from('sales_invoice_lines')
          .select('invoice_id, income_account_id, line_total, chart_of_accounts(code, name, account_type)')
          .in('invoice_id', invoiceIds)

        const invoiceMap = new Map((invoices || []).map((i: any) => [i.id, i]))

        for (const alloc of salesAllocs || []) {
          const invoice = invoiceMap.get(alloc.invoice_id)
          if (!invoice || parseFloat(invoice.total) === 0) continue
          const proportion = parseFloat(alloc.amount_allocated) / parseFloat(invoice.total)
          const linesForInvoice = (invoiceLines || []).filter((l: any) => l.invoice_id === alloc.invoice_id)

          for (const line of linesForInvoice) {
            const acc: any = Array.isArray(line.chart_of_accounts) ? line.chart_of_accounts[0] : line.chart_of_accounts
            if (!acc) continue
            const key = line.income_account_id || 'unmapped'
            const cashAmount = parseFloat(line.line_total) * proportion
            if (!incomeByAccount[key]) {
              incomeByAccount[key] = { code: acc.code, name: acc.name, amount: 0, account_type: acc.account_type }
            }
            incomeByAccount[key].amount += cashAmount
          }
        }
      }

      const { data: purchaseAllocs, error: purchaseErr } = await supabase
        .from('purchase_payment_allocations')
        .select('amount_allocated, bill_id, purchase_payments!inner(payment_date, client_id)')
        .eq('purchase_payments.client_id', clientId)
        .gte('purchase_payments.payment_date', periodStart)
        .lte('purchase_payments.payment_date', periodEnd)

      if (purchaseErr) throw purchaseErr

      const billIds = Array.from(new Set((purchaseAllocs || []).map((a: any) => a.bill_id)))
      const expenseByAccount: Record<string, AccountLine> = {}

      if (billIds.length > 0) {
        const { data: bills } = await supabase.from('purchase_bills').select('id, total').in('id', billIds)
        const { data: billLines } = await supabase
          .from('purchase_bill_lines')
          .select('bill_id, expense_account_id, line_total, chart_of_accounts(code, name, account_type)')
          .in('bill_id', billIds)

        const billMap = new Map((bills || []).map((b: any) => [b.id, b]))

        for (const alloc of purchaseAllocs || []) {
          const bill = billMap.get(alloc.bill_id)
          if (!bill || parseFloat(bill.total) === 0) continue
          const proportion = parseFloat(alloc.amount_allocated) / parseFloat(bill.total)
          const linesForBill = (billLines || []).filter((l: any) => l.bill_id === alloc.bill_id)

          for (const line of linesForBill) {
            const acc: any = Array.isArray(line.chart_of_accounts) ? line.chart_of_accounts[0] : line.chart_of_accounts
            if (!acc) continue
            const key = line.expense_account_id || 'unmapped'
            const cashAmount = parseFloat(line.line_total) * proportion
            if (!expenseByAccount[key]) {
              expenseByAccount[key] = { code: acc.code, name: acc.name, amount: 0, account_type: acc.account_type }
            }
            expenseByAccount[key].amount += cashAmount
          }
        }
      }

      setCashIncome(Object.values(incomeByAccount).sort((a, b) => a.code.localeCompare(b.code)))
      setCashExpenses(Object.values(expenseByAccount).sort((a, b) => a.code.localeCompare(b.code)))
    } catch (e: any) {
      setError(e.message || 'Failed to calculate cash basis report')
    }
    setLoading(false)
  }

  function accountBalances(category: string) {
    const balances: Record<string, { code: string; name: string; account_type: string; debit: number; credit: number }> = {}

    lines.forEach((l: any) => {
      const acc = l.chart_of_accounts
      if (!acc || categoryOf(acc.account_type) !== category) return
      if (!balances[l.account_id]) {
        balances[l.account_id] = { code: acc.code, name: acc.name, account_type: acc.account_type, debit: 0, credit: 0 }
      }
      balances[l.account_id].debit += parseFloat(l.debit) || 0
      balances[l.account_id].credit += parseFloat(l.credit) || 0
    })

    return Object.values(balances).sort((a, b) => a.code.localeCompare(b.code))
  }

  function allAccountBalances() {
    const balances: Record<string, { code: string; name: string; account_type: string; debit: number; credit: number }> = {}

    lines.forEach((l: any) => {
      const acc = l.chart_of_accounts
      if (!acc) return
      if (!balances[l.account_id]) {
        balances[l.account_id] = { code: acc.code, name: acc.name, account_type: acc.account_type, debit: 0, credit: 0 }
      }
      balances[l.account_id].debit += parseFloat(l.debit) || 0
      balances[l.account_id].credit += parseFloat(l.credit) || 0
    })

    return Object.values(balances).sort((a, b) => a.code.localeCompare(b.code))
  }

  function getUncategorizedAccounts() {
    return allAccountBalances().filter((row) => {
      const net = row.debit - row.credit
      return categoryOf(row.account_type) === 'other' && Math.abs(net) > 0.005
    })
  }

  function calculateNetProfit() {
    const income = accountBalances('income').reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const expenses = accountBalances('expense').reduce((sum, a) => sum + (a.debit - a.credit), 0)
    return income - expenses
  }

  function renderTrialBalance() {
    const rows = allAccountBalances()
    let totalDebit = 0
    let totalCredit = 0

    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
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
                  <td className="px-6 py-3 text-sm text-gray-400">{TYPE_LABELS[row.account_type] || row.account_type}</td>
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
          </div>
        {Math.abs(totalDebit - totalCredit) > 0.01 && (
          <div className="bg-red-50 text-red-600 text-sm px-6 py-3">
            ⚠ Trial balance does not balance — this indicates a data issue and should be investigated.
          </div>
        )}
      </div>
    )
  }

  function renderProfitLoss() {
    const income = basis === 'cash'
      ? cashIncome.map(a => ({ code: a.code, name: a.name, value: a.amount, account_type: a.account_type }))
      : accountBalances('income').map(a => ({ code: a.code, name: a.name, value: a.credit - a.debit, account_type: a.account_type }))
    const expenses = basis === 'cash'
      ? cashExpenses.map(a => ({ code: a.code, name: a.name, value: a.amount, account_type: a.account_type }))
      : accountBalances('expense').map(a => ({ code: a.code, name: a.name, value: a.debit - a.credit, account_type: a.account_type }))

    const turnover = income.filter((a) => ['sales', 'revenue'].includes(a.account_type || ''))
    const otherIncome = income.filter((a) => a.account_type === 'other_income')
    const costOfSales = expenses.filter((a) => a.account_type === 'direct_costs')
    const operatingExpenses = expenses.filter((a) => ['expense', 'overhead', 'depreciation'].includes(a.account_type || ''))
    const corporationTax = expenses.filter((a) => a.account_type === 'corporation_tax')

    const turnoverTotal = turnover.reduce((sum, a) => sum + a.value, 0)
    const costOfSalesTotal = costOfSales.reduce((sum, a) => sum + a.value, 0)
    const grossProfit = turnoverTotal - costOfSalesTotal
    const operatingExpensesTotal = operatingExpenses.reduce((sum, a) => sum + a.value, 0)
    const operatingProfit = grossProfit - operatingExpensesTotal
    const otherIncomeTotal = otherIncome.reduce((sum, a) => sum + a.value, 0)
    const profitBeforeTax = operatingProfit + otherIncomeTotal
    const corporationTaxTotal = corporationTax.reduce((sum, a) => sum + a.value, 0)
    const profitAfterTax = profitBeforeTax - corporationTaxTotal

    function plSection(title: string, rows: typeof income, total: number, noDataLabel: string) {
      return (
        <div>
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">{title}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">{noDataLabel}</p>
          ) : (
            <div className="space-y-1">
              {rows.map((row) => (
                <div key={row.code} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.code} — {row.name}</span>
                  <span className="font-medium text-brand-dark">£{row.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-2 pt-2">
            <span className="text-brand-dark">Total {title}</span>
            <span className="text-brand-dark">£{total.toFixed(2)}</span>
          </div>
        </div>
      )
    }

    function plSubtotal(label: string, value: number) {
      return (
        <div className="flex justify-between text-sm font-bold bg-brand-light rounded-lg px-4 py-2">
          <span className="text-brand-dark">{label}</span>
          <span className="text-brand-dark">£{value.toFixed(2)}</span>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        {plSection('Turnover', turnover, turnoverTotal, `No turnover ${basis === 'cash' ? 'received' : 'recorded'} in this period`)}
        {plSection('Cost of Sales', costOfSales, costOfSalesTotal, `No cost of sales ${basis === 'cash' ? 'paid' : 'recorded'} in this period`)}
        {plSubtotal('Gross Profit', grossProfit)}

        {plSection('Operating Expenses', operatingExpenses, operatingExpensesTotal, `No operating expenses ${basis === 'cash' ? 'paid' : 'recorded'} in this period`)}
        {plSubtotal('Operating Profit', operatingProfit)}

        {plSection('Other Income', otherIncome, otherIncomeTotal, `No other income ${basis === 'cash' ? 'received' : 'recorded'} in this period`)}

        <div className={`rounded-xl p-4 flex justify-between items-center ${profitBeforeTax >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <span className="text-sm font-semibold text-brand-dark">{profitBeforeTax >= 0 ? 'Profit Before Tax' : 'Loss Before Tax'}</span>
          <span className={`text-lg font-bold ${profitBeforeTax >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            £{Math.abs(profitBeforeTax).toFixed(2)}
          </span>
        </div>

        {corporationTax.length > 0 && (
          <>
            {plSection('Corporation Tax', corporationTax, corporationTaxTotal, 'No Corporation Tax charge recorded in this period')}

            <div className={`rounded-xl p-4 flex justify-between items-center ${profitAfterTax >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="text-sm font-semibold text-brand-dark">{profitAfterTax >= 0 ? 'Profit After Tax' : 'Loss After Tax'}</span>
              <span className={`text-lg font-bold ${profitAfterTax >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                £{Math.abs(profitAfterTax).toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderBalanceSheet() {
    const assets = accountBalances('asset')
    const liabilities = accountBalances('liability')
    const equity = accountBalances('equity')

    const assetTotal = assets.reduce((sum, a) => sum + (a.debit - a.credit), 0)
    const liabilityTotal = liabilities.reduce((sum, a) => sum + (a.credit - a.debit), 0)
    const equityTotal = equity.reduce((sum, a) => sum + (a.credit - a.debit), 0)

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setReportType('trial_balance')} className={tabClass(reportType === 'trial_balance')}>Trial Balance</button>
          <button onClick={() => setReportType('profit_loss')} className={tabClass(reportType === 'profit_loss')}>Profit & Loss</button>
          <button onClick={() => setReportType('balance_sheet')} className={tabClass(reportType === 'balance_sheet')}>Balance Sheet</button>
        </div>

        {reportType === 'profit_loss' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setBasis('accruals')}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${basis === 'accruals' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
              >
                Accruals
              </button>
              <button
                onClick={() => setBasis('cash')}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${basis === 'cash' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
              >
                Cash basis
              </button>
            </div>
            <label className="text-xs text-gray-500">From</label>
            <DatePicker value={periodStart} onChange={setPeriodStart} />
            <label className="text-xs text-gray-500">To</label>
            <DatePicker value={periodEnd} onChange={setPeriodEnd} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">As at</label>
            <DatePicker value={asOfDate} onChange={setAsOfDate} />
          </div>
        )}
      </div>

      {reportType === 'profit_loss' && basis === 'cash' && (
        <div className="bg-blue-50 text-blue-700 text-xs rounded-lg px-4 py-3">
          Cash basis recognizes income when received and expenses when paid, based on Receipts and Payments — not invoice/bill dates. Trial Balance and Balance Sheet always reflect the full accruals ledger, since that's what the underlying double-entry books actually are.
        </div>
      )}

      {!loading && !(reportType === 'profit_loss' && basis === 'cash') && getUncategorizedAccounts().length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-red-700 text-sm font-semibold mb-1">⚠ Uncategorized accounts detected</p>
          <p className="text-red-600 text-xs mb-2">
            The following accounts have balances but their type doesn't match a known category (Asset/Liability/Equity/Income/Expense), so they're excluded from Balance Sheet and P&L totals. Fix their Type in Chart of Accounts to resolve this.
          </p>
          <ul className="text-xs text-red-600 space-y-0.5">
            {getUncategorizedAccounts().map((row) => (
              <li key={row.code}>
                <span className="font-mono">{row.code}</span> — {row.name} (type: "{row.account_type}", balance: £{(row.debit - row.credit).toFixed(2)})
              </li>
            ))}
          </ul>
        </div>
      )}

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
