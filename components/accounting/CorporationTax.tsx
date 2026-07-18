'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateCorporationTax, ManualAdjustment } from '@/lib/corporationTax'
import { getAccountingProfit, AccountingProfitResult } from '@/lib/accountingProfit'

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
  const [profitResult, setProfitResult] = useState<AccountingProfitResult | null>(null)
  const [fetchingProfit, setFetchingProfit] = useState(false)
  const [selectedCapAllowancesId, setSelectedCapAllowancesId] = useState('')
  const [otherIncomeOverride, setOtherIncomeOverride] = useState('')
  const [qualifyingDonations, setQualifyingDonations] = useState('0')
  const [adjustments, setAdjustments] = useState<ManualAdjustment[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [finalizingId, setFinalizingId] = useState<string | null>(null)
  const [ctAccountId, setCtAccountId] = useState('')
  const [ctPayableAccountId, setCtPayableAccountId] = useState('')

  useEffect(() => { fetchAll() }, [clientId])

  useEffect(() => {
    if (periodStart && periodEnd) fetchProfit()
  }, [periodStart, periodEnd])

  async function fetchProfit() {
    setFetchingProfit(true)
    const result = await getAccountingProfit(clientId, periodStart, periodEnd)
    setProfitResult(result)
    setFetchingProfit(false)
  }

  async function fetchAll() {
    setLoading(true)
    const [compRes, capRes, assocRes, accRes] = await Promise.all([
      supabase.from('ct600_computations').select('*').eq('client_id', clientId).order('period_end', { ascending: false }),
      supabase.from('capital_allowances_periods').select('*').eq('client_id', clientId).eq('status', 'finalized').order('period_end', { ascending: false }),
      supabase.from('associated_companies').select('id').eq('client_id', clientId).eq('is_active', true),
      supabase.from('chart_of_accounts').select('id, name').eq('client_id', clientId).eq('is_active', true).in('name', ['Corporation Tax', 'Corporation Tax Payable']),
    ])
    if (compRes.data) setComputations(compRes.data)
    if (capRes.data) setCapAllowancesPeriods(capRes.data)
    if (assocRes.data) setAssociatedCount(assocRes.data.length)
    if (accRes.data) {
      setCtAccountId(accRes.data.find((a) => a.name === 'Corporation Tax')?.id || '')
      setCtPayableAccountId(accRes.data.find((a) => a.name === 'Corporation Tax Payable')?.id || '')
    }
    setLoading(false)
  }

  function openCalculator() {
    setPeriodStart('')
    setPeriodEnd('')
    setProfitResult(null)
    setSelectedCapAllowancesId('')
    setOtherIncomeOverride('')
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

  function computeResult() {
    if (!periodStart || !periodEnd || !profitResult) return null
    const otherIncome = otherIncomeOverride !== '' ? parseFloat(otherIncomeOverride) || 0 : profitResult.otherIncome
    return calculateCorporationTax({
      accountingProfit: profitResult.accountingProfit,
      depreciationAddback: profitResult.depreciationTotal,
      capitalAllowancesTotal: getCapitalAllowancesTotal(),
      otherIncome,
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
    if (!profitResult) { setError('Could not pull accounting profit for this period - check the dates'); return }
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
        accounting_profit: profitResult?.accountingProfit || 0,
        depreciation_addback: profitResult?.depreciationTotal || 0,
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

  async function handleFinalize(computation: any) {
    if (!ctAccountId || !ctPayableAccountId) {
      setError('Corporation Tax and Corporation Tax Payable accounts not found in Chart of Accounts')
      return
    }
    setFinalizingId(computation.id)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setFinalizingId(null); return }

    const amount = parseFloat(computation.box_440_corporation_tax_chargeable)

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: computation.period_end,
        reference: 'CT600',
        description: `Corporation Tax charge for period ${computation.period_start} to ${computation.period_end}`,
        source: 'corporation_tax',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) { setError(entryError.message); setFinalizingId(null); return }

    await supabase.from('journal_lines').insert([
      { journal_entry_id: entry.id, account_id: ctAccountId, debit: amount, credit: 0, description: 'Corporation Tax charge', sort_order: 0 },
      { journal_entry_id: entry.id, account_id: ctPayableAccountId, debit: 0, credit: amount, description: 'Corporation Tax charge', sort_order: 1 },
    ])

    const { data: after } = await supabase
      .from('ct600_computations')
      .update({ status: 'finalized', journal_entry_id: entry.id })
      .eq('id', computation.id)
      .select()
      .single()

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'ct600_computation',
      p_entity_id: computation.id,
      p_action: 'finalized',
      p_old_data: { status: 'draft' },
      p_new_data: { status: 'finalized' },
      p_description: `Finalized Corporation Tax computation and posted £${amount.toFixed(2)} to the ledger`,
    })

    setFinalizingId(null)
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

          {fetchingProfit && <p className="text-xs text-gray-400">Pulling accounting profit from the ledger for this period...</p>}

          {profitResult && !fetchingProfit && (
            <div className="bg-brand-light rounded-xl p-4 space-y-1 text-sm">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Pulled automatically from the P&L for this period</p>
              <div className="flex justify-between"><span className="text-gray-500">Turnover</span><span className="text-brand-dark">£{profitResult.turnover.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Gross Profit</span><span className="text-brand-dark">£{profitResult.grossProfit.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Operating Profit</span><span className="text-brand-dark">£{profitResult.operatingProfit.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Depreciation charged (add-back)</span><span className="text-brand-dark">£{profitResult.depreciationTotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1"><span className="text-brand-dark">Accounting Profit (Profit Before Tax)</span><span className="text-brand-dark">£{profitResult.accountingProfit.toFixed(2)}</span></div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Capital Allowances Period (deducts)</label>
            <select value={selectedCapAllowancesId} onChange={(e) => setSelectedCapAllowancesId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {capAllowancesPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {new Date(p.period_start).toLocaleDateString('en-GB')} – {new Date(p.period_end).toLocaleDateString('en-GB')} (£{parseFloat(p.total_allowances).toFixed(2)})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Capital allowances are tax-only and never posted to the ledger, so this can't be auto-pulled - select the matching finalized period.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Other Income Override (£) {profitResult && `— auto-detected: £${profitResult.otherIncome.toFixed(2)}`}
              </label>
              <input type="number" value={otherIncomeOverride} onChange={(e) => setOtherIncomeOverride(e.target.value)} className={inputClass} placeholder="Leave blank to use the auto-detected figure" />
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
                  <th></th>
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
                    <td className="px-6 py-3 text-right">
                      {can.manageEngagements && c.status === 'draft' && (
                        <button
                          onClick={() => handleFinalize(c)}
                          disabled={finalizingId === c.id}
                          className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                        >
                          {finalizingId === c.id ? 'Posting...' : 'Finalize & Post to Ledger'}
                        </button>
                      )}
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
