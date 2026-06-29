'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RefreshFromCH({ clientId, companyNumber, onRefreshed }: { clientId: string; companyNumber: string; onRefreshed: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function handleRefresh() {
    setLoading(true)
    setError('')
    setSuccess(false)

    const response = await fetch(`/api/companies-house?company_number=${companyNumber}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Failed to fetch from Companies House')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        sic_code: data.sic_codes?.[0] || null,
        incorporation_date: data.incorporated_on || null,
        registered_address: data.registered_address || null,
        next_accounts_due: data.next_accounts_due || null,
        next_confirmation_due: data.next_confirmation_due || null,
        accounting_reference_date: data.accounting_reference_date || null,
      })
      .eq('id', clientId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      onRefreshed()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-xs rounded-lg px-3 py-2">✅ Updated from Companies House!</div>}
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg border border-brand-gold text-brand-dark hover:bg-brand-gold/10 transition disabled:opacity-50 font-medium"
      >
        {loading ? 'Fetching...' : '🔄 Refresh from Companies House'}
      </button>
    </div>
  )
}
