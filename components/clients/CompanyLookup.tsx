'use client'
import { useState } from 'react'

type Props = {
  onFound: (data: any) => void
}

const INDUSTRY_SIC_GROUPS: { label: string; codes: string[] }[] = [
  { label: 'Property', codes: ['68100', '68209', '68201', '68320'] },
  { label: 'Construction', codes: ['41100', '41202', '43999', '43110'] },
  { label: 'Hospitality', codes: ['56101', '56102', '55100', '56302'] },
  { label: 'Professional Services', codes: ['69201', '70229'] },
]

export default function CompanyLookup({ onFound }: Props) {
  const [mode, setMode] = useState<'name' | 'number' | 'industry'>('name')
  const [query, setQuery] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [industryLocation, setIndustryLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<any[]>([])

  async function handleNameSearch() {
    if (!query.trim() || query.trim().length < 2) { setError('Enter at least 2 characters'); return }
    setLoading(true)
    setError('')
    setResults([])

    const response = await fetch(`/api/companies-house/search?q=${encodeURIComponent(query.trim())}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Search failed')
      setLoading(false)
      return
    }

    if (!data.companies || data.companies.length === 0) {
      setError('No companies found matching that name')
    } else {
      setResults(data.companies)
    }
    setLoading(false)
  }

  async function handleIndustrySearch() {
    if (!selectedIndustry) { setError('Choose an industry'); return }
    setLoading(true)
    setError('')
    setResults([])

    const group = INDUSTRY_SIC_GROUPS.find((g) => g.label === selectedIndustry)
    const params = new URLSearchParams()
    if (group) params.set('sic_codes', group.codes.join(','))
    params.set('company_status', 'active')
    if (industryLocation.trim()) params.set('location', industryLocation.trim())

    const response = await fetch(`/api/companies-house/advanced-search?${params.toString()}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Search failed')
      setLoading(false)
      return
    }

    if (!data.companies || data.companies.length === 0) {
      setError('No active companies found for that industry' + (industryLocation ? ' and location' : ''))
    } else {
      setResults(data.companies)
    }
    setLoading(false)
  }

  async function handleSelectResult(number: string) {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/companies-house?company_number=${number}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Company not found')
      setLoading(false)
      return
    }

    onFound(data)
    setResults([])
    setLoading(false)
  }

  async function handleNumberLookup() {
    if (!companyNumber.trim()) { setError('Enter a company number'); return }
    setLoading(true)
    setError('')

    const response = await fetch(`/api/companies-house?company_number=${companyNumber.trim()}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Company not found')
      setLoading(false)
      return
    }

    onFound(data)
    setLoading(false)
  }

  return (
    <div className="bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-dark">🏢 Find company on Companies House</p>
        <div className="flex gap-1 bg-white rounded-lg p-0.5 border border-gray-200">
          <button
            onClick={() => { setMode('name'); setError(''); setResults([]) }}
            className={`text-xs font-medium px-3 py-1 rounded-md transition ${mode === 'name' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
          >
            By name
          </button>
          <button
            onClick={() => { setMode('number'); setError(''); setResults([]) }}
            className={`text-xs font-medium px-3 py-1 rounded-md transition ${mode === 'number' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
          >
            By number
          </button>
          <button
            onClick={() => { setMode('industry'); setError(''); setResults([]) }}
            className={`text-xs font-medium px-3 py-1 rounded-md transition ${mode === 'industry' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
          >
            By industry
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}

      {mode === 'name' && (
        <>
          <p className="text-xs text-gray-500">Search by company name and pick from the results</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSearch()}
              placeholder="e.g. Acme Trading Ltd"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <button
              onClick={handleNameSearch}
              disabled={loading}
              className="bg-brand-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </>
      )}

      {mode === 'number' && (
        <>
          <p className="text-xs text-gray-500">Enter the company number to auto-fill all details</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleNumberLookup()}
              placeholder="e.g. 11739270"
              maxLength={8}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <button
              onClick={handleNumberLookup}
              disabled={loading}
              className="bg-brand-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Searching...' : 'Find company'}
            </button>
          </div>
        </>
      )}

      {mode === 'industry' && (
        <>
          <p className="text-xs text-gray-500">Find active companies by industry — useful for prospecting, not just onboarding an existing client</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
            >
              <option value="">Choose industry</option>
              {INDUSTRY_SIC_GROUPS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
            </select>
            <input
              type="text"
              value={industryLocation}
              onChange={(e) => setIndustryLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleIndustrySearch()}
              placeholder="Location (optional, e.g. Bristol)"
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>
          <button
            onClick={handleIndustrySearch}
            disabled={loading}
            className="w-full bg-brand-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.company_number}
              onClick={() => handleSelectResult(c.company_number)}
              disabled={loading}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <p className="text-sm font-medium text-brand-dark">{c.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.company_number} · {c.status} {c.address_snippet ? `· ${c.address_snippet}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
