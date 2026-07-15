'use client'

import { useEffect, useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateCapitalAllowances } from '@/lib/capitalAllowances'
import { getNextAccountingPeriod } from '@/lib/accountingPeriods'

export default function CapitalAllowancesCalculator({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [periods, setPeriods] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [isCompany, setIsCompany] = useState(true)
  const [yearEndDate, setYearEndDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [periodStart, setPeriodStart] = useState('')
  const [openingBalances, setOpeningBalances] = useState({ main_pool: '0', special_rate_pool: '0', car_main_rate_pool: '0', car_special_rate_pool: '0' })
  const [openingBalancesSaved, setOpeningBalancesSaved] = useState(false)
  const [savingOpeningBalances, setSavingOpeningBalances] = useState(false)
  const [periodEnd, setPeriodEnd] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [result, setResult] = useState<any>(null)
  const [viewingPeriod, setViewingPeriod] = useState<any>(null)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [periodsRes, assetsRes, clientRes, openingRes] = await Promise.all([
      supabase.from('capital_allowances_periods').select('*').eq('client_id', clientId).order('period_start', { ascending: false }),
      supabase.from('fixed_assets').select('*').eq('client_id', clientId),
      supabase.from('clients').select('type, year_end_date').eq('id', clientId).single(),
      supabase.from('capital_allowances_opening_balances').select('*').eq('client_id', clientId).maybeSingle(),
    ])
    const periodsData = periodsRes.data || []
    const assetsData = assetsRes.data || []
    setPeriods(periodsData)
    setAssets(assetsData)
    const companyFlag = clientRes.data?.type === 'company'
    const yearEnd = clientRes.data?.year_end_date || null
    if (clientRes.data) {
      setIsCompany(companyFlag)
      setYearEndDate(yearEnd)
    }
    let openingBals = { main_pool: '0', special_rate_pool: '0', car_main_rate_pool: '0', car_special_rate_pool: '0' }
    if (openingRes.data) {
      openingBals = {
        main_pool: String(openingRes.data.main_pool),
        special_rate_pool: String(openingRes.data.special_rate_pool),
        car_main_rate_pool: String(openingRes.data.car_main_rate_pool),
        car_special_rate_pool: String(openingRes.data.car_special_rate_pool),
      }
      setOpeningBalancesSaved(true)
    }
    setOpeningBalances(openingBals)
    setLoading(false)

    autoRunCurrentPeriod(periodsData, assetsData, yearEnd, companyFlag, openingBals)
  }

  async function saveOpeningBalances() {
    setSavingOpeningBalances(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setSavingOpeningBalances(false); return }

    const payload = {
      client_id: clientId,
      firm_id: firmUser.firm_id,
      main_pool: parseFloat(openingBalances.main_pool) || 0,
      special_rate_pool: parseFloat(openingBalances.special_rate_pool) || 0,
      car_main_rate_pool: parseFloat(openingBalances.car_main_rate_pool) || 0,
      car_special_rate_pool: parseFloat(openingBalances.car_special_rate_pool) || 0,
    }
    await supabase.from('capital_allowances_opening_balances').upsert(payload, { onConflict: 'client_id' })
    setOpeningBalancesSaved(true)
    setSavingOpeningBalances(false)
    autoRunCurrentPeriod(periods, assets, yearEndDate, isCompany, openingBalances)
  }

  function autoRunCurrentPeriod(periodsData: any[], assetsData: any[], yearEnd: string | null, companyFlag: boolean, openingBals?: typeof openingBalances) {
    const lastFinalized = periodsData.find((p) => p.status === 'finalized')
    const earliestAssetDate = assetsData.length > 0
      ? assetsData.reduce((earliest, a) => (a.date_acquired < earliest ? a.date_acquired : earliest), assetsData[0].date_acquired)
      : null

    const { start, end } = getNextAccountingPeriod({
      yearEndDate: yearEnd,
      lastFinalizedPeriodEnd: lastFinalized ? lastFinalized.period_end : null,
      earliestAssetDate,
    })

    setPeriodStart(start)
    setPeriodEnd(end)
    runCalculationFor(start, end, periodsData, assetsData, companyFlag, openingBals)
  }

  function openNewPeriod() {
    setError('')
    autoRunCurrentPeriod(periods, assets, yearEndDate, isCompany, openingBalances)
  }

  function runCalculationFor(start: string, end: string, periodsData?: any[], assetsData?: any[], companyFlag?: boolean, openingBals?: typeof openingBalances) {
    const periodsSource = periodsData || periods
    const assetsSource = assetsData || assets
    const isCompanySource = companyFlag !== undefined ? companyFlag : isCompany
    const openingSource = openingBals || openingBalances

    const lastFinalized = periodsSource.find((p) => p.status === 'finalized' && new Date(p.period_end) < new Date(start))
    const priorBalances = lastFinalized
      ? {
          main_pool_cf: parseFloat(lastFinalized.main_pool_cf),
          special_rate_pool_cf: parseFloat(lastFinalized.special_rate_pool_cf),
          car_main_rate_pool_cf: parseFloat(lastFinalized.car_main_rate_pool_cf),
          car_special_rate_pool_cf: parseFloat(lastFinalized.car_special_rate_pool_cf),
        }
      : {
          // No prior finalized period - use the client's opening balances (from onboarding
          // with pre-existing assets) instead of silently assuming an empty pool, which would
          // otherwise falsely trigger balancing charges on disposal of assets acquired before Maddiq
          main_pool_cf: parseFloat(openingSource.main_pool) || 0,
          special_rate_pool_cf: parseFloat(openingSource.special_rate_pool) || 0,
          car_main_rate_pool_cf: parseFloat(openingSource.car_main_rate_pool) || 0,
          car_special_rate_pool_cf: parseFloat(openingSource.car_special_rate_pool) || 0,
        }

    const calc = calculateCapitalAllowances({
      assets: assetsSource.map((a) => ({
        id: a.id,
        description: a.description,
        category: a.category,
        date_acquired: a.date_acquired,
        cost: parseFloat(a.cost),
        is_new: a.is_new,
        co2_emissions: a.co2_emissions,
        date_disposed: a.date_disposed,
        disposal_proceeds: a.disposal_proceeds != null ? parseFloat(a.disposal_proceeds) : null,
      })),
      priorBalances,
      periodStart: start,
      periodEnd: end,
      isCompany: isCompanySource,
    })

    setResult(calc)
  }

  async function handleFinalize() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const { error: insertError } = await supabase.from('capital_allowances_periods').insert({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'finalized',
      main_pool_bf: result.mainPool.bf,
      main_pool_additions: result.mainPool.additions,
      main_pool_disposals: result.mainPool.disposals,
      main_pool_aia: result.mainPool.aia,
      main_pool_fya: result.mainPool.fullExpensing + result.mainPool.fya40,
      main_pool_wda: result.mainPool.wda,
      main_pool_cf: result.mainPool.cf,
      special_rate_pool_bf: result.specialRatePool.bf,
      special_rate_pool_additions: result.specialRatePool.additions,
      special_rate_pool_disposals: result.specialRatePool.disposals,
      special_rate_pool_aia: result.specialRatePool.aia + result.specialRatePool.srAllowance,
      special_rate_pool_wda: result.specialRatePool.wda,
      special_rate_pool_cf: result.specialRatePool.cf,
      car_main_rate_pool_bf: result.carMainRatePool.bf,
      car_main_rate_pool_additions: result.carMainRatePool.additions,
      car_main_rate_pool_disposals: result.carMainRatePool.disposals,
      car_main_rate_pool_wda: result.carMainRatePool.wda,
      car_main_rate_pool_cf: result.carMainRatePool.cf,
      car_special_rate_pool_bf: result.carSpecialRatePool.bf,
      car_special_rate_pool_additions: result.carSpecialRatePool.additions,
      car_special_rate_pool_disposals: result.carSpecialRatePool.disposals,
      car_special_rate_pool_wda: result.carSpecialRatePool.wda,
      car_special_rate_pool_cf: result.carSpecialRatePool.cf,
      car_zero_emission_fya: result.carZeroEmissionFya,
      sba_claimed: result.sbaClaimed,
      balancing_charges: result.balancingCharges.reduce((s: number, b: any) => s + b.amount, 0),
      total_allowances: result.totalAllowances,
      aia_used: result.aiaUsed,
      created_by: user!.id,
      finalized_at: new Date().toISOString(),
    })

    if (insertError) { setError(insertError.message); setSaving(false); setShowConfirm(false); return }

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
          This calculator applies current HMRC capital allowance rules based on the Fixed Asset Register. AIA is allocated to the Special Rate Pool first (since it converts lower relief rates into 100%), then to Main Pool assets not eligible for Full Expensing. This is a planning tool — review every figure before it goes on a return, especially AIA allocation across any connected companies, which isn't yet accounted for here.
        </p>
      </div>

      {periods.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Opening Pool Balances</h3>
          <p className="text-xs text-gray-500">
            If this client had capital assets before joining Maddiq, enter their written-down pool balances brought forward from their previous accountant/software here — otherwise the first period will incorrectly assume the pools started at £0, which can wrongly trigger balancing charges when those older assets are later disposed of.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { key: 'main_pool', label: 'Main Pool' },
              { key: 'special_rate_pool', label: 'Special Rate Pool' },
              { key: 'car_main_rate_pool', label: 'Car — Main Rate Pool' },
              { key: 'car_special_rate_pool', label: 'Car — Special Rate Pool' },
            ] as const).map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{f.label} (£)</label>
                <input
                  type="number"
                  value={openingBalances[f.key]}
                  onChange={(e) => { setOpeningBalances((prev) => ({ ...prev, [f.key]: e.target.value })); setOpeningBalancesSaved(false) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            ))}
          </div>
          {can.manageEngagements && (
            <button
              onClick={saveOpeningBalances}
              disabled={savingOpeningBalances}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {savingOpeningBalances ? 'Saving...' : openingBalancesSaved ? 'Saved ✓' : 'Save Opening Balances'}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Current Period</h3>
        {can.manageEngagements && (
          <button onClick={openNewPeriod} className="bg-gray-100 text-brand-dark font-semibold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition">
            Recalculate
          </button>
        )}
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
              {renderAllowancesBreakdown(result)}

              {can.manageEngagements && (
                <button onClick={() => setShowConfirm(true)} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
                  Finalize This Period
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Finalize this accounting period?"
        message={`Total allowances of £${result?.totalAllowances.toLocaleString()} will be recorded, and the carried-forward pool balances will seed the next period. This can't be edited afterward — you'd need to reverse it.`}
        confirmLabel="Finalize Period"
        confirming={saving}
        danger
        onConfirm={handleFinalize}
        onCancel={() => setShowConfirm(false)}
      />

      {periods.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No accounting periods calculated yet</p>
        </div>
      )}

      {periods.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total Allowances</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
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
                  <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(p.total_allowances).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 capitalize">{p.status}</span>
                  </td>
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
              {new Date(viewingPeriod.period_start).toLocaleDateString('en-GB')} – {new Date(viewingPeriod.period_end).toLocaleDateString('en-GB')} (finalized)
            </h3>
            <button onClick={() => setViewingPeriod(null)} className="text-xs text-gray-500 hover:underline">Close</button>
          </div>
          {renderAllowancesBreakdown(historicalResultFrom(viewingPeriod))}
        </div>
      )}
    </div>
  )
}

