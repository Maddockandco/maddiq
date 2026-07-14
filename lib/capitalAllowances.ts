// UK Capital Allowances calculation engine
// Rates current as at April 2026 (confirmed via HMRC guidance July 2026):
// - AIA: £1,000,000/year, 100% relief on plant & machinery (not cars)
// - Full Expensing: 100% FYA, companies only, NEW main pool assets only, no cap
// - Special Rate Allowance: 50% FYA, companies only, NEW special rate assets only, no cap
// - 40% FYA: new main-rate plant & machinery not covered by AIA/Full Expensing, companies AND unincorporated
// - Main pool WDA: 14% (reduced from 18% on 1 April 2026 - hybrid rate applies to straddling periods)
// - Special rate pool WDA: 6%
// - Cars: 0g/km = 100% FYA; ≤50g/km = main pool WDA; >50g/km = special rate pool WDA (never AIA/FYA)
// - SBA: 3% flat straight-line on qualifying buildings, time-apportioned, no balancing charge/allowance on disposal

const AIA_ANNUAL_LIMIT = 1000000
const MAIN_POOL_RATE_OLD = 0.18
const MAIN_POOL_RATE_NEW = 0.14
const SPECIAL_RATE_POOL_RATE = 0.06
const RATE_CHANGE_DATE = new Date('2026-04-01')
const SBA_RATE = 0.03

export type Asset = {
  id: string
  description: string
  category: string
  date_acquired: string
  cost: number
  is_new: boolean
  co2_emissions: number | null
  date_disposed: string | null
  disposal_proceeds: number | null
}

