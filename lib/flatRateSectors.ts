// Verified directly from https://www.gov.uk/vat-flat-rate-scheme/how-much-you-pay
// (GOV.UK, last updated 23 April 2026). Only the current-period rate is included for
// sectors that have had rate changes over time (e.g. catering, hotels, pubs) - always
// double-check against the live GOV.UK page before relying on this for a real filing,
// since HMRC can and does update these.

export const LIMITED_COST_TRADER_RATE = 16.5

export const FLAT_RATE_SECTORS: { sector: string; rate: number }[] = [
  { sector: 'Accountancy or book-keeping', rate: 14.5 },
  { sector: 'Advertising', rate: 11 },
  { sector: 'Agricultural services', rate: 11 },
  { sector: 'Any other activity not listed elsewhere', rate: 12 },
  { sector: 'Architect, civil and structural engineer or surveyor', rate: 14.5 },
  { sector: 'Boarding or care of animals', rate: 12 },
  { sector: 'Business services not listed elsewhere', rate: 12 },
  { sector: 'Catering services including restaurants and takeaways', rate: 12.5 },
  { sector: 'Computer and IT consultancy or data processing', rate: 14.5 },
  { sector: 'Computer repair services', rate: 10.5 },
  { sector: 'Entertainment or journalism', rate: 12.5 },
  { sector: 'Estate agency or property management services', rate: 12 },
  { sector: 'Farming or agriculture not listed elsewhere', rate: 6.5 },
  { sector: 'Film, radio, television or video production', rate: 13 },
  { sector: 'Financial services', rate: 13.5 },
  { sector: 'Forestry or fishing', rate: 10.5 },
  { sector: 'General building or construction services', rate: 9.5 },
  { sector: 'Hairdressing or other beauty treatment services', rate: 13 },
  { sector: 'Hiring or renting goods', rate: 9.5 },
  { sector: 'Hotel or accommodation', rate: 10.5 },
  { sector: 'Investigation or security', rate: 12 },
  { sector: 'Labour-only building or construction services', rate: 14.5 },
  { sector: 'Laundry or dry-cleaning services', rate: 12 },
  { sector: 'Lawyer or legal services', rate: 14.5 },
  { sector: 'Library, archive, museum or other cultural activity', rate: 9.5 },
  { sector: 'Management consultancy', rate: 14 },
  { sector: 'Manufacturing fabricated metal products', rate: 10.5 },
  { sector: 'Manufacturing food', rate: 9 },
  { sector: 'Manufacturing not listed elsewhere', rate: 9.5 },
  { sector: 'Manufacturing yarn, textiles or clothing', rate: 9 },
  { sector: 'Membership organisation', rate: 8 },
  { sector: 'Mining or quarrying', rate: 10 },
  { sector: 'Packaging', rate: 9 },
  { sector: 'Photography', rate: 11 },
  { sector: 'Post offices', rate: 5 },
  { sector: 'Printing', rate: 8.5 },
  { sector: 'Publishing', rate: 11 },
  { sector: 'Pubs', rate: 6.5 },
  { sector: 'Real estate activity not listed elsewhere', rate: 14 },
  { sector: 'Repairing personal or household goods', rate: 10 },
  { sector: 'Repairing vehicles', rate: 8.5 },
  { sector: 'Retailing food, confectionery, tobacco, newspapers or children\u2019s clothing', rate: 4 },
  { sector: 'Retailing pharmaceuticals, medical goods, cosmetics or toiletries', rate: 8 },
  { sector: 'Retailing not listed elsewhere', rate: 7.5 },
  { sector: 'Retailing vehicles or fuel', rate: 6.5 },
  { sector: 'Secretarial services', rate: 13 },
  { sector: 'Social work', rate: 11 },
  { sector: 'Sport or recreation', rate: 8.5 },
  { sector: 'Transport or storage, including couriers, freight, removals and taxis', rate: 10 },
  { sector: 'Travel agency', rate: 10.5 },
  { sector: 'Veterinary medicine', rate: 11 },
  { sector: 'Wholesaling agricultural products', rate: 8 },
  { sector: 'Wholesaling food', rate: 7.5 },
  { sector: 'Wholesaling not listed elsewhere', rate: 8.5 },
]

// A business is a "limited cost business" (must use 16.5% regardless of sector) if
// spending on relevant goods is either under 2% of VAT-inclusive turnover, or under
// £1,000/year (pro-rated for the period length) - whichever test is more favourable
// to the business. This is a judgement call requiring the person's own figures, not
// something Maddiq can safely auto-detect from the ledger alone, since it depends on
// HMRC's specific definition of "relevant goods" (excludes services, vehicle costs,
// capital items, food/drink for staff, etc.) which isn't tracked as its own category.
export function annualCostThreshold(periodDays: number): number {
  return Math.round((1000 * periodDays) / 365)
}