function renderAllowancesBreakdown(result: any) {
  return (
    <>
      <div className="bg-brand-light rounded-xl p-4">
        {result.aiaLimit != null && (
          <p className="text-xs text-gray-500">AIA available this period: £{result.aiaLimit.toLocaleString()} · Used: £{result.aiaUsed.toLocaleString()}</p>
        )}
        {result.aiaLimit == null && (
          <p className="text-xs text-gray-500">AIA used: £{result.aiaUsed.toLocaleString()} (limit not stored for this historical period)</p>
        )}
        <p className="text-2xl font-bold text-brand-dark mt-1">Total allowances: £{result.totalAllowances.toLocaleString()}</p>
      </div>

      {result.balancingCharges && result.balancingCharges.length > 0 && (
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Balancing charges</p>
          {result.balancingCharges.map((b: any, i: number) => (
            <p key={i} className="text-xs text-red-600">{b.asset ? `${b.asset}: ` : ''}£{b.amount.toFixed(2)}{b.reason ? ` — ${b.reason}` : ''}</p>
          ))}
        </div>
      )}

      {result.fullReliefDisposalWarnings && result.fullReliefDisposalWarnings.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 space-y-1">
          {result.fullReliefDisposalWarnings.map((w: string, i: number) => (
            <p key={i} className="text-xs text-amber-700">{w}</p>
          ))}
        </div>
      )}

      <PoolTable title="Main Pool" data={result.mainPool} extraRows={[
        { label: 'Full Expensing', value: result.mainPool.fullExpensing },
        { label: 'AIA', value: result.mainPool.aia },
        { label: '40% FYA', value: result.mainPool.fya40 },
        { label: `WDA (${result.mainPool.wdaRatePercent}%)`, value: result.mainPool.wda },
      ]} />

      <PoolTable title="Special Rate Pool" data={result.specialRatePool} extraRows={[
        { label: 'AIA', value: result.specialRatePool.aia },
        { label: '50% Special Rate Allowance', value: result.specialRatePool.srAllowance },
        { label: 'WDA (6%)', value: result.specialRatePool.wda },
      ]} />

      <PoolTable title="Car — Main Rate Pool" data={result.carMainRatePool} extraRows={[
        { label: `WDA (${result.mainPool.wdaRatePercent}%)`, value: result.carMainRatePool.wda },
      ]} />

      <PoolTable title="Car — Special Rate Pool" data={result.carSpecialRatePool} extraRows={[
        { label: 'WDA (6%)', value: result.carSpecialRatePool.wda },
      ]} />

      <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400">Zero-emission cars (100% FYA)</p>
          <p className="text-sm font-semibold text-brand-dark">£{result.carZeroEmissionFya.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Structures & Buildings{result.sbaAssetCount != null ? ` (${result.sbaAssetCount} building${result.sbaAssetCount === 1 ? '' : 's'})` : ''}</p>
          <p className="text-sm font-semibold text-brand-dark">£{result.sbaClaimed.toFixed(2)}</p>
        </div>
      </div>
    </>
  )
}

