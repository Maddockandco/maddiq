// Automatically determines the next accounting period to calculate, based on the
// client's recurring year-end (month/day), rather than requiring manual date entry each time.

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function toIso(d: Date) {
  return d.toISOString().split('T')[0]
}

export function getNextAccountingPeriod(params: {
  yearEndDate: string | null // client's year_end_date - only the month/day is used, recurring annually
  lastFinalizedPeriodEnd: string | null // most recent period_end already finalized, if any
  earliestAssetDate: string | null // earliest date_acquired in the Fixed Asset Register, used to seed period 1 if nothing's been finalized yet
}): { start: string; end: string } {
  const today = new Date()

  if (params.lastFinalizedPeriodEnd) {
    // Continue straight on from where the last finalized period left off
    const start = new Date(params.lastFinalizedPeriodEnd)
    start.setDate(start.getDate() + 1)
    const end = new Date(addYears(start, 1))
    end.setDate(end.getDate() - 1)
    return { start: toIso(start), end: toIso(end) }
  }

  // No prior period - work out the very first one, anchored to the year-end pattern
  const yearEnd = params.yearEndDate ? new Date(params.yearEndDate) : null
  const anchorMonth = yearEnd ? yearEnd.getMonth() : 2 // default March if no year-end set yet
  const anchorDay = yearEnd ? yearEnd.getDate() : 31

  // Find the first occurrence of the year-end month/day that is on or after the earliest asset's
  // acquisition date (or today, if there are no assets yet)
  const earliestRelevant = params.earliestAssetDate ? new Date(params.earliestAssetDate) : today

  let candidateEnd = new Date(earliestRelevant.getFullYear(), anchorMonth, anchorDay)
  if (candidateEnd < earliestRelevant) {
    candidateEnd = new Date(earliestRelevant.getFullYear() + 1, anchorMonth, anchorDay)
  }

  const candidateStart = params.earliestAssetDate
    ? earliestRelevant // a genuinely short first period, starting from the earliest asset
    : new Date(candidateEnd.getFullYear() - 1, anchorMonth, anchorDay + 1)

  return { start: toIso(candidateStart), end: toIso(candidateEnd) }
}
