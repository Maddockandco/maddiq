// Accounting depreciation - completely separate from tax capital allowances.
// This computes the P&L depreciation charge and posts real journal entries,
// unlike capital allowances which is a tax-only computation never posted to the ledger.

export type DepreciableAsset = {
  id: string
  description: string
  category: string // the Fixed Asset Register category (main_pool, car_main_rate, structures_buildings, goodwill, etc.)
  cost: number
  date_acquired: string
  date_disposed: string | null
  disposal_proceeds: number | null
  depreciation_method: 'straight_line' | 'reducing_balance' | 'none'
  useful_life_years: number | null
  depreciation_rate_percent: number | null
  accumulated_depreciation: number
}

export const REPORTING_CATEGORIES = ['Plant & Machinery', 'Motor Vehicles', 'Land & Buildings', 'Goodwill'] as const
export type ReportingCategory = typeof REPORTING_CATEGORIES[number]

// Maps the Fixed Asset Register's capital-allowances category to the accounting/reporting
// category used for the Balance Sheet and P&L - these are genuinely different classifications
// (tax pooling rules vs how a set of statutory accounts presents fixed assets)
export function getReportingCategory(assetCategory: string): ReportingCategory {
  if (assetCategory === 'structures_buildings') return 'Land & Buildings'
  if (['car_zero_emission', 'car_main_rate', 'car_special_rate'].includes(assetCategory)) return 'Motor Vehicles'
  if (assetCategory === 'goodwill') return 'Goodwill'
  return 'Plant & Machinery' // main_pool, special_rate_pool, and any fallback
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

export function calculateDepreciation(params: {
  assets: DepreciableAsset[]
  periodStart: string
  periodEnd: string
}) {
  const periodStart = new Date(params.periodStart)
  const periodEnd = new Date(params.periodEnd)
  const periodDays = daysBetween(periodStart, periodEnd)

  const lines: {
    assetId: string
    description: string
    category: ReportingCategory
    cost: number
    openingNbv: number
    charge: number
    closingNbv: number
  }[] = []

  for (const asset of params.assets) {
    if (asset.depreciation_method === 'none') continue

    const acquired = new Date(asset.date_acquired)
    const disposed = asset.date_disposed ? new Date(asset.date_disposed) : null

    // Skip assets not yet owned during this period, or disposed before it started
    if (acquired > periodEnd) continue
    if (disposed && disposed < periodStart) continue

    const relevantStart = acquired > periodStart ? acquired : periodStart
    const relevantEnd = disposed && disposed < periodEnd ? disposed : periodEnd
    const ownedDays = daysBetween(relevantStart, relevantEnd)
    const proRataFactor = ownedDays / periodDays

    const openingNbv = asset.cost - asset.accumulated_depreciation
    if (openingNbv <= 0) continue

    let annualCharge = 0
    if (asset.depreciation_method === 'straight_line') {
      const years = asset.useful_life_years || 5
      annualCharge = asset.cost / years
    } else if (asset.depreciation_method === 'reducing_balance') {
      const rate = (asset.depreciation_rate_percent || 20) / 100
      annualCharge = openingNbv * rate
    }

    // Pro-rate the annual charge for the portion of the period actually owned,
    // and for periods that aren't exactly 12 months
    const periodLengthFactor = periodDays / 365
    let charge = annualCharge * periodLengthFactor * proRataFactor
    charge = Math.min(charge, openingNbv) // never depreciate below zero NBV

    if (charge <= 0) continue

    lines.push({
      assetId: asset.id,
      description: asset.description,
      category: getReportingCategory(asset.category),
      cost: asset.cost,
      openingNbv: Math.round(openingNbv * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      closingNbv: Math.round((openingNbv - charge) * 100) / 100,
    })
  }

  const totalDepreciation = Math.round(lines.reduce((sum, l) => sum + l.charge, 0) * 100) / 100

  // Build the full per-category movement schedule - Cost side is always derivable live
  // from the register itself (no snapshot needed); Depreciation side uses the charge
  // just computed above, plus whatever's already accumulated on each asset
  const categoryBreakdown = REPORTING_CATEGORIES.map((category) => {
    const categoryAssets = params.assets.filter((a) => getReportingCategory(a.category) === category)

    const costBf = categoryAssets
      .filter((a) => new Date(a.date_acquired) < periodStart)
      .reduce((sum, a) => sum + a.cost, 0)

    const costAdditions = categoryAssets
      .filter((a) => {
        const acquired = new Date(a.date_acquired)
        return acquired >= periodStart && acquired <= periodEnd
      })
      .reduce((sum, a) => sum + a.cost, 0)

    const disposedInPeriod = categoryAssets.filter((a) => {
      if (!a.date_disposed) return false
      const disposed = new Date(a.date_disposed)
      return disposed >= periodStart && disposed <= periodEnd
    })
    const costDisposals = disposedInPeriod.reduce((sum, a) => sum + a.cost, 0)
    const accumDepDisposals = disposedInPeriod.reduce((sum, a) => sum + a.accumulated_depreciation, 0)

    const costCf = costBf + costAdditions - costDisposals

    const accumDepBf = categoryAssets
      .filter((a) => new Date(a.date_acquired) < periodStart)
      .reduce((sum, a) => sum + a.accumulated_depreciation, 0)

    const charge = lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.charge, 0)
    const accumDepCf = accumDepBf + charge - accumDepDisposals

    return {
      category,
      costBf: Math.round(costBf * 100) / 100,
      costAdditions: Math.round(costAdditions * 100) / 100,
      costDisposals: Math.round(costDisposals * 100) / 100,
      costCf: Math.round(costCf * 100) / 100,
      accumDepBf: Math.round(accumDepBf * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      accumDepDisposals: Math.round(accumDepDisposals * 100) / 100,
      accumDepCf: Math.round(accumDepCf * 100) / 100,
      nbvCf: Math.round((costCf - accumDepCf) * 100) / 100,
      nbvBf: Math.round((costBf - accumDepBf) * 100) / 100,
    }
  }).filter((c) => c.costBf !== 0 || c.costAdditions !== 0 || c.costCf !== 0)

  return { lines, totalDepreciation, categoryBreakdown }
}

// Computes the gain/loss on disposal - the difference between proceeds and the asset's
// Net Book Value at the point of disposal. This is a real P&L item, separate from any
// capital allowances balancing charge (which is tax-only).
export function calculateDisposalGainLoss(asset: DepreciableAsset) {
  const nbv = asset.cost - asset.accumulated_depreciation
  const proceeds = asset.disposal_proceeds || 0
  const gainLoss = Math.round((proceeds - nbv) * 100) / 100
  return { nbv: Math.round(nbv * 100) / 100, proceeds, gainLoss }
}