// Reconstructs a result-shaped object from a stored (finalized) period row, so the same
// breakdown view works for historical periods. Some detail genuinely isn't stored (e.g. the
// AIA/Full-Expensing split within a pool was combined at save time) - flagged where relevant.
function historicalResultFrom(p: any) {
  return {
    aiaLimit: null,
    aiaUsed: parseFloat(p.aia_used || 0),
    totalAllowances: parseFloat(p.total_allowances || 0),
    balancingCharges: parseFloat(p.balancing_charges || 0) > 0 ? [{ amount: parseFloat(p.balancing_charges), reason: 'See journal entries for this period for detail' }] : [],
    fullReliefDisposalWarnings: [],
    mainPool: {
      bf: parseFloat(p.main_pool_bf), additions: parseFloat(p.main_pool_additions), disposals: parseFloat(p.main_pool_disposals),
      fullExpensing: parseFloat(p.main_pool_fya), aia: parseFloat(p.main_pool_aia), fya40: 0,
      wda: parseFloat(p.main_pool_wda), wdaRatePercent: '—', cf: parseFloat(p.main_pool_cf),
    },
    specialRatePool: {
      bf: parseFloat(p.special_rate_pool_bf), additions: parseFloat(p.special_rate_pool_additions), disposals: parseFloat(p.special_rate_pool_disposals),
      aia: parseFloat(p.special_rate_pool_aia), srAllowance: 0, wda: parseFloat(p.special_rate_pool_wda), cf: parseFloat(p.special_rate_pool_cf),
    },
    carMainRatePool: {
      bf: parseFloat(p.car_main_rate_pool_bf), additions: parseFloat(p.car_main_rate_pool_additions), disposals: parseFloat(p.car_main_rate_pool_disposals),
      wda: parseFloat(p.car_main_rate_pool_wda), cf: parseFloat(p.car_main_rate_pool_cf),
    },
    carSpecialRatePool: {
      bf: parseFloat(p.car_special_rate_pool_bf), additions: parseFloat(p.car_special_rate_pool_additions), disposals: parseFloat(p.car_special_rate_pool_disposals),
      wda: parseFloat(p.car_special_rate_pool_wda), cf: parseFloat(p.car_special_rate_pool_cf),
    },
    carZeroEmissionFya: parseFloat(p.car_zero_emission_fya || 0),
    sbaClaimed: parseFloat(p.sba_claimed || 0),
    sbaAssetCount: null,
  }
}

function PoolTable({ title, data, extraRows }: { title: string; data: any; extraRows: { label: string; value: number }[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500">Brought forward</span><span className="text-right text-brand-dark">£{data.bf.toFixed(2)}</span>
        <span className="text-gray-500">Additions</span><span className="text-right text-brand-dark">£{data.additions.toFixed(2)}</span>
        <span className="text-gray-500">Disposals</span><span className="text-right text-brand-dark">−£{data.disposals.toFixed(2)}</span>
        {extraRows.map((r, i) => (
          <Fragment key={i}>
            <span className="text-gray-500">{r.label}</span>
            <span className="text-right text-brand-dark">£{r.value.toFixed(2)}</span>
          </Fragment>
        ))}
        <span className="text-gray-700 font-semibold pt-1 border-t border-gray-100">Carried forward</span>
        <span className="text-right text-brand-dark font-semibold pt-1 border-t border-gray-100">£{data.cf.toFixed(2)}</span>
      </div>
    </div>
  )
}
