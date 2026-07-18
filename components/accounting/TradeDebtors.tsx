'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

function getBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Current',
  '1-30': '1–30 Days',
  '31-60': '31–60 Days',
  '61-90': '61–90 Days',
  '90+': '90+ Days',
}

const BUCKET_COLORS: Record<AgingBucket, string> = {
  current: 'text-green-700 bg-green-50',
  '1-30': 'text-amber-700 bg-amber-50',
  '31-60': 'text-orange-700 bg-orange-50',
  '61-90': 'text-red-700 bg-red-50',
  '90+': 'text-red-800 bg-red-100',
}

export default function TradeDebtors({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'summary' | 'detailed'>('summary')

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('sales_invoices')
      .select('*, contacts(name)')
      .eq('client_id', clientId)
      .in('status', ['awaiting_payment', 'partially_paid'])
      .order('due_date')
    setInvoices(data || [])
    setLoading(false)
  }

  const today = new Date()
  const enriched = invoices.map((inv) => {
    const outstanding = parseFloat(inv.total) - parseFloat(inv.amount_paid || 0)
    const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
    return { ...inv, outstanding, daysOverdue, bucket: getBucket(daysOverdue) }
  }).filter((inv) => inv.outstanding > 0.005)

  const byContact: Record<string, { name: string; invoices: any[]; buckets: Record<AgingBucket, number>; total: number }> = {}
  for (const inv of enriched) {
    const key = inv.contact_id
    if (!byContact[key]) {
      byContact[key] = { name: inv.contacts?.name || 'Unknown', invoices: [], buckets: { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, total: 0 }
    }
    byContact[key].invoices.push(inv)
    byContact[key].buckets[inv.bucket as AgingBucket] += inv.outstanding
    byContact[key].total += inv.outstanding
  }
  const contactRows = Object.values(byContact).sort((a, b) => b.total - a.total)

  const grandTotal = contactRows.reduce((sum, c) => sum + c.total, 0)
  const grandBuckets: Record<AgingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const c of contactRows) {
    for (const b of Object.keys(grandBuckets) as AgingBucket[]) grandBuckets[b] += c.buckets[b]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Trade Debtors (Aged Receivables)</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView('summary')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${view === 'summary' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
            Summary
          </button>
          <button onClick={() => setView('detailed')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${view === 'detailed' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
            Detailed
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Total Outstanding</p>
        <p className="text-2xl font-bold text-brand-dark">£{grandTotal.toFixed(2)}</p>
        <div className="grid grid-cols-5 gap-2 mt-3">
          {(Object.keys(BUCKET_LABELS) as AgingBucket[]).map((b) => (
            <div key={b} className={`rounded-lg p-2 text-center ${BUCKET_COLORS[b]}`}>
              <p className="text-xs">{BUCKET_LABELS[b]}</p>
              <p className="text-sm font-bold">£{grandBuckets[b].toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : contactRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No outstanding invoices — nice and clean</p>
        </div>
      ) : view === 'summary' ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                  {(Object.keys(BUCKET_LABELS) as AgingBucket[]).map((b) => (
                    <th key={b} className="text-right px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider">{BUCKET_LABELS[b]}</th>
                  ))}
                  <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {contactRows.map((c, i) => (
                  <tr key={c.name} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{c.name}</td>
                    {(Object.keys(BUCKET_LABELS) as AgingBucket[]).map((b) => (
                      <td key={b} className="px-4 py-3 text-sm text-right text-gray-600">{c.buckets[b] > 0 ? `£${c.buckets[b].toFixed(2)}` : '—'}</td>
                    ))}
                    <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{c.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {contactRows.map((c) => (
            <div key={c.name} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-dark">{c.name}</p>
                <p className="text-sm font-bold text-brand-dark">£{c.total.toFixed(2)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Invoice #</th>
                      <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Due Date</th>
                      <th className="text-right px-6 py-2 text-xs font-semibold text-gray-500">Days Overdue</th>
                      <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Bucket</th>
                      <th className="text-right px-6 py-2 text-xs font-semibold text-gray-500">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.invoices.sort((a: any, b: any) => b.daysOverdue - a.daysOverdue).map((inv: any) => (
                      <tr key={inv.id} className="border-b border-gray-50">
                        <td className="px-6 py-2 text-brand-dark font-mono">{inv.invoice_number}</td>
                        <td className="px-6 py-2 text-gray-600">{new Date(inv.due_date).toLocaleDateString('en-GB')}</td>
                        <td className="px-6 py-2 text-right text-gray-600">{inv.daysOverdue > 0 ? inv.daysOverdue : 0}</td>
                        <td className="px-6 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_COLORS[inv.bucket as AgingBucket]}`}>{BUCKET_LABELS[inv.bucket as AgingBucket]}</span>
                        </td>
                        <td className="px-6 py-2 text-right font-medium text-brand-dark">£{inv.outstanding.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
