'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  chart_of_accounts: 'Chart of Accounts',
  journal_entry: 'Journal Entry',
  contacts: 'Contact',
  sales_invoice: 'Sales Invoice',
  purchase_bill: 'Purchase Bill',
  sales_receipt: 'Receipt',
  purchase_payment: 'Payment',
}

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  posted: 'bg-blue-100 text-blue-700',
  voided: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-600',
  reactivated: 'bg-green-100 text-green-700',
  bulk_seeded: 'bg-gray-100 text-gray-600',
  recorded: 'bg-green-100 text-green-700',
  created_from_order: 'bg-brand-gold/20 text-brand-dark',
  opening_balances_recorded: 'bg-purple-100 text-purple-700',
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

const IGNORED_FIELDS = new Set(['id', 'firm_id', 'client_id', 'created_at', 'created_by', 'updated_at'])

function humanizeLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function renderChanges(oldData: any, newData: any) {
  if (oldData && newData) {
    const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    const changes: { key: string; oldVal: any; newVal: any }[] = []
    for (const key of allKeys) {
      if (IGNORED_FIELDS.has(key)) continue
      const oldVal = oldData[key]
      const newVal = newData[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) changes.push({ key, oldVal, newVal })
    }
    if (changes.length === 0) return <p className="text-xs text-gray-400">No visible field changes</p>
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
        {changes.map((c) => (
          <div key={c.key} className="text-xs">
            <span className="text-gray-500">{humanizeLabel(c.key)}: </span>
            <span className="text-red-500 line-through">{formatValue(c.oldVal)}</span>
            <span className="text-gray-400"> → </span>
            <span className="text-green-600 font-medium">{formatValue(c.newVal)}</span>
          </div>
        ))}
      </div>
    )
  }

  const data = newData || oldData
  const entries = Object.entries(data || {}).filter(([k, v]) => !IGNORED_FIELDS.has(k) && v !== null && v !== '')
  if (entries.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="text-xs">
          <span className="text-gray-500">{humanizeLabel(k)}: </span>
          <span className="text-brand-dark">{formatValue(v)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AuditTrail({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => { fetchLogs() }, [clientId, entityFilter, dateFrom, dateTo])

  async function fetchLogs() {
    setLoading(true)
    let query = supabase
      .from('accounting_audit_log')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter)
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
    }

    const { data } = await query
    if (data) setLogs(data)
    setLoading(false)
  }

  const availableEntityTypes = Array.from(new Set(logs.map((l) => l.entity_type)))
  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading audit trail...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 text-blue-700 text-xs rounded-lg px-4 py-3">
        This is a complete, permanent record of every accounting action taken for this client — nothing here can be edited or deleted, even by administrators. Showing the most recent 500 entries.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className={inputClass}>
          <option value="all">All entity types</option>
          {availableEntityTypes.map((t) => (
            <option key={t} value={t}>{ENTITY_TYPE_LABELS[t] || t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <label className="text-xs text-gray-500">From</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        <label className="text-xs text-gray-500">To</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        {(entityFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => { setEntityFilter('all'); setDateFrom(''); setDateTo('') }}
            className="text-xs text-brand-dark font-medium hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No audit log entries match these filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex items-start justify-between p-4 hover:bg-gray-50 transition text-left gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {actionLabel(log.action)}
                    </span>
                    <span className="text-xs text-gray-400">{ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm text-brand-dark">{log.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(log.created_at).toLocaleString('en-GB')} · {log.performed_by_name}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{expandedId === log.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === log.id && (log.old_data || log.new_data) && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  {renderChanges(log.old_data, log.new_data)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
