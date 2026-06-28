'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeadlineTable from '@/components/deadlines/DeadlineTable'

export default function DeadlineList() {
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDeadlines() {
      const { data } = await supabase
        .from('statutory_deadlines')
        .select('id, type, period_end, due_date, status, clients(name)')
        .order('due_date', { ascending: true })
      if (data) setDeadlines(data)
      setLoading(false)
    }
    fetchDeadlines()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading deadlines...</p>
      </div>
    )
  }

  if (deadlines.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">No deadlines yet</h2>
        <p className="text-gray-500 text-sm">Deadlines will appear here once clients are added</p>
      </div>
    )
  }

  return <DeadlineTable deadlines={deadlines} />
}
