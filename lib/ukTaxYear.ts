// UK personal tax years run 6 April to 5 April. This computes which tax year
// a given date falls into, formatted as "2026/27" style, so dividends can be
// bucketed correctly for personal tax return purposes later.

export function getUkTaxYear(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const aprilSixth = new Date(year, 3, 6) // month is 0-indexed, so 3 = April

  const startYear = d >= aprilSixth ? year : year - 1
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0')

  return `${startYear}/${endYearShort}`
}
