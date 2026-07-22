import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FLAT_RATE_SECTORS, LIMITED_COST_TRADER_RATE } from '@/lib/flatRateSectors'
import { calculateLimitedCostStatus, LimitedCostTraderResult } from '@/lib/limitedCostTrader'

// Every calculation function below accepts an optional `db` client, defaulting
// to the browser client if not passed. This exists specifically because the
// default browser client silently returns EMPTY results (not an error) when
// called from a server context with no user session attached - RLS blocks an
// unauthenticated read rather than throwing. Server routes (e.g. HMRC
// submission) MUST pass their own properly-authenticated client through here,
// or every box silently computes as £0 with no error to catch it.

// UK VAT Return, structured around the real 9 boxes, computed on a standard (accrual)
// VAT accounting basis - i.e. by invoice/bill date (tax point), not payment date.
// Boxes 2, 8, and 9 relate to Northern Ireland EU goods movements, which are £0 for
// the vast majority of GB businesses - included for completeness and left editable,
// not auto-calculated, since they need specific EU trade data this app doesn't hold.
//
// Known limitation: this does not yet apply special treatment for the domestic reverse
// charge (e.g. construction) VAT code, where the customer - not the supplier - accounts
// for the VAT. That would need to add the same amount to both Box 1 and Box 4, net
// effect zero on Box 5, but affecting the Box 6/7 breakdown. Flag any reverse-charge
// transactions in the period for manual review before filing.

export type VatReturnLineRef = {
  sourceTable: 'sales_invoice_lines' | 'purchase_bill_lines'
  sourceLineId: string
  boxType: 'box1' | 'box4'
  netAmount: number
  vatAmount: number
}

export type VatReturnResult = {
  box1VatOnSales: number
  box3TotalVatDue: number
  box4VatReclaimed: number
  box5NetVat: number
  box6TotalSalesExVat: number
  box7TotalPurchasesExVat: number
  reverseChargeLinesFound: number
  // Only populated for Standard and Flat Rate schemes - Cash Accounting
  // calculates proportionally off payment allocations, not whole lines, so
  // it can't be snapshotted at this same granularity (see note on
  // calculateVatReturnCashBasis). Automatic post-filing correction detection
  // is a known gap for Cash Accounting clients until that's built separately.
  lineRefs?: VatReturnLineRef[]
}

export type VatTransactionDetail = {
  date: string
  reference: string
  contactName: string
  netAmount: number
  vatAmount: number
  note?: string
}

export type VatReturnDetail = {
  salesTransactions: VatTransactionDetail[]
  purchaseTransactions: VatTransactionDetail[]
  box1IsCalculated?: boolean
}

export async function calculateVatReturn(clientId: string, periodStart: string, periodEnd: string, db?: SupabaseClient): Promise<VatReturnResult> {
  const supabase = db || createClient()

  const [salesRes, purchaseRes] = await Promise.all([
    supabase
      .from('sales_invoice_lines')
      .select('id, vat_amount, line_total, vat_rate_id, vat_rates(code), sales_invoices!inner(invoice_date, client_id, status)')
      .eq('sales_invoices.client_id', clientId)
      .neq('sales_invoices.status', 'draft')
      .neq('sales_invoices.status', 'cancelled')
      .gte('sales_invoices.invoice_date', periodStart)
      .lte('sales_invoices.invoice_date', periodEnd),
    supabase
      .from('purchase_bill_lines')
      .select('id, vat_amount, line_total, vat_rate_id, vat_rates(code), purchase_bills!inner(bill_date, client_id, status)')
      .eq('purchase_bills.client_id', clientId)
      .neq('purchase_bills.status', 'draft')
      .neq('purchase_bills.status', 'cancelled')
      .gte('purchase_bills.bill_date', periodStart)
      .lte('purchase_bills.bill_date', periodEnd),
  ])

  let box1 = 0, box6 = 0
  let reverseChargeCount = 0
  const lineRefs: VatReturnLineRef[] = []
  for (const l of salesRes.data || []) {
    const vat = parseFloat((l as any).vat_amount) || 0
    const net = parseFloat((l as any).line_total) || 0
    box1 += vat
    box6 += net
    if ((l as any).vat_rates?.code?.includes('reverse_charge')) reverseChargeCount++
    lineRefs.push({ sourceTable: 'sales_invoice_lines', sourceLineId: (l as any).id, boxType: 'box1', netAmount: net, vatAmount: vat })
  }

  let box4 = 0, box7 = 0
  for (const l of purchaseRes.data || []) {
    const vat = parseFloat((l as any).vat_amount) || 0
    const net = parseFloat((l as any).line_total) || 0
    box4 += vat
    box7 += net
    if ((l as any).vat_rates?.code?.includes('reverse_charge')) reverseChargeCount++
    lineRefs.push({ sourceTable: 'purchase_bill_lines', sourceLineId: (l as any).id, boxType: 'box4', netAmount: net, vatAmount: vat })
  }

  const box3 = box1
  const box5 = box3 - box4

  return {
    box1VatOnSales: Math.round(box1 * 100) / 100,
    box3TotalVatDue: Math.round(box3 * 100) / 100,
    box4VatReclaimed: Math.round(box4 * 100) / 100,
    box5NetVat: Math.round(box5 * 100) / 100,
    box6TotalSalesExVat: Math.round(box6 * 100) / 100,
    box7TotalPurchasesExVat: Math.round(box7 * 100) / 100,
    reverseChargeLinesFound: reverseChargeCount,
    lineRefs,
  }
}

