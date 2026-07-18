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
