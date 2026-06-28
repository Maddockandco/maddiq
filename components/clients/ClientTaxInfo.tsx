'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ClientTaxInfo({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      if (data) setClient(data)
      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading tax info...</p>
      </div>
    )
  }

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-brand-dark">{value || '—'}</span>
    </div>
  )

  const BoolRow = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex justify-between py-2.5
