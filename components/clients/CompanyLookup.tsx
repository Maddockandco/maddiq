'use client'

import { useState } from 'react'

type Props = {
  onFound: (data: any) => void
}

export default function CompanyLookup({ onFound }: Props) {
  const [companyNumber, setCompanyNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup() {
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
      <p className="text-sm font-semibold text-brand-dark">🏢 Find company on Companies House</p>
      <p className="text-xs text-gray-500">Enter the company number to auto-fill all details</p>
      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-2">
        <input
          type="text"
          value={companyNumber}
          onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
          placeholder="e.g. 11739270"
          maxLength={8}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
        <button
          onClick={handleLookup}
          disabled={loading}
          className="bg-brand-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Searching...' : 'Find company'}
        </button>
      </div>
    </div>
  )
}
