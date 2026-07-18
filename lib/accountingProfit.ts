import { createClient } from '@/lib/supabase/client'

// Mirrors Reports.tsx's accrual-basis P&L categorization exactly, so the profit figure
// used for Corporation Tax always matches what the P&L report itself would show for
// the same period - no risk of the two drifting apart.
const GRANULAR_TO_CATEGORY: Record<string, string> = {
  bank: 'asset', current_asset: 'asset', fixed_asset: 'asset', inventory: 'asset', non_current_asset: 'asset', prepayment: 'asset',
  current_liability: 'liability', non_current_liability: 'liability', liability: 'liability',
  equity: 'equity',
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}

function categoryOf(accountType: string): string {
  if (['asset', 'liability', 'equity', 'income', 'expense'].includes(accountType)) return accountType
  return GRANULAR_TO_CATEGORY[accountType] || 'other'
}

export type AccountingProfitResult = {
  turnover: number
  costOfSales: number
  grossProfit: number
  operatingExpenses: number
  operatingProfit: number
  otherIncome: number
  depreciationTotal: number
  accountingProfit: number // Profit Before Tax
}

export async function getAccountingProfit(clientId: string, periodStart: string, periodEnd: string): Promise<AccountingProfitResult> {
  const supabase = createClient()

  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit, credit, account_id, chart_of_accounts(code, name, account_type), journal_entries!inner(entry_date, client_id)')
    .eq('journal_entries.client_id', clientId)
    .gte('journal_entries.entry_date', periodStart)
    .lte('journal_entries.entry_date', periodEnd)

  const balances: Record<string, { account_type: string; debit: number; credit: number }> = {}
  for (const l of lines || []) {
    const acc = (l as any).chart_of_accounts
    if (!acc) continue
    if (!balances[l.account_id]) balances[l.account_id] = { account_type: acc.account_type, debit: 0, credit: 0 }
    balances[l.account_id].debit += parseFloat(l.debit as any) || 0
    balances[l.account_id].credit += parseFloat(l.credit as any) || 0
  }

  const rows = Object.values(balances)
  const income = rows.filter((r) => categoryOf(r.account_type) === 'income').map((r) => ({ account_type: r.account_type, value: r.credit - r.debit }))
  const expenses = rows.filter((r) => categoryOf(r.account_type) === 'expense').map((r) => ({ account_type: r.account_type, value: r.debit - r.credit }))

  const turnover = income.filter((a) => ['sales', 'revenue'].includes(a.account_type)).reduce((sum, a) => sum + a.value, 0)
  const otherIncome = income.filter((a) => a.account_type === 'other_income').reduce((sum, a) => sum + a.value, 0)
  const costOfSales = expenses.filter((a) => a.account_type === 'direct_costs').reduce((sum, a) => sum + a.value, 0)
  const operatingExpenses = expenses.filter((a) => ['expense', 'overhead', 'depreciation'].includes(a.account_type)).reduce((sum, a) => sum + a.value, 0)
  const depreciationTotal = expenses.filter((a) => a.account_type === 'depreciation').reduce((sum, a) => sum + a.value, 0)

  const grossProfit = turnover - costOfSales
  const operatingProfit = grossProfit - operatingExpenses
  const accountingProfit = operatingProfit + otherIncome

  return { turnover, costOfSales, grossProfit, operatingExpenses, operatingProfit, otherIncome, depreciationTotal, accountingProfit }
}