// Cash Accounting Scheme: VAT is recognized proportionally to what's actually been
// paid in the period, not by invoice/bill date. If an invoice is only half paid, only
// half its VAT counts in this period's return - the rest counts whenever the remaining
// balance is actually settled. This uses the receipt/payment allocation tables, since
// that's the only place that records which specific invoice/bill a payment applies to.
//
// Known gap: doesn't populate lineRefs, so automatic post-filing correction detection
// (see vat_return_line_snapshots) doesn't cover Cash Accounting clients yet - the
// actual unit that drives each box here is a payment ALLOCATION, not a whole invoice/
// bill line, which needs its own snapshot granularity. Manual correction logging via
// the Error Corrections tab still works fine for these clients in the meantime.
export async function calculateVatReturnCashBasis(clientId: string, periodStart: string, periodEnd: string, db?: SupabaseClient): Promise<VatReturnResult> {
  const supabase = db || createClient()

  const [salesAllocRes, purchaseAllocRes] = await Promise.all([
    supabase
      .from('sales_receipt_allocations')
      .select('amount_allocated, sales_receipts!inner(receipt_date, client_id, voided), sales_invoices!inner(total, subtotal, vat_total)')
      .eq('sales_receipts.client_id', clientId)
      .eq('sales_receipts.voided', false)
      .gte('sales_receipts.receipt_date', periodStart)
      .lte('sales_receipts.receipt_date', periodEnd),
    supabase
      .from('purchase_payment_allocations')
      .select('amount_allocated, purchase_payments!inner(payment_date, client_id, voided), purchase_bills!inner(total, subtotal, vat_total)')
      .eq('purchase_payments.client_id', clientId)
      .eq('purchase_payments.voided', false)
      .gte('purchase_payments.payment_date', periodStart)
      .lte('purchase_payments.payment_date', periodEnd),
  ])

  let box1 = 0, box6 = 0
  for (const a of salesAllocRes.data || []) {
    const invoice = (a as any).sales_invoices
    const allocated = parseFloat((a as any).amount_allocated) || 0
    const invoiceTotal = parseFloat(invoice?.total) || 0
    if (invoiceTotal <= 0) continue
    const proportion = allocated / invoiceTotal
    box1 += (parseFloat(invoice.vat_total) || 0) * proportion
    box6 += (parseFloat(invoice.subtotal) || 0) * proportion
  }

  let box4 = 0, box7 = 0
  for (const a of purchaseAllocRes.data || []) {
    const bill = (a as any).purchase_bills
    const allocated = parseFloat((a as any).amount_allocated) || 0
    const billTotal = parseFloat(bill?.total) || 0
    if (billTotal <= 0) continue
    const proportion = allocated / billTotal
    box4 += (parseFloat(bill.vat_total) || 0) * proportion
    box7 += (parseFloat(bill.subtotal) || 0) * proportion
  }

  const box3 = box1
  const box5 = box3 - box4

  return {
    box1VatOnSales: Math.round(box1 * 100) / 100,
    box3TotalVatDue: Math.round(box3 * 100) / 100,
    box4VatReclaimed: Math.round(box4 * 100) / 100,
    box5NetVat: Math.round(box5 * 100) / 100,
    box6TotalSalesExVat: Math.round(box6 * 100) / 100,
    box7TotalPurchasesExVat: Math.round(box7 * 100) / 100,
    reverseChargeLinesFound: 0,
  }
}

