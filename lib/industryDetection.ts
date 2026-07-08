export const INDUSTRY_LABELS: Record<string, string> = {
  general: 'General / Professional Services',
  hospitality: 'Hospitality',
  construction: 'Construction',
  property: 'Property / Landlord',
}

export function detectIndustryFromSicCode(sicCode: string | null | undefined): string | null {
  if (!sicCode) return null
  const code = parseInt(sicCode, 10)
  if (isNaN(code)) return null
  if (code >= 55000 && code <= 56302) return 'hospitality'
  if (code >= 41000 && code <= 43999) return 'construction'
  if (code >= 68000 && code <= 68999) return 'property'
  return null
}

export function detectIndustryFromText(industryText: string | null | undefined): string | null {
  if (!industryText) return null
  const t = industryText.toLowerCase()
  if (/restaurant|cafe|caf[eé]|bar|pub|hotel|catering|hospitality|bistro/.test(t)) return 'hospitality'
  if (/construct|building|contractor|builder|cis\b/.test(t)) return 'construction'
  if (/landlord|letting|rental|property|real estate/.test(t)) return 'property'
  return null
}

// Combines both signals, SIC code taking priority since it's official Companies House data
export function detectIndustry(sicCode: string | null | undefined, industryText: string | null | undefined): string | null {
  return detectIndustryFromSicCode(sicCode) || detectIndustryFromText(industryText) || null
}
