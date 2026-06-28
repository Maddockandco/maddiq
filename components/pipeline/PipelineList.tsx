'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PipelineTable from '@/components/pipeline/PipelineTable'

export default function PipelineList() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from('pipeline_leads')
        .select('id, name, company_name, stage, source, estimated_value')
        .order('created_at', { ascending: false })
      if (data) setLeads(data)
      setLoading(false)
    }
    fetchLeads()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading pipeline...</p>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">No leads yet</h2>
        <p className="text-gray-500 text-sm">Add your first lead to start tracking your pipeline</p>
      </div>
    )
  }

  return <PipelineTable leads={leads} />
}