export type LctOverride = 'auto' | 'force_standard' | 'force_limited_cost'

export interface FlatRateSettings {
  sector: string | null
  registrationDate: string | null
  lctOverride?: LctOverride
}

// The 1% first-year discount applies for the 12 months following VAT registration
// under the scheme, based on the PERIOD being filed - not the date the calculation
// happens to be run. (Previously this compared against "today", which would silently
// under/over-apply the discount for a return calculated after the fact.)
function firstYearDiscountActive(registrationDate: string | null, periodEnd: string): boolean {
  if (!registrationDate) return false
  const oneYearOn = new Date(registrationDate)
  oneYearOn.setFullYear(oneYearOn.getFullYear() + 1)
  return new Date(periodEnd) < oneYearOn
}

// Flat Rate Scheme: the business still charges standard VAT on invoices, but pays
// HMRC a fixed % of GROSS (VAT-inclusive) turnover instead of the difference between
// output and input VAT. Input VAT is not normally reclaimed at all, except on capital
// asset purchases over £2,000 including VAT, which can still be reclaimed in full.
//
// The Limited Cost Trader status (16.5% flat regardless of sector) is a PER-PERIOD
// test based on actual goods spend that period, not a one-off setting - a business
// can flip in and out of LCT status from one return to the next. This is now
// determined automatically from real purchase data (see lib/limitedCostTrader.ts),
// with an optional manual override for genuine accountant judgement calls.
export async function calculateVatReturnFlatRate(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  flatRateSettings: FlatRateSettings,
  db?: SupabaseClient
): Promise<
  VatReturnResult & {
    grossTurnover: number
    appliedPercentage: number
    isLimitedCostTrader: boolean
    lctDetail: LimitedCostTraderResult
  }
