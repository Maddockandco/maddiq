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
  const [mappings, setMappings] = useState<any[]>([])
  const [yearEndDate, setYearEndDate] = useState<string | null>(null)
  const [cadence, setCadence] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(true)

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [viewingPeriod, setViewingPeriod] = useState<any>(null)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [periodsRes, assetsRes, mappingsRes, clientRes, settingsRes] = await Promise.all([
      supabase.from('depreciation_periods').select('*').eq('client_id', clientId).order('period_start', { ascending: false }),
      supabase.from('fixed_assets').select('*').eq('client_id', clientId),
      supabase.from('depreciation_account_mappings').select('*').eq('client_id', clientId),
      supabase.from('clients').select('year_end_date').eq('id', clientId).single(),
      supabase.from('accounting_settings').select('depreciation_cadence').eq('client_id', clientId).maybeSingle(),
    ])
    const periodsData = periodsRes.data || []
    const assetsData = assetsRes.data || []
    setPeriods(periodsData)
    setAssets(assetsData)
    setMappings(mappingsRes.data || [])
    const yearEnd = clientRes.data?.year_end_date || null
    setYearEndDate(yearEnd)
    const savedCadence = (settingsRes.data?.depreciation_cadence as 'annual' | 'monthly') || 'annual'
    setCadence(savedCadence)
    setLoading(false)

    autoRunCurrentPeriod(periodsData, assetsData, yearEnd, savedCadence)
  }

  async function handleCadenceChange(newCadence: 'annual' | 'monthly') {
    setCadence(newCadence)
    const { data: existing } = await supabase.from('accounting_settings').select('client_id').eq('client_id', clientId).maybeSingle()
    if (existing) {
      await supabase.from('accounting_settings').update({ depreciation_cadence: newCadence }).eq('client_id', clientId)
    }
    autoRunCurrentPeriod(periods, assets, yearEndDate, newCadence)
  }

  function autoRunCurrentPeriod(periodsData: any[], assetsData: any[], yearEnd: string | null, cadenceOverride?: 'annual' | 'monthly') {
    const lastPeriod = periodsData[0]
    const earliestAssetDate = assetsData.length > 0
      ? assetsData.reduce((earliest, a) => (a.date_acquired < earliest ? a.date_acquired : earliest), assetsData[0].date_acquired)
      : null

    const { start, end } = getNextAccountingPeriod({
      yearEndDate: yearEnd,
      lastFinalizedPeriodEnd: lastPeriod ? lastPeriod.period_end : null,
      earliestAssetDate,
      cadence: cadenceOverride || cadence,
    })

    setPeriodStart(start)
    setPeriodEnd(end)
    runCalculationFor(start, end, assetsData)
  }

  function openNewPeriod() {
    setError('')
    autoRunCurrentPeriod(periods, assets, yearEndDate)
  }

  function runCalculationFor(start: string, end: string, assetsData?: any[]) {
    const source = assetsData || assets
    const calc = calculateDepreciation({
      assets: source.map((a) => ({
        id: a.id,
        description: a.description,
        category: a.category,
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

  function mappingFor(category: string) {
    return mappings.find((m) => m.reporting_category === category)
  }

  function renderBreakdownTable(categoryBreakdown: any[], totalDepreciation: number) {
    return (
      <>
        <div className="bg-brand-light rounded-xl p-4">
          <p className="text-2xl font-bold text-brand-dark">Total depreciation: £{totalDepreciation.toFixed(2)}</p>
        </div>

        {categoryBreakdown.map((c: any) => {
          const m = mappingFor(c.category)
          const hasMapping = m && m.depreciation_expense_account_id && m.accumulated_depreciation_account_id
          return (
            <div key={c.category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-dark">{c.category}</p>
                {c.charge !== 0 && !hasMapping && (
                  <span className="text-xs text-red-600">No account mapping set up</span>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500" colSpan={2}>Cost</td>
                  </tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Brought forward</td><td className="px-4 py-1 text-right text-brand-dark">£{c.costBf.toFixed(2)}</td></tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Additions</td><td className="px-4 py-1 text-right text-green-700">£{c.costAdditions.toFixed(2)}</td></tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Disposals</td><td className="px-4 py-1 text-right text-red-600">−£{c.costDisposals.toFixed(2)}</td></tr>
                  <tr className="border-t border-gray-50"><td className="px-4 py-1 pl-8 font-medium text-brand-dark">Carried forward</td><td className="px-4 py-1 text-right font-medium text-brand-dark">£{c.costCf.toFixed(2)}</td></tr>

                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500" colSpan={2}>Depreciation</td>
                  </tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Brought forward</td><td className="px-4 py-1 text-right text-brand-dark">£{c.accumDepBf.toFixed(2)}</td></tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Charge for period</td><td className="px-4 py-1 text-right text-red-600">£{c.charge.toFixed(2)}</td></tr>
                  <tr><td className="px-4 py-1 pl-8 text-gray-500">Eliminated on disposal</td><td className="px-4 py-1 text-right text-green-700">−£{c.accumDepDisposals.toFixed(2)}</td></tr>
                  <tr className="border-t border-gray-50"><td className="px-4 py-1 pl-8 font-medium text-brand-dark">Carried forward</td><td className="px-4 py-1 text-right font-medium text-brand-dark">£{c.accumDepCf.toFixed(2)}</td></tr>

                  <tr className="border-t border-gray-100 bg-brand-light/40">
                    <td className="px-4 py-2 font-semibold text-brand-dark">Net Book Value (period end)</td>
                    <td className="px-4 py-2 text-right font-semibold text-brand-dark">£{c.nbvCf.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </>
    )
  }

  function handlePostClick() {
    setError('')
    const missing = result.categoryBreakdown
      .filter((c: any) => c.charge !== 0)
      .filter((c: any) => {
        const m = mappingFor(c.category)
        return !m || !m.depreciation_expense_account_id || !m.accumulated_depreciation_account_id
      })

    if (missing.length > 0) {
      setError(`No account mapping set up for: ${missing.map((c: any) => c.category).join(', ')}. Set this up in Chart of Accounts, or re-seed from an industry template.`)
      return
    }
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

    const chargedCategories = result.categoryBreakdown.filter((c: any) => c.charge !== 0)
    const journalLines: any[] = []
    let sortOrder = 0
    for (const c of chargedCategories) {
      const m = mappingFor(c.category)
      journalLines.push({
        journal_entry_id: entry.id,
        account_id: m.depreciation_expense_account_id,
        debit: c.charge,
        credit: 0,
        description: `${c.category} — depreciation charge for the period`,
        sort_order: sortOrder++,
      })
      journalLines.push({
        journal_entry_id: entry.id,
        account_id: m.accumulated_depreciation_account_id,
        debit: 0,
        credit: c.charge,
        description: `${c.category} — depreciation charge for the period`,
        sort_order: sortOrder++,
      })
    }

    const { error: linesError } = await supabase.from('journal_lines').insert(journalLines)
    if (linesError) { setError(linesError.message); setSaving(false); setShowConfirm(false); return }

    // Update each asset's accumulated depreciation so Net Book Value is correct going forward
    for (const line of result.lines) {
      const asset = assets.find((a: any) => a.id === line.assetId)
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
      category_breakdown: result.categoryBreakdown,
      journal_entry_id: entry.id,
      created_by: user!.id,
    })

    setShowConfirm(false)
    setResult(null)
    setSaving(false)
    fetchAll()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs text-amber-700">
          Depreciation is a real accounting entry — posting here creates an actual multi-line journal entry (one Depreciation charge and one Accumulated Depreciation line per category in use) and updates each asset's Net Book Value. Completely separate from Capital Allowances, which only affects the tax computation and never posts to the books.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Current Period</h3>
        <div className="flex items-center gap-3">
          {can.manageEngagements && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['annual', 'monthly'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCadenceChange(c)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition capitalize ${cadence === c ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {can.manageEngagements && (
            <button onClick={openNewPeriod} className="bg-gray-100 text-brand-dark font-semibold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition">
              Recalculate
            </button>
          )}
        </div>
      </div>

      {periodStart && (
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

          {result && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              {result.categoryBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400">No depreciable assets found for this period (check assets have a depreciation method and useful life set)</p>
              ) : (
                <>
                  {renderBreakdownTable(result.categoryBreakdown, result.totalDepreciation)}

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
        message={`£${result?.totalDepreciation.toFixed(2)} will be posted as a real multi-line journal entry (one Depreciation charge and one Accumulated Depreciation line per category), and each asset's Net Book Value will update. This becomes part of the permanent ledger.`}
        confirmLabel="Post Depreciation"
        confirming={saving}
        onConfirm={handlePost}
        onCancel={() => setShowConfirm(false)}
      />

      {periods.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No depreciation posted yet</p>
        </div>
      )}

      {periods.length > 0 && (
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
                <tr
                  key={p.id}
                  onClick={() => setViewingPeriod(viewingPeriod?.id === p.id ? null : p)}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-brand-light transition ${viewingPeriod?.id === p.id ? 'bg-brand-gold/10' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
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

      {viewingPeriod && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
              {new Date(viewingPeriod.period_start).toLocaleDateString('en-GB')} – {new Date(viewingPeriod.period_end).toLocaleDateString('en-GB')} (posted)
            </h3>
            <button onClick={() => setViewingPeriod(null)} className="text-xs text-gray-500 hover:underline">Close</button>
          </div>
          {viewingPeriod.category_breakdown && viewingPeriod.category_breakdown.length > 0
            ? renderBreakdownTable(viewingPeriod.category_breakdown, parseFloat(viewingPeriod.total_depreciation))
            : <p className="text-sm text-gray-400">No category breakdown was stored for this period (posted before this feature was added).</p>
          }
        </div>
      )}
    </div>
  )
}