export type PriorBalances = {
  main_pool_cf: number
  special_rate_pool_cf: number
  car_main_rate_pool_cf: number
  car_special_rate_pool_cf: number
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

// Blends the old 18% and new 14% main pool rates proportionally if the period straddles 1 April 2026
function mainPoolRateForPeriod(periodStart: Date, periodEnd: Date): number {
  if (periodEnd < RATE_CHANGE_DATE) return MAIN_POOL_RATE_OLD
  if (periodStart >= RATE_CHANGE_DATE) return MAIN_POOL_RATE_NEW
  const totalDays = daysBetween(periodStart, periodEnd)
  const daysBefore = daysBetween(periodStart, new Date(RATE_CHANGE_DATE.getTime() - 86400000))
  const daysAfter = totalDays - daysBefore
  return (MAIN_POOL_RATE_OLD * daysBefore + MAIN_POOL_RATE_NEW * daysAfter) / totalDays
}

// Pro-rates a rate for periods shorter or longer than 12 months
function periodLengthFactor(periodStart: Date, periodEnd: Date): number {
  const days = daysBetween(periodStart, periodEnd)
  return days / 365
}

export function calculateCapitalAllowances(params: {
  assets: Asset[]
  priorBalances: PriorBalances
  periodStart: string
  periodEnd: string
  isCompany: boolean
  aiaAlreadyUsedThisYear?: number // if this isn't the client's first period in a 12-month AIA year, prior usage reduces what's left
}) {
  const { assets, priorBalances, isCompany } = params
  const periodStart = new Date(params.periodStart)
  const periodEnd = new Date(params.periodEnd)
  const lengthFactor = periodLengthFactor(periodStart, periodEnd)
  const aiaLimit = Math.round(AIA_ANNUAL_LIMIT * lengthFactor - (params.aiaAlreadyUsedThisYear || 0))

  const inPeriod = (a: Asset) => {
    const acquired = new Date(a.date_acquired)
    return acquired >= periodStart && acquired <= periodEnd
  }
  const disposedInPeriod = (a: Asset) => {
    if (!a.date_disposed) return false
    const disposed = new Date(a.date_disposed)
    return disposed >= periodStart && disposed <= periodEnd
  }

  const additions = assets.filter(inPeriod)
  const disposals = assets.filter(disposedInPeriod)

  let aiaRemaining = aiaLimit
  let aiaUsed = 0
  const balancingCharges: { asset: string; amount: number; reason: string }[] = []

  // --- Special Rate Pool additions: AIA allocated here FIRST, since it converts 6%/50% relief into 100% ---
  const specialRateAdditions = additions.filter((a) => a.category === 'special_rate_pool')
  let specialRatePoolAiaClaimed = 0
  let specialRatePoolSrAllowanceClaimed = 0
  let specialRatePoolAdditionsAfterReliefs = 0

  for (const a of specialRateAdditions) {
    if (aiaRemaining > 0) {
      const claim = Math.min(a.cost, aiaRemaining)
      specialRatePoolAiaClaimed += claim
      aiaRemaining -= claim
      aiaUsed += claim
      const leftover = a.cost - claim
      if (leftover > 0) specialRatePoolAdditionsAfterReliefs += leftover
    } else if (isCompany && a.is_new) {
      // 50% Special Rate Allowance available to companies on new assets not covered by AIA
      const srClaim = a.cost * 0.5
      specialRatePoolSrAllowanceClaimed += srClaim
      specialRatePoolAdditionsAfterReliefs += a.cost - srClaim
    } else {
      specialRatePoolAdditionsAfterReliefs += a.cost
    }
  }

  // --- Main Pool additions: Full Expensing for new company assets (unlimited), then AIA, then 40% FYA ---
  const mainPoolAdditions = additions.filter((a) => a.category === 'main_pool')
  let mainPoolFullExpensingClaimed = 0
  let mainPoolAiaClaimed = 0
  let mainPoolFya40Claimed = 0
  let mainPoolAdditionsAfterReliefs = 0

  for (const a of mainPoolAdditions) {
    if (isCompany && a.is_new) {
      mainPoolFullExpensingClaimed += a.cost
      continue
    }
    if (aiaRemaining > 0) {
      const claim = Math.min(a.cost, aiaRemaining)
      mainPoolAiaClaimed += claim
      aiaRemaining -= claim
      aiaUsed += claim
      const leftover = a.cost - claim
      if (leftover > 0) {
        const fya = leftover * 0.4
        mainPoolFya40Claimed += fya
        mainPoolAdditionsAfterReliefs += leftover - fya
      }
    } else {
      const fya = a.cost * 0.4
      mainPoolFya40Claimed += fya
      mainPoolAdditionsAfterReliefs += a.cost - fya
    }
  }

  // --- Cars ---
  const carZeroAdditions = additions.filter((a) => a.category === 'car_zero_emission')
  const carZeroFya = carZeroAdditions.reduce((sum, a) => sum + a.cost, 0)

  const carMainRateAdditions = additions.filter((a) => a.category === 'car_main_rate').reduce((sum, a) => sum + a.cost, 0)
  const carSpecialRateAdditions = additions.filter((a) => a.category === 'car_special_rate').reduce((sum, a) => sum + a.cost, 0)

  // --- Disposals: deduct proceeds from the relevant pool; excess beyond pool balance is a balancing charge ---
  function applyDisposals(category: string, poolBalance: number) {
    const catDisposals = disposals.filter((a) => a.category === category)
    let totalProceeds = 0
    for (const a of catDisposals) {
      const proceeds = a.disposal_proceeds || 0
      totalProceeds += proceeds
    }
    const newBalance = poolBalance - totalProceeds
    if (newBalance < 0) {
      balancingCharges.push({
        asset: catDisposals.map((a) => a.description).join(', '),
        amount: Math.abs(newBalance),
        reason: 'Disposal proceeds exceeded remaining pool balance',
      })
      return { balance: 0, proceeds: totalProceeds }
    }
    return { balance: newBalance, proceeds: totalProceeds }
  }

  const mainPoolBeforeWda = priorBalances.main_pool_cf + mainPoolAdditionsAfterReliefs
  const mainPoolDisposalResult = applyDisposals('main_pool', mainPoolBeforeWda)
  const mainPoolRate = mainPoolRateForPeriod(periodStart, periodEnd) * lengthFactor
  const mainPoolWda = Math.round(mainPoolDisposalResult.balance * mainPoolRate * 100) / 100
  const mainPoolCf = mainPoolDisposalResult.balance - mainPoolWda

  const specialRatePoolBeforeWda = priorBalances.special_rate_pool_cf + specialRatePoolAdditionsAfterReliefs
  const specialRatePoolDisposalResult = applyDisposals('special_rate_pool', specialRatePoolBeforeWda)
  const specialRatePoolWda = Math.round(specialRatePoolDisposalResult.balance * SPECIAL_RATE_POOL_RATE * lengthFactor * 100) / 100
  const specialRatePoolCf = specialRatePoolDisposalResult.balance - specialRatePoolWda

  const carMainPoolBeforeWda = priorBalances.car_main_rate_pool_cf + carMainRateAdditions
  const carMainPoolDisposalResult = applyDisposals('car_main_rate', carMainPoolBeforeWda)
  const carMainPoolWda = Math.round(carMainPoolDisposalResult.balance * mainPoolRate * 100) / 100
  const carMainPoolCf = carMainPoolDisposalResult.balance - carMainPoolWda

  const carSpecialPoolBeforeWda = priorBalances.car_special_rate_pool_cf + carSpecialRateAdditions
  const carSpecialPoolDisposalResult = applyDisposals('car_special_rate', carSpecialPoolBeforeWda)
  const carSpecialPoolWda = Math.round(carSpecialPoolDisposalResult.balance * SPECIAL_RATE_POOL_RATE * lengthFactor * 100) / 100
  const carSpecialPoolCf = carSpecialPoolDisposalResult.balance - carSpecialPoolWda

  // --- Flag disposals of assets that had 100%/50% first-year reliefs claimed - these trigger their own balancing charge,
  // separate from the pool-level mechanic above, since the asset's tax value was already reduced to (near) zero ---
  const fullReliefDisposalWarnings = disposals
    .filter((a) => (a.category === 'main_pool' && a.is_new) || (a.category === 'special_rate_pool' && a.is_new))
    .map((a) => `"${a.description}" was disposed of and may have had Full Expensing or the Special Rate Allowance claimed when acquired — check whether the full disposal proceeds should be a balancing charge rather than a pool deduction.`)

  // --- Structures & Buildings Allowance - separate, flat, no pooling, no balancing charge/allowance ---
  const sbaAssets = assets.filter((a) => a.category === 'structures_buildings' && !a.date_disposed)
  const sbaClaimed = sbaAssets.reduce((sum, a) => {
    const acquired = new Date(a.date_acquired)
    const relevantStart = acquired > periodStart ? acquired : periodStart
    const factor = daysBetween(relevantStart, periodEnd) / 365
    return sum + a.cost * SBA_RATE * Math.max(0, factor)
  }, 0)

  const totalAllowances =
    specialRatePoolAiaClaimed + specialRatePoolSrAllowanceClaimed + specialRatePoolWda +
    mainPoolFullExpensingClaimed + mainPoolAiaClaimed + mainPoolFya40Claimed + mainPoolWda +
    carZeroFya + carMainPoolWda + carSpecialPoolWda +
    sbaClaimed

  return {
    aiaLimit,
    aiaUsed,
    mainPool: {
      bf: priorBalances.main_pool_cf,
      additions: mainPoolAdditions.reduce((s, a) => s + a.cost, 0),
      disposals: mainPoolDisposalResult.proceeds,
      fullExpensing: Math.round(mainPoolFullExpensingClaimed * 100) / 100,
      aia: Math.round(mainPoolAiaClaimed * 100) / 100,
      fya40: Math.round(mainPoolFya40Claimed * 100) / 100,
      wda: mainPoolWda,
      wdaRatePercent: Math.round(mainPoolRate * 10000) / 100,
      cf: Math.round(mainPoolCf * 100) / 100,
    },
    specialRatePool: {
      bf: priorBalances.special_rate_pool_cf,
      additions: specialRateAdditions.reduce((s, a) => s + a.cost, 0),
      disposals: specialRatePoolDisposalResult.proceeds,
      aia: Math.round(specialRatePoolAiaClaimed * 100) / 100,
      srAllowance: Math.round(specialRatePoolSrAllowanceClaimed * 100) / 100,
      wda: specialRatePoolWda,
      cf: Math.round(specialRatePoolCf * 100) / 100,
    },
    carMainRatePool: {
      bf: priorBalances.car_main_rate_pool_cf,
      additions: carMainRateAdditions,
      disposals: carMainPoolDisposalResult.proceeds,
      wda: carMainPoolWda,
      cf: Math.round(carMainPoolCf * 100) / 100,
    },
    carSpecialRatePool: {
      bf: priorBalances.car_special_rate_pool_cf,
      additions: carSpecialRateAdditions,
      disposals: carSpecialPoolDisposalResult.proceeds,
      wda: carSpecialPoolWda,
      cf: Math.round(carSpecialPoolCf * 100) / 100,
    },
    carZeroEmissionFya: Math.round(carZeroFya * 100) / 100,
    sbaClaimed: Math.round(sbaClaimed * 100) / 100,
    sbaAssetCount: sbaAssets.length,
    balancingCharges,
    fullReliefDisposalWarnings,
    totalAllowances: Math.round(totalAllowances * 100) / 100,
  }
}
