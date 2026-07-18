'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProjectDetail({ clientId, projectId }: { clientId: string; projectId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [project, setProject] = useState<any>(null)
  const [incomeLines, setIncomeLines] = useState<any[]>([])
  const [costLines, setCostLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [projectId])

  async function fetchData() {
    setLoading(true)
    const [projectRes, incomeRes, costRes] = await Promise.all([
      supabase.from('projects').select('*, contacts(name)').eq('id', projectId).single(),
      supabase
        .from('sales_invoice_lines')
        .select('*, chart_of_accounts(code, name), sales_invoices(invoice_number, invoice_date, status)')
        .eq('project_id', projectId),
      supabase
        .from('purchase_bill_lines')
        .select('*, chart_of_accounts(code, name), purchase_bills(bill_number, bill_date, status, contacts(name))')
        .eq('project_id', projectId),
    ])
    setProject(projectRes.data)
    setIncomeLines(incomeRes.data || [])
    setCostLines(costRes.data || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading project...</p>
    </div>
  )

  if (!project) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Project not found</p>
    </div>
  )

  const totalIncome = incomeLines.reduce((sum, l) => sum + parseFloat(l.line_total), 0)
  const totalCost = costLines.reduce((sum, l) => sum + parseFloat(l.line_total), 0)
  const quoted = project.quoted_amount != null ? parseFloat(project.quoted_amount) : null
  const variance = quoted != null ? quoted - totalCost : null

  // Group costs by account, so it's clear which categories are driving any variance
  const costsByAccount: Record<string, { code: string; name: string; total: number }> = {}
  for (const l of costLines) {
    const key = l.chart_of_accounts?.code || 'unassigned'
    if (!costsByAccount[key]) {
      costsByAccount[key] = { code: l.chart_of_accounts?.code || '—', name: l.chart_of_accounts?.name || 'Unassigned', total: 0 }
    }
    costsByAccount[key].total += parseFloat(l.line_total)
  }
  const costBreakdown = Object.values(costsByAccount).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/projects`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to projects
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Project</p>
          <h1 className="text-2xl font-bold text-brand-dark">{project.name}</h1>
          {project.contacts?.name && <p className="text-sm text-gray-500 mt-1">Customer: {project.contacts.name}</p>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-brand-light rounded-xl p-4">
            <p className="text-xs text-gray-500">Quoted</p>
            <p className="text-lg font-bold text-brand-dark">{quoted != null ? `£${quoted.toFixed(2)}` : '—'}</p>
          </div>
          <div className="bg-brand-light rounded-xl p-4">
            <p className="text-xs text-gray-500">Actual Income</p>
            <p className="text-lg font-bold text-brand-dark">£{totalIncome.toFixed(2)}</p>
          </div>
          <div className="bg-brand-light rounded-xl p-4">
            <p className="text-xs text-gray-500">Actual Cost</p>
            <p className="text-lg font-bold text-brand-dark">£{totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-brand-light rounded-xl p-4">
            <p className="text-xs text-gray-500">Variance vs Quote</p>
            <p className={`text-lg font-bold ${variance == null ? 'text-brand-dark' : variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {variance != null ? `${variance >= 0 ? '+' : ''}£${variance.toFixed(2)}` : '—'}
            </p>
          </div>
        </div>

        {costBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Cost Breakdown by Category</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Category</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costBreakdown.map((c) => (
                      <tr key={c.code} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-brand-dark">{c.code} — {c.name}</td>
                        <td className="px-4 py-2 text-right font-medium text-brand-dark">£{c.total.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{totalCost > 0 ? ((c.total / totalCost) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Income Lines</p>
            {incomeLines.length === 0 ? (
              <p className="text-xs text-gray-400">No invoice lines tagged to this project yet</p>
            ) : (
              <div className="space-y-2">
                {incomeLines.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brand-dark">{l.sales_invoices?.invoice_number}</span>
                      <span className="font-medium text-brand-dark">£{parseFloat(l.line_total).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{l.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Cost Lines</p>
            {costLines.length === 0 ? (
              <p className="text-xs text-gray-400">No bill lines tagged to this project yet</p>
            ) : (
              <div className="space-y-2">
                {costLines.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brand-dark">{l.purchase_bills?.contacts?.name || l.purchase_bills?.bill_number}</span>
                      <span className="font-medium text-brand-dark">£{parseFloat(l.line_total).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{l.description} · {l.chart_of_accounts?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
