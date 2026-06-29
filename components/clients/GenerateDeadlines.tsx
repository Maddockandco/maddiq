'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GenerateDeadlines({ clientId }: { clientId: string }) {
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
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-xs rounded-lg px-3 py-2">
          ✅ Deadlines generated successfully!
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition w-full disabled:opacity-50"
      >
        📅 {loading ? 'Generating...' : 'Generate deadlines'}
      </button>
    </div>
  )
}
