TransactionA'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  posted: 'bg-blue-100 text-blue-700',
  voided: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-600',
  reactivated: 'bg-green-100 text-green-700',
  recorded: 'bg-green-100 text-green-700',
  created_from_order: 'bg-brand-gold/20 text-brand-dark',
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export default function TransactionAuditTrail({ entityType, entityId }: { entityType: string; entityId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { fetchLogs() }, [entityType, entityId])

  async function fetchLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('accounting_audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    if (data) setLogs(data)
    setLoading(false)
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left"
      >
        <span className="text-xs font-semibold text-brand-dark uppercase tracking-wider">
          History {logs.length > 0 ? `(${logs.length})` : ''}
        </span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400">No history recorded yet</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-gray-50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="w-full flex items-start justify-between p-3 hover:bg-gray-100 transition text-left gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {actionLabel(log.action)}
                      </span>
                    </div>
                    <p className="text-xs text-brand-dark">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.created_at).toLocaleString('en-GB')} · {log.performed_by_name}
                    </p>
                  </div>
                  {(log.old_data || log.new_data) && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{expandedId === log.id ? '▲' : '▼'}</span>
                  )}
                </button>

                {expandedId === log.id && (log.old_data || log.new_data) && (
                  <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {log.old_data && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Before</p>
                        <pre className="text-xs bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto max-h-48">
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_data && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">After</p>
                        <pre className="text-xs bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto max-h-48">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}uditTrail.tsx
