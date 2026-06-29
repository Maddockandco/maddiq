'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import GenerateDeadlines from '@/components/clients/GenerateDeadlines'
import { useRole } from '@/hooks/useRole'

export default function ClientDeadlines({ clientId }: { clientId: string }) {
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchDeadlines() }, [clientId])

  async function fetchDeadlines() {
    const { data } = await supabase
      .from('statutory_deadlines')
      .select('id, type, period_end, due_date, status, notes')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true })
    if (data) setDeadlines(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading deadlines...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.generateDeadlines && (
        <div className="flex justify-end">
          <GenerateDeadlines clientId={clientId} onGenerated={fetchDeadlines} />
        </div>
      )}

      {deadlines.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-4">No deadlines generated yet</p>
          <p className="text-gray-400 text-xs">Click "Generate deadlines" to create statutory deadlines for this client</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <div className="divide-y divide-gray-50">
            {deadlines.map((deadline) => {
              const dueDate = new Date(deadline.due_date)
              const today = new Date()
              const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const isOverdue = daysUntilDue < 0
              const isDueSoon = daysUntilDue <= 30 && daysUntilDue >= 0
              return (
                <div key={deadline.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-brand-dark">
                      {deadline.notes || deadline.type.replace(/_/g, ' ')}
                    </p>
                    {deadline.period_end && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Period ending {new Date(deadline.period_end).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-brand-dark'}`}>
                        {dueDate.toLocaleDateString('en-GB')}
                      </p>
                      {isOverdue && <p className="text-xs text-red-500 mt-0.5">🚨 {Math.abs(daysUntilDue)} days overdue</p>}
                      {isDueSoon && <p className="text-xs text-amber-500 mt-0.5">⚠️ Due in {daysUntilDue} days</p>}
                    </div>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      deadline.status === 'filed' ? 'bg-green-100 text-green-700' :
                      deadline.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      deadline.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {deadline.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
