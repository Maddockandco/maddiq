// UK Corporation Tax calculation, structured around the real CT600 (2024) box numbers
// so a future direct-filing feature can map straight onto this without re-architecting.
//
// Rates verified current as of this build: unchanged since 1 April 2023.
// - Small profits rate: 19%, applies at or below the (adjusted) lower limit of £50,000
// - Main rate: 25%, applies above the (adjusted) upper limit of £250,000
// - Marginal relief applies between the two limits, using the standard fraction 3/200
// - Both limits divide by (1 + number of associated companies)
// - Both limits also pro-rate for accounting periods shorter than 12 months
//
// This assumes Augmented Profits = Taxable Total Profits (i.e. no exempt distributions
// from non-group companies) - the common case for a typical SME. If a client genuinely
// receives such distributions, this figure would need manual adjustment.

const SMALL_PROFITS_RATE = 0.19
const MAIN_RATE = 0.25
const MARGINAL_RELIEF_FRACTION = 3 / 200
const STANDARD_LOWER_LIMIT = 50000
const STANDARD_UPPER_LIMIT = 250000

export type ManualAdjustment = {
  description: string
  amount: number // positive = added back (increases taxable profit), negative = deducted
}

export type CorporationTaxInput = {
  accountingProfit: number // profit before tax, from the P&L for the period
  depreciationAddback: number // total depreciation charged in the period (non-deductible)
  capitalAllowancesTotal: number // total capital allowances claimed for the period
  otherIncome: number // e.g. bank interest, box 170 - assumed already taxable, added after trading profit
  manualAdjustments: ManualAdjustment[] // disallowable expenses, qualifying donations, etc.
  qualifyingDonations: number // box 305 - gift aid etc., deducted from profits before donations
  associatedCompaniesCount: number // does NOT include the company itself
  periodStartDate: string
  periodEndDate: string
}

export type CorporationTaxResult = {
  box145Turnover: number
  box155TradingProfits: number
  box165NetTradingProfits: number
  box170Interest: number
  box235ProfitsBeforeDeductions: number
  box300ProfitsBeforeDonations: number
  box305QualifyingDonations: number
  box315ProfitsChargeable: number // Taxable Total Profits
  box326AssociatedCompanies: number
  box329MarginalReliefFlag: boolean
  adjustedLowerLimit: number
  adjustedUpperLimit: number
  rateApplied: 'small_profits' | 'marginal' | 'main'
  taxAtMainRate: number
  box430CorporationTax: number
  box435MarginalRelief: number
  box440CorporationTaxChargeable: number
  box475NetCtLiability: number
  effectiveRate: number
}

function periodLengthInDays(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function calculateCorporationTax(input: CorporationTaxInput): CorporationTaxResult {
  // Step 1: build up to Trading Profits (Box 155) - accounting profit, add back
  // depreciation (never tax-deductible), deduct capital allowances (the tax-approved
  // equivalent), then apply any other manual disallowable/allowable adjustments
  const manualAdjustmentsTotal = input.manualAdjustments.reduce((sum, a) => sum + a.amount, 0)

  const box155TradingProfits =
    input.accountingProfit + input.depreciationAddback - input.capitalAllowancesTotal + manualAdjustmentsTotal

  const box165NetTradingProfits = box155TradingProfits // no losses brought forward in this simplified model

  const box170Interest = input.otherIncome

  const box235ProfitsBeforeDeductions = box165NetTradingProfits + box170Interest

  const box300ProfitsBeforeDonations = box235ProfitsBeforeDeductions // no other deductions/reliefs modelled here

  const box315ProfitsChargeable = box300ProfitsBeforeDonations - input.qualifyingDonations

  // Step 2: pro-rate the limits for period length and associated companies
  const days = periodLengthInDays(input.periodStartDate, input.periodEndDate)
  const periodFraction = Math.min(1, days / 365)
  const divisor = 1 + input.associatedCompaniesCount

  const adjustedLowerLimit = (STANDARD_LOWER_LIMIT / divisor) * periodFraction
  const adjustedUpperLimit = (STANDARD_UPPER_LIMIT / divisor) * periodFraction

  // Step 3: work out which rate band applies, and the resulting tax
  const taxAtMainRate = box315ProfitsChargeable * MAIN_RATE
  let rateApplied: 'small_profits' | 'marginal' | 'main'
  let box430CorporationTax: number
  let box435MarginalRelief = 0
  let box329MarginalReliefFlag = false

  if (box315ProfitsChargeable <= adjustedLowerLimit) {
    rateApplied = 'small_profits'
    box430CorporationTax = box315ProfitsChargeable * SMALL_PROFITS_RATE
  } else if (box315ProfitsChargeable > adjustedUpperLimit) {
    rateApplied = 'main'
    box430CorporationTax = taxAtMainRate
  } else {
    rateApplied = 'marginal'
    box329MarginalReliefFlag = true
    // Augmented Profits assumed equal to Taxable Total Profits (no exempt distributions) -
    // see the note at the top of this file
    const augmentedProfits = box315ProfitsChargeable
    box435MarginalRelief =
      MARGINAL_RELIEF_FRACTION *
      (adjustedUpperLimit - augmentedProfits) *
      (box315ProfitsChargeable / augmentedProfits)
    box430CorporationTax = taxAtMainRate
  }

  const box440CorporationTaxChargeable = box430CorporationTax - box435MarginalRelief
  const box475NetCtLiability = box440CorporationTaxChargeable // no other reliefs/deductions modelled here
  const effectiveRate = box315ProfitsChargeable > 0 ? box440CorporationTaxChargeable / box315ProfitsChargeable : 0

  return {
    box145Turnover: 0, // set by caller from the P&L, not derivable from this input shape alone
    box155TradingProfits,
    box165NetTradingProfits,
    box170Interest,
    box235ProfitsBeforeDeductions,
    box300ProfitsBeforeDonations,
    box305QualifyingDonations: input.qualifyingDonations,
    box315ProfitsChargeable,
    box326AssociatedCompanies: input.associatedCompaniesCount,
    box329MarginalReliefFlag,
    adjustedLowerLimit,
    adjustedUpperLimit,
    rateApplied,
    taxAtMainRate,
    box430CorporationTax,
    box435MarginalRelief,
    box440CorporationTaxChargeable,
    box475NetCtLiability,
    effectiveRate,
  }
}
