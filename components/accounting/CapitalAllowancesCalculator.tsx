'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateDepreciation } from '@/lib/depreciation'
import { getNextAccountingPeriod } from '@/lib/accountingPeriods'

export default function DepreciationCalculator({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [periods, setPeriods] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [yearEndDate, setYearEndDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [creatingPeriod, setCreatingPeriod] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [accumDepAccountId, setAccumDepAccountId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [periodsRes, assetsRes, accountsRes, clientRes] = await Promise.all([
      supabase.from('depreciation_periods').select('*').eq('client_id', clientId).order('period_start', { ascending: false }),
      supabase.from('fixed_assets').select('*').eq('client_id', clientId),
      supabase.from('chart_of_accounts').select('id, code, name, account_type, parent_id').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('clients').select('year_end_date').eq('id', clientId).single(),
    ])
    if (periodsRes.data) setPeriods(periodsRes.data)
    if (assetsRes.data) setAssets(assetsRes.data)
    if (accountsRes.data) {
      const parentIds = new Set(accountsRes.data.map((a) => a.parent_id).filter(Boolean))
      setAllAccounts(accountsRes.data.filter((a) => !parentIds.has(a.id)))
    }
    if (clientRes.data) setYearEndDate(clientRes.data.year_end_date)
    setLoading(false)
  }

  function openNewPeriod() {
    setError('')
    const lastPeriod = periods[0]
    const earliestAssetDate = assets.length > 0
      ? assets.reduce((earliest, a) => (a.date_acquired < earliest ? a.date_acquired : earliest), assets[0].date_acquired)
      : null

    const { start, end } = getNextAccountingPeriod({
      yearEndDate,
      lastFinalizedPeriodEnd: lastPeriod ? lastPeriod.period_end : null,
      earliestAssetDate,
    })

    setPeriodStart(start)
    setPeriodEnd(end)
    setCreatingPeriod(true)
    runCalculationFor(start, end)
  }

  function runCalculationFor(start: string, end: string) {
    const calc = calculateDepreciation({
      assets: assets.map((a) => ({
        id: a.id,
        description: a.description,
        cost: parseFloat(a.cost),
        date_acquired: a.date_acquired,
        date_disposed: a.date_disposed,
        disposal_proceeds: a.disposal_proceeds != null ? parseFloat(a.disposal_proceeds) : null,
        depreciation_method: a.depreciation_method || 'straight_line',
        useful_life_years: a.useful_life_years != null ? parseFloat(a.useful_life_years) : null,
        depreciation_rate_percent: a.depreciation_rate_percent != null ? parseFloat(a.depreciation_rate_percent) : null,
        accumulated_depreciation: parseFloat(a.accumulated_depreciation || 0),
      })),
      periodStart: start,
      periodEnd: end,
    })

    setResult(calc)
  }

  function handlePostClick() {
    if (!expenseAccountId || !accumDepAccountId) {
      setError('Select both the Depreciation Expense account and the Accumulated Depreciation account before posting')
      return
    }
    setError('')
    setShowConfirm(true)
  }

  async function handlePost() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: periodEnd,
        reference: 'DEPN',
        description: `Depreciation for period ${new Date(periodStart).toLocaleDateString('en-GB')} – ${new Date(periodEnd).toLocaleDateString('en-GB')}`,
        source: 'depreciation',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) { setError(entryError.message); setSaving(false); setShowConfirm(false); return }

    const { error: linesError } = await supabase.from('journal_lines').insert([
      {
        journal_entry_id: entry.id,
        account_id: expenseAccountId,
        debit: result.totalDepreciation,
        credit: 0,
        description: 'Depreciation charge for the period',
        sort_order: 0,
      },
      {
        journal_entry_id: entry.id,
        account_id: accumDepAccountId,
        debit: 0,
        credit: result.totalDepreciation,
        description: 'Depreciation charge for the period',
        sort_order: 1,
      },
    ])

    if (linesError) { setError(linesError.message); setSaving(false); setShowConfirm(false); return }

    // Update each asset's accumulated depreciation so Net Book Value is correct going forward
    for (const line of result.lines) {
      const asset = assets.find((a) => a.id === line.assetId)
      await supabase
        .from('fixed_assets')
        .update({ accumulated_depreciation: parseFloat(asset.accumulated_depreciation || 0) + line.charge })
        .eq('id', line.assetId)
    }

    await supabase.from('depreciation_periods').insert({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      total_depreciation: result.totalDepreciation,
      depreciation_expense_account_id: expenseAccountId,
      accumulated_depreciation_account_id: accumDepAccountId,
      journal_entry_id: entry.id,
      created_by: user!.id,
    })

    setShowConfirm(false)
    setCreatingPeriod(false)
    setResult(null)
    setSaving(false)
    fetchAll()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const expenseAccounts = allAccounts.filter((a) => ['direct_costs', 'expense', 'overhead'].includes(a.account_type))

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs text-amber-700">
          Depreciation is a real accounting entry — posting here creates an actual journal entry and updates each asset's Net Book Value. This is completely separate from Capital Allowances, which only affects the tax computation and never posts to the books.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Depreciation Periods</h3>
        {can.manageEngagements && !creatingPeriod && (
          <button onClick={openNewPeriod} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + New Period
          </button>
        )}
      </div>

      {creatingPeriod && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="bg-brand-light rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Accounting Period (auto-detected from year-end)</p>
            <p className="text-base font-semibold text-brand-dark">
              {new Date(periodStart).toLocaleDateString('en-GB')} – {new Date(periodEnd).toLocaleDateString('en-GB')}
            </p>
            {!yearEndDate && (
              <p className="text-xs text-amber-600 mt-1">No year-end date is set for this client — defaulted to 31 March. Set the client's year-end in their details for accurate periods.</p>
            )}
          </div>

          <button onClick={() => { setCreatingPeriod(false); setResult(null) }} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
            Cancel
          </button>

          {result && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              {result.lines.length === 0 ? (
                <p className="text-sm text-gray-400">No depreciable assets found for this period (check assets have a depreciation method and useful life set)</p>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Asset</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Opening NBV</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Charge</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Closing NBV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.lines.map((l: any) => (
                          <tr key={l.assetId} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-brand-dark">{l.description}</td>
                            <td className="px-4 py-2 text-right text-gray-600">£{l.openingNbv.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-red-600">£{l.charge.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-brand-dark font-medium">£{l.closingNbv.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-brand-light rounded-xl p-4">
                    <p className="text-2xl font-bold text-brand-dark">Total depreciation: £{result.totalDepreciation.toFixed(2)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Depreciation Expense account (Dr)</label>
                      <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} className={inputClass}>
                        <option value="">Select account</option>
                        {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Accumulated Depreciation account (Cr)</label>
                      <select value={accumDepAccountId} onChange={(e) => setAccumDepAccountId(e.target.value)} className={inputClass}>
                        <option value="">Select account</option>
                        {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {can.manageEngagements && (
                    <button onClick={handlePostClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
                      Post Depreciation
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Post this depreciation entry?"
        message={`£${result?.totalDepreciation.toFixed(2)} will be posted as a real journal entry and each asset's Net Book Value will update. This becomes part of the permanent ledger.`}
        confirmLabel="Post Depreciation"
        confirming={saving}
        onConfirm={handlePost}
        onCancel={() => setShowConfirm(false)}
      />

      {!creatingPeriod && periods.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No depreciation posted yet</p>
        </div>
      )}

      {!creatingPeriod && periods.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-3 text-sm text-brand-dark">
                    {new Date(p.period_start).toLocaleDateString('en-GB')} – {new Date(p.period_end).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(p.total_depreciation).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