> {
  const supabase = db || createClient()

  const [salesRes, capitalPurchasesRes] = await Promise.all([
    supabase
      .from('sales_invoice_lines')
      .select('id, vat_amount, line_total, sales_invoices!inner(invoice_date, client_id, status)')
      .eq('sales_invoices.client_id', clientId)
      .neq('sales_invoices.status', 'draft')
      .neq('sales_invoices.status', 'cancelled')
      .gte('sales_invoices.invoice_date', periodStart)
      .lte('sales_invoices.invoice_date', periodEnd),
    supabase
      .from('purchase_bill_lines')
      .select('id, vat_amount, line_total, expense_account_id, chart_of_accounts(account_type), purchase_bills!inner(bill_date, client_id, status)')
      .eq('purchase_bills.client_id', clientId)
      .neq('purchase_bills.status', 'draft')
      .neq('purchase_bills.status', 'cancelled')
      .gte('purchase_bills.bill_date', periodStart)
      .lte('purchase_bills.bill_date', periodEnd),
  ])

  let netSales = 0, vatOnSales = 0
  const lineRefs: VatReturnLineRef[] = []
  for (const l of salesRes.data || []) {
    const net = parseFloat((l as any).line_total) || 0
    const vat = parseFloat((l as any).vat_amount) || 0
    netSales += net
    vatOnSales += vat
    // Box 1 under Flat Rate is derived from aggregate turnover x rate, not a
    // per-line VAT sum - but each sales line still contributes to that
    // turnover, so it's still the right thing to snapshot for later
    // change-detection (the trigger applies the rate% to the delta itself).
    lineRefs.push({ sourceTable: 'sales_invoice_lines', sourceLineId: (l as any).id, boxType: 'box1', netAmount: net, vatAmount: vat })
  }
  const grossTurnover = netSales + vatOnSales

  let box4 = 0
  for (const l of capitalPurchasesRes.data || []) {
    const accountType = (l as any).chart_of_accounts?.account_type
    if (accountType !== 'fixed_asset') continue
    const net = parseFloat((l as any).line_total) || 0
    const vat = parseFloat((l as any).vat_amount) || 0
    if (net + vat >= 2000) {
      box4 += vat
      lineRefs.push({ sourceTable: 'purchase_bill_lines', sourceLineId: (l as any).id, boxType: 'box4', netAmount: net, vatAmount: vat })
    }
  }

  const lctDetail = await calculateLimitedCostStatus(clientId, periodStart, periodEnd, grossTurnover, supabase)
  const override = flatRateSettings.lctOverride || 'auto'
  const isLimitedCostTrader =
    override === 'force_limited_cost' ? true : override === 'force_standard' ? false : lctDetail.isLimitedCostTrader

  const sectorRate = FLAT_RATE_SECTORS.find((s) => s.sector === flatRateSettings.sector)?.rate
  const baseRate = isLimitedCostTrader ? LIMITED_COST_TRADER_RATE : sectorRate ?? LIMITED_COST_TRADER_RATE
  const discountActive = firstYearDiscountActive(flatRateSettings.registrationDate, periodEnd)
  const appliedPercentage = discountActive ? Math.round((baseRate - 1) * 100) / 100 : baseRate

  const box1 = grossTurnover * (appliedPercentage / 100)
  const box3 = box1
  const box5 = box3 - box4

  return {
    box1VatOnSales: Math.round(box1 * 100) / 100,
    box3TotalVatDue: Math.round(box3 * 100) / 100,
    box4VatReclaimed: Math.round(box4 * 100) / 100,
    box5NetVat: Math.round(box5 * 100) / 100,
    box6TotalSalesExVat: Math.round(grossTurnover * 100) / 100,
    box7TotalPurchasesExVat: Math.round(netSales * 100) / 100,
    reverseChargeLinesFound: 0,
    grossTurnover: Math.round(grossTurnover * 100) / 100,
    appliedPercentage,
    isLimitedCostTrader,
    lctDetail,
    lineRefs,
  }
}

