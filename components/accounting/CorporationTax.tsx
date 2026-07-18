'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateCorporationTax, ManualAdjustment } from '@/lib/corporationTax'

export default function CorporationTax({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [computations, setComputations] = useState<any[]>([])
  const [capAllowancesPeriods, setCapAllowancesPeriods] = useState<any[]>([])
  const [depreciationPeriods, setDepreciationPeriods] = useState<any[]>([])
  const [associatedCount, setAssociatedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [calculating, setCalculating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [accountingProfit, setAccountingProfit] = useState('')
  const [selectedCapAllowancesId, setSelectedCapAllowancesId] = useState('')
  const [selectedDepreciationId, setSelectedDepreciationId] = useState('')
  const [otherIncome, setOtherIncome] = useState('0')
  const [qualifyingDonations, setQualifyingDonations] = useState('0')
  const [adjustments, setAdjustments] = useState<ManualAdjustment[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [compRes, capRes, depRes, assocRes] = await Promise.all([
      supabase.from('ct600_computations').select('*').eq('client_id', clientId).order('period_end', { ascending: false }),
      supabase.from('capital_allowances_periods').select('*').eq('client_id', clientId).eq('status', 'finalized').order('period_end', { ascending: false }),
      supabase.from('depreciation_periods').select('*').eq('client_id', clientId).order('period_end', { ascending: false }),
      supabase.from('associated_companies').select('id').eq('client_id', clientId).eq('is_active', true),
    ])
    if (compRes.data) setComputations(compRes.data)
    if (capRes.data) setCapAllowancesPeriods(capRes.data)
    if (depRes.data) setDepreciationPeriods(depRes.data)
    if (assocRes.data) setAssociatedCount(assocRes.data.length)
    setLoading(false)
  }

  function openCalculator() {
    setPeriodStart('')
    setPeriodEnd('')
    setAccountingProfit('')
    setSelectedCapAllowancesId('')
    setSelectedDepreciationId('')
    setOtherIncome('0')
    setQualifyingDonations('0')
    setAdjustments([])
    setNotes('')
    setError('')
    setCalculating(true)
  }

  function addAdjustment() {
    setAdjustments((prev) => [...prev, { description: '', amount: 0 }])
  }

  function updateAdjustment(index: number, field: keyof ManualAdjustment, value: string) {
    setAdjustments((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: field === 'amount' ? parseFloat(value) || 0 : value }
      return updated
    })
  }

  function removeAdjustment(index: number) {
    setAdjustments((prev) => prev.filter((_, i) => i !== index))
  }

  function getCapitalAllowancesTotal() {
    const p = capAllowancesPeriods.find((p) => p.id === selectedCapAllowancesId)
    return p ? parseFloat(p.total_allowances) : 0
  }

  function getDepreciationTotal() {
    const p = depreciationPeriods.find((p) => p.id === selectedDepreciationId)
    return p ? parseFloat(p.total_depreciation) : 0
  }

  function computeResult() {
    if (!periodStart || !periodEnd || !accountingProfit) return null
    return calculateCorporationTax({
      accountingProfit: parseFloat(accountingProfit) || 0,
      depreciationAddback: getDepreciationTotal(),
      capitalAllowancesTotal: getCapitalAllowancesTotal(),
      otherIncome: parseFloat(otherIncome) || 0,
      manualAdjustments: adjustments,
      qualifyingDonations: parseFloat(qualifyingDonations) || 0,
      associatedCompaniesCount: associatedCount,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    })
  }

  const result = computeResult()

  function handleSaveClick() {
    if (!periodStart || !periodEnd) { setError('Enter the accounting period dates'); return }
    if (!accountingProfit) { setError('Enter the accounting profit for the period'); return }
    setShowConfirm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const res = computeResult()
    if (!res) { setError('Could not compute a result'); setSaving(false); setShowConfirm(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const { data: saved, error: saveError } = await supabase
      .from('ct600_computations')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        box_145_turnover: 0,
        accounting_profit: parseFloat(accountingProfit) || 0,
        depreciation_addback: getDepreciationTotal(),
        capital_allowances_total: getCapitalAllowancesTotal(),
        box_155_trading_profits: res.box155TradingProfits,
        box_165_net_trading_profits: res.box165NetTradingProfits,
        box_170_interest_income: res.box170Interest,
        box_235_profits_before_deductions: res.box235ProfitsBeforeDeductions,
        box_305_qualifying_donations: res.box305QualifyingDonations,
        box_315_profits_chargeable: res.box315ProfitsChargeable,
        box_326_associated_companies: res.box326AssociatedCompanies,
        box_329_marginal_relief_flag: res.box329MarginalReliefFlag,
        tax_at_main_rate: res.taxAtMainRate,
        box_430_corporation_tax: res.box430CorporationTax,
        box_435_marginal_relief: res.box435MarginalRelief,
        box_440_corporation_tax_chargeable: res.box440CorporationTaxChargeable,
        box_475_net_ct_liability: res.box475NetCtLiability,
        manual_adjustments: adjustments,
        status: 'draft',
        notes: notes || null,
        created_by: user!.id,
      })
      .select()
      .single()

    if (saveError) { setError(saveError.message); setSaving(false); setShowConfirm(false); return }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'ct600_computation',
      p_entity_id: saved.id,
      p_action: 'created',
      p_old_data: null,
      p_new_data: saved,
      p_description: `Corporation Tax computation for period ${periodStart} to ${periodEnd} — £${res.box440CorporationTaxChargeable.toFixed(2)} chargeable`,
    })

    setShowConfirm(false)
    setCalculating(false)
    setSaving(false)
    fetchAll()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Corporation Tax</h3>
        {can.manageEngagements && !calculating && (
          <button onClick={openCalculator} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + New Computation
          </button>
        )}
      </div>

      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          This calculates the core Corporation Tax figure — profit adjustments, capital allowances, associated company thresholds, and marginal relief — structured around the real CT600 box numbers (145–440) for future filing compatibility. It doesn't yet cover losses brought forward, group relief, R&D claims, or other specialist reliefs. Treat this as a strong starting computation to review, not a final filing figure.
        </p>
      </div>

      {calculating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New Computation</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Period Start</label>
              <DatePicker value={periodStart} onChange={setPeriodStart} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Period End</label>
              <DatePicker value={periodEnd} onChange={setPeriodEnd} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Accounting Profit for the Period (£)</label>
            <input type="number" value={accountingProfit} onChange={(e) => setAccountingProfit(e.target.value)} className={inputClass} placeholder="Profit before tax, from the P&L for this period" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Depreciation Period (adds back)</label>
              <select value={selectedDepreciationId} onChange={(e) => setSelectedDepreciationId(e.target.value)} className={inputClass}>
                <option value="">None / manual</option>
                {depreciationPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.period_start).toLocaleDateString('en-GB')} – {new Date(p.period_end).toLocaleDateString('en-GB')} (£{parseFloat(p.total_depreciation).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Capital Allowances Period (deducts)</label>
              <select value={selectedCapAllowancesId} onChange={(e) => setSelectedCapAllowancesId(e.target.value)} className={inputClass}>
                <option value="">None / manual</option>
                {capAllowancesPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.period_start).toLocaleDateString('en-GB')} – {new Date(p.period_end).toLocaleDateString('en-GB')} (£{parseFloat(p.total_allowances).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Other Income (£) — e.g. bank interest</label>
              <input type="number" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qualifying Donations (£) — e.g. Gift Aid</label>
              <input type="number" value={qualifyingDonations} onChange={(e) => setQualifyingDonations(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500">Manual Adjustments (disallowable expenses, etc.)</label>
              <button onClick={addAdjustment} className="text-xs text-brand-dark font-medium hover:underline">+ Add adjustment</button>
            </div>
            {adjustments.map((adj, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={adj.description}
                  onChange={(e) => updateAdjustment(i, 'description', e.target.value)}
                  placeholder="e.g. Client entertaining"
                  className={inputClass}
                />
                <input
                  type="number"
                  value={adj.amount}
                  onChange={(e) => updateAdjustment(i, 'amount', e.target.value)}
                  placeholder="Amount (+ adds back, - deducts)"
                  className={`${inputClass} w-48`}
                />
                <button onClick={() => removeAdjustment(i)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
              </div>
            ))}
          </div>

          {result && (
            <div className="bg-brand-light rounded-xl p-4 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Box 155 — Trading Profits</span><span className="text-brand-dark">£{result.box155TradingProfits.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 170 — Other Income</span><span className="text-brand-dark">£{result.box170Interest.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 235 — Profits Before Deductions</span><span className="text-brand-dark">£{result.box235ProfitsBeforeDeductions.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 305 — Qualifying Donations</span><span className="text-brand-dark">−£{result.box305QualifyingDonations.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold border-t border-gray-200 pt-2"><span className="text-brand-dark">Box 315 — Profits Chargeable to CT</span><span className="text-brand-dark">£{result.box315ProfitsChargeable.toFixed(2)}</span></div>
              </div>
              <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Rate band applied</span><span className="text-brand-dark capitalize">{result.rateApplied.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 326 — Associated Companies</span><span className="text-brand-dark">{result.box326AssociatedCompanies}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Adjusted Lower Limit</span><span className="text-brand-dark">£{result.adjustedLowerLimit.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Adjusted Upper Limit</span><span className="text-brand-dark">£{result.adjustedUpperLimit.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 430 — Corporation Tax</span><span className="text-brand-dark">£{result.box430CorporationTax.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 435 — Marginal Relief</span><span className="text-green-600">−£{result.box435MarginalRelief.toFixed(2)}</span></div>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-brand-dark">Box 440 — Corporation Tax Chargeable</span>
                <span className="text-2xl font-bold text-brand-dark">£{result.box440CorporationTaxChargeable.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 text-right">Effective rate: {(result.effectiveRate * 100).toFixed(2)}%</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSaveClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              Save Computation
            </button>
            <button onClick={() => setCalculating(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Save this computation?"
        message={result ? `Corporation Tax chargeable: £${result.box440CorporationTaxChargeable.toFixed(2)} for the period ${periodStart} to ${periodEnd}.` : ''}
        confirmLabel="Save Computation"
        confirming={saving}
        onConfirm={handleSave}
        onCancel={() => setShowConfirm(false)}
      />

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : computations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No computations yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Profits Chargeable</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">CT Chargeable</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {computations.map((c, i) => (
                  <tr key={c.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-3 text-sm text-brand-dark">
                      {new Date(c.period_start).toLocaleDateString('en-GB')} – {new Date(c.period_end).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">£{parseFloat(c.box_315_profits_chargeable).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(c.box_440_corporation_tax_chargeable).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${c.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
