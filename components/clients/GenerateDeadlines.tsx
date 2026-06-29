'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GenerateDeadlines({ clientId, onGenerated }: { clientId: string; onGenerated?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setSuccess(false)

    const { error: rpcError } = await supabase.rpc('generate_client_deadlines', {
      p_client_id: clientId,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setSuccess(true)
      if (onGenerated) onGenerated()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-xs rounded-lg px-3 py-2">✅ Deadlines generated!</div>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
      >
        📅 {loading ? 'Generating...' : 'Generate deadlines'}
      </button>
    </div>
  )
}