export async function getVatReturnDetail(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  scheme: 'standard' | 'cash_accounting' | 'flat_rate' | 'annual_accounting' = 'standard',
  db?: SupabaseClient
): Promise<VatReturnDetail> {
  const supabase = db || createClient()

  if (scheme === 'cash_accounting') {
    const [salesAllocRes, purchaseAllocRes] = await Promise.all([
      supabase
        .from('sales_receipt_allocations')
        .select('amount_allocated, sales_receipts!inner(receipt_date, reference, client_id, voided, contacts(name)), sales_invoices!inner(invoice_number, total, subtotal, vat_total)')
        .eq('sales_receipts.client_id', clientId)
        .eq('sales_receipts.voided', false)
        .gte('sales_receipts.receipt_date', periodStart)
        .lte('sales_receipts.receipt_date', periodEnd),
      supabase
        .from('purchase_payment_allocations')
        .select('amount_allocated, purchase_payments!inner(payment_date, reference, client_id, voided, contacts(name)), purchase_bills!inner(bill_number, total, subtotal, vat_total)')
        .eq('purchase_payments.client_id', clientId)
        .eq('purchase_payments.voided', false)
        .gte('purchase_payments.payment_date', periodStart)
        .lte('purchase_payments.payment_date', periodEnd),
    ])

    const salesTransactions: VatTransactionDetail[] = (salesAllocRes.data || []).map((a: any) => {
      const invoiceTotal = parseFloat(a.sales_invoices.total) || 0
      const proportion = invoiceTotal > 0 ? (parseFloat(a.amount_allocated) || 0) / invoiceTotal : 0
      return {
        date: a.sales_receipts.receipt_date,
        reference: a.sales_invoices.invoice_number,
        contactName: a.sales_receipts.contacts?.name || '',
        netAmount: Math.round((parseFloat(a.sales_invoices.subtotal) || 0) * proportion * 100) / 100,
        vatAmount: Math.round((parseFloat(a.sales_invoices.vat_total) || 0) * proportion * 100) / 100,
        note: `£${parseFloat(a.amount_allocated).toFixed(2)} of £${invoiceTotal.toFixed(2)} paid this period`,
      }
    })

    const purchaseTransactions: VatTransactionDetail[] = (purchaseAllocRes.data || []).map((a: any) => {
      const billTotal = parseFloat(a.purchase_bills.total) || 0
      const proportion = billTotal > 0 ? (parseFloat(a.amount_allocated) || 0) / billTotal : 0
      return {
        date: a.purchase_payments.payment_date,
        reference: a.purchase_bills.bill_number || '(no ref)',
        contactName: a.purchase_payments.contacts?.name || '',
        netAmount: Math.round((parseFloat(a.purchase_bills.subtotal) || 0) * proportion * 100) / 100,
        vatAmount: Math.round((parseFloat(a.purchase_bills.vat_total) || 0) * proportion * 100) / 100,
        note: `£${parseFloat(a.amount_allocated).toFixed(2)} of £${billTotal.toFixed(2)} paid this period`,
      }
    })

    return { salesTransactions, purchaseTransactions }
  }

  const [salesRes, purchaseRes] = await Promise.all([
    supabase
      .from('sales_invoice_lines')
      .select('vat_amount, line_total, description, sales_invoices!inner(invoice_date, invoice_number, client_id, status, contacts(name))')
      .eq('sales_invoices.client_id', clientId)
      .neq('sales_invoices.status', 'draft')
      .neq('sales_invoices.status', 'cancelled')
      .gte('sales_invoices.invoice_date', periodStart)
      .lte('sales_invoices.invoice_date', periodEnd),
    supabase
      .from('purchase_bill_lines')
      .select('vat_amount, line_total, description, expense_account_id, chart_of_accounts(account_type), purchase_bills!inner(bill_date, bill_number, client_id, status, contacts(name))')
      .eq('purchase_bills.client_id', clientId)
      .neq('purchase_bills.status', 'draft')
      .neq('purchase_bills.status', 'cancelled')
      .gte('purchase_bills.bill_date', periodStart)
      .lte('purchase_bills.bill_date', periodEnd),
  ])

  const salesTransactions: VatTransactionDetail[] = (salesRes.data || []).map((l: any) => ({
    date: l.sales_invoices.invoice_date,
    reference: l.sales_invoices.invoice_number,
    contactName: l.sales_invoices.contacts?.name || '',
    netAmount: parseFloat(l.line_total) || 0,
    vatAmount: parseFloat(l.vat_amount) || 0,
    note: l.description,
  }))

  let purchaseTransactions: VatTransactionDetail[] = (purchaseRes.data || []).map((l: any) => ({
    date: l.purchase_bills.bill_date,
    reference: l.purchase_bills.bill_number || '(no ref)',
    contactName: l.purchase_bills.contacts?.name || '',
    netAmount: parseFloat(l.line_total) || 0,
    vatAmount: parseFloat(l.vat_amount) || 0,
    note: l.description,
  }))

  if (scheme === 'flat_rate') {
    purchaseTransactions = (purchaseRes.data || [])
      .filter((l: any) => {
        if (l.chart_of_accounts?.account_type !== 'fixed_asset') return false
        const gross = (parseFloat(l.line_total) || 0) + (parseFloat(l.vat_amount) || 0)
        return gross >= 2000
      })
      .map((l: any) => ({
        date: l.purchase_bills.bill_date,
        reference: l.purchase_bills.bill_number || '(no ref)',
        contactName: l.purchase_bills.contacts?.name || '',
        netAmount: parseFloat(l.line_total) || 0,
        vatAmount: parseFloat(l.vat_amount) || 0,
        note: `${l.description} (capital purchase over £2,000)`,
      }))
    return { salesTransactions, purchaseTransactions, box1IsCalculated: true }
  }

  return { salesTransactions, purchaseTransactions }
}
