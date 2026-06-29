'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import EngagementTable from '@/components/engagements/EngagementTable'
import EngagementForm from '@/components/engagements/EngagementForm'
import { useRole } from '@/hooks/useRole'

export default function ClientEngagements({ clientId }: { clientId: string }) {
  const [engagements, setEngagements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchEngagements() }, [clientId])

  async function fetchEngagements() {
    const { data } = await supabase
      .from('engagements')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setEngagements(data)
    setLoading(false)
  }

  function handleSaved() {
    setAdding(false)
    setEditing(null)
    fetchEngagements()
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading engagements...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && !adding && !editing && (
        <div className="flex justify-end">
          <button onClick={() => setAdding(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Add Engagement
          </button>
        </div>
      )}

      {adding && (
        <EngagementForm clientId={clientId} onSaved={handleSaved} onCancel={() => setAdding(false)} />
      )}

      {editing && (
        <EngagementForm clientId={clientId} engagement={editing} onSaved={handleSaved} onCancel={() => setEditing(null)} />
      )}

      {engagements.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <h2 className="text-lg font-semibold text-brand-dark mb-2">No engagements yet</h2>
          <p className="text-gray-500 text-sm mb-6">Add the services you are providing to this client</p>
          {can.manageEngagements && (
            <button onClick={() => setAdding(true)}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              + Add Engagement
            </button>
          )}
        </div>
      ) : (
        !adding && !editing && (
          <EngagementTable
            engagements={engagements}
            onEdit={can.manageEngagements ? setEditing : () => {}}
          />
        )
      )}
    </div>
  )
}
