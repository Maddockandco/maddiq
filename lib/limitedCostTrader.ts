import { createClient } from '@/lib/supabase/client'
import { annualCostThreshold } from '@/lib/flatRateSectors'

// HMRC's Limited Cost Trader test (Flat Rate Scheme) is not a simple physical
// goods-vs-services split. Several physical purchases are explicitly excluded
// from counting as "relevant goods": capital expenditure, food/drink for
// consumption by the business or its staff, vehicles/parts/fuel (unless the
// client's own trade IS vehicles - taxis, couriers, haulage etc.), and anything
// digital/electronic (software, subscriptions, downloads). Everything else that
// isn't a good at all (rent, utilities, professional fees, insurance...) is a
// service and never counts either way.
//
// This categorisation lives on the ACCOUNT, not the transaction line, because
// in practice it's near-universally consistent per account ("Motor Fuel" is
// always excluded, "Materials/Stock" is always a qualifying good). A genuinely
// mixed account should be split into two accounts - that's ordinary chart of
// accounts hygiene, not something Maddiq should paper over with a per-line
// override on every single purchase entry.
export type FlatRateGoodsCategory =
  | 'qualifying_good'
  | 'excluded_capital'
  | 'excluded_food_drink'
  | 'excluded_vehicle_fuel'
  | 'excluded_digital'
  | 'service'

export const GOODS_CATEGORY_LABELS: Record<FlatRateGoodsCategory, string> = {
  qualifying_good: 'Qualifying good — counts toward the 2% / £1,000 test',
  excluded_capital: 'Capital expenditure (excluded)',
  excluded_food_drink: 'Food or drink for consumption (excluded)',
  excluded_vehicle_fuel: 'Vehicles, parts or fuel (excluded, unless the client trades in vehicles)',
  excluded_digital: 'Digital services / software (excluded — not a physical good)',
  service: 'Service — not a good at all',
}

export const GOODS_CATEGORY_OPTIONS: FlatRateGoodsCategory[] = [
  'service',
  'qualifying_good',
  'excluded_capital',
  'excluded_food_drink',
  'excluded_vehicle_fuel',
  'excluded_digital',
]

export interface LimitedCostTraderResult {
  isLimitedCostTrader: boolean
  qualifyingGoodsSpend: number
  threshold: number
  turnoverIncVat: number
  periodDays: number
  qualifyingLines: {
    date: string
    reference: string
    accountName: string
    amountIncVat: number
  }[]
}

// You must use the 16.5% Limited Cost Trader rate if relevant goods (inc. VAT)
// cost less than 2% of turnover (inc. VAT), OR more than 2% but still under
// £1,000/year pro-rated. Both conditions collapse to one comparison: you're
// limited cost if goods spend is below whichever threshold is HIGHER.
// Source: https://www.gov.uk/vat-flat-rate-scheme/how-much-you-pay
export function goodsSpendThreshold(turnoverIncVat: number, periodDays: number): number {
  const twoPercent = Math.round(turnoverIncVat * 0.02 * 100) / 100
  return Math.max(twoPercent, annualCostThreshold(periodDays))
}

export async function calculateLimitedCostStatus(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  turnoverIncVat: number
): Promise<LimitedCostTraderResult> {
  const supabase = createClient()

  const { data } = await supabase
    .from('purchase_bill_lines')
    .select(
      'vat_amount, line_total, description, chart_of_accounts(name, flat_rate_goods_category), purchase_bills!inner(bill_date, bill_number, client_id, status)'
    )
    .eq('purchase_bills.client_id', clientId)
    .neq('purchase_bills.status', 'draft')
    .neq('purchase_bills.status', 'cancelled')
    .gte('purchase_bills.bill_date', periodStart)
    .lte('purchase_bills.bill_date', periodEnd)

  let qualifyingGoodsSpend = 0
  const qualifyingLines: LimitedCostTraderResult['qualifyingLines'] = []

  for (const l of data || []) {
    const row = l as any
    const category: FlatRateGoodsCategory | undefined = row.chart_of_accounts?.flat_rate_goods_category
    if (category !== 'qualifying_good') continue
    const amountIncVat = (parseFloat(row.line_total) || 0) + (parseFloat(row.vat_amount) || 0)
    qualifyingGoodsSpend += amountIncVat
    qualifyingLines.push({
      date: row.purchase_bills.bill_date,
      reference: row.purchase_bills.bill_number || '(no ref)',
      accountName: row.chart_of_accounts?.name || '',
      amountIncVat: Math.round(amountIncVat * 100) / 100,
    })
  }

  const periodDays = Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1
  const threshold = goodsSpendThreshold(turnoverIncVat, periodDays)

  return {
    isLimitedCostTrader: qualifyingGoodsSpend < threshold,
    qualifyingGoodsSpend: Math.round(qualifyingGoodsSpend * 100) / 100,
    threshold,
    turnoverIncVat,
    periodDays,
    qualifyingLines,
  }
}
