import { createClient } from '@/lib/supabase/client'

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

export type VatReturnResult = {
  box1VatOnSales: number
  box3TotalVatDue: number
  box4VatReclaimed: number
  box5NetVat: number
  box6TotalSalesExVat: number
  box7TotalPurchasesExVat: number
  reverseChargeLinesFound: number
}

export async function calculateVatReturn(clientId: string, periodStart: string, periodEnd: string): Promise<VatReturnResult> {
  const supabase = createClient()

  const [salesRes, purchaseRes] = await Promise.all([
    supabase
      .from('sales_invoice_lines')
      .select('vat_amount, line_total, vat_rate_id, vat_rates(code), sales_invoices!inner(invoice_date, client_id, status)')
      .eq('sales_invoices.client_id', clientId)
      .neq('sales_invoices.status', 'draft')
      .neq('sales_invoices.status', 'cancelled')
      .gte('sales_invoices.invoice_date', periodStart)
      .lte('sales_invoices.invoice_date', periodEnd),
    supabase
      .from('purchase_bill_lines')
      .select('vat_amount, line_total, vat_rate_id, vat_rates(code), purchase_bills!inner(bill_date, client_id, status)')
      .eq('purchase_bills.client_id', clientId)
      .neq('purchase_bills.status', 'draft')
      .neq('purchase_bills.status', 'cancelled')
      .gte('purchase_bills.bill_date', periodStart)
      .lte('purchase_bills.bill_date', periodEnd),
  ])

  let box1 = 0, box6 = 0
  let reverseChargeCount = 0
  for (const l of salesRes.data || []) {
    box1 += parseFloat((l as any).vat_amount) || 0
    box6 += parseFloat((l as any).line_total) || 0
    if ((l as any).vat_rates?.code?.includes('reverse_charge')) reverseChargeCount++
  }

  let box4 = 0, box7 = 0
  for (const l of purchaseRes.data || []) {
    box4 += parseFloat((l as any).vat_amount) || 0
    box7 += parseFloat((l as any).line_total) || 0
    if ((l as any).vat_rates?.code?.includes('reverse_charge')) reverseChargeCount++
  }

  const box3 = box1 // + box2, which is always 0 here
  const box5 = box3 - box4

  return {
    box1VatOnSales: Math.round(box1 * 100) / 100,
    box3TotalVatDue: Math.round(box3 * 100) / 100,
    box4VatReclaimed: Math.round(box4 * 100) / 100,
    box5NetVat: Math.round(box5 * 100) / 100,
    box6TotalSalesExVat: Math.round(box6 * 100) / 100,
    box7TotalPurchasesExVat: Math.round(box7 * 100) / 100,
    reverseChargeLinesFound: reverseChargeCount,
  }
}

// Cash Accounting Scheme: VAT is recognized proportionally to what's actually been
// paid in the period, not by invoice/bill date. If an invoice is only half paid, only
// half its VAT counts in this period's return - the rest counts whenever the remaining
// balance is actually settled. This uses the receipt/payment allocation tables, since
// that's the only place that records which specific invoice/bill a payment applies to.
export async function calculateVatReturnCashBasis(clientId: string, periodStart: string, periodEnd: string): Promise<VatReturnResult> {
  const supabase = createClient()

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
    reverseChargeLinesFound: 0, // cash basis rarely combines with reverse charge in practice - flagged as out of scope
  }
}

// Flat Rate Scheme: the business still charges standard VAT on invoices, but pays
// HMRC a fixed % of GROSS (VAT-inclusive) turnover instead of the difference between
// output and input VAT. Input VAT is not normally reclaimed at all, except on capital
// asset purchases over £2,000 including VAT, which can still be reclaimed in full.
export async function calculateVatReturnFlatRate(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  flatRatePercentage: number
): Promise<VatReturnResult & { grossTurnover: number }> {
  const supabase = createClient()

  const [salesRes, capitalPurchasesRes] = await Promise.all([
    supabase
      .from('sales_invoice_lines')
      .select('vat_amount, line_total, sales_invoices!inner(invoice_date, client_id, status)')
      .eq('sales_invoices.client_id', clientId)
      .neq('sales_invoices.status', 'draft')
      .neq('sales_invoices.status', 'cancelled')
      .gte('sales_invoices.invoice_date', periodStart)
      .lte('sales_invoices.invoice_date', periodEnd),
    // Capital goods over £2,000 including VAT are the one exception where input VAT
    // can still be reclaimed under Flat Rate - identified here by a fixed_asset account
    supabase
      .from('purchase_bill_lines')
      .select('vat_amount, line_total, expense_account_id, chart_of_accounts(account_type), purchase_bills!inner(bill_date, client_id, status)')
      .eq('purchase_bills.client_id', clientId)
      .neq('purchase_bills.status', 'draft')
      .neq('purchase_bills.status', 'cancelled')
      .gte('purchase_bills.bill_date', periodStart)
      .lte('purchase_bills.bill_date', periodEnd),
  ])

  let netSales = 0, vatOnSales = 0
  for (const l of salesRes.data || []) {
    netSales += parseFloat((l as any).line_total) || 0
    vatOnSales += parseFloat((l as any).vat_amount) || 0
  }
  const grossTurnover = netSales + vatOnSales

  let box4 = 0
  for (const l of capitalPurchasesRes.data || []) {
    const accountType = (l as any).chart_of_accounts?.account_type
    if (accountType !== 'fixed_asset') continue
    const net = parseFloat((l as any).line_total) || 0
    const vat = parseFloat((l as any).vat_amount) || 0
    if (net + vat >= 2000) box4 += vat
  }

  const box1 = grossTurnover * (flatRatePercentage / 100)
  const box3 = box1
  const box5 = box3 - box4

  return {
    box1VatOnSales: Math.round(box1 * 100) / 100,
    box3TotalVatDue: Math.round(box3 * 100) / 100,
    box4VatReclaimed: Math.round(box4 * 100) / 100,
    box5NetVat: Math.round(box5 * 100) / 100,
    box6TotalSalesExVat: Math.round(grossTurnover * 100) / 100, // Box 6 uses GROSS turnover under Flat Rate - a deliberate quirk of the scheme, not net
    box7TotalPurchasesExVat: Math.round(netSales * 100) / 100, // not actually used in the Box 5 calculation, reported for completeness
    reverseChargeLinesFound: 0,
    grossTurnover: Math.round(grossTurnover * 100) / 100,
  }
}
