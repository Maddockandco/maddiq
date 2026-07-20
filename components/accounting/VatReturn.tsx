'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateVatReturn, calculateVatReturnCashBasis, calculateVatReturnFlatRate, getVatReturnDetail, VatReturnResult, VatReturnDetail } from '@/lib/vatReturn'

const STAGGER_MONTHS: Record<number, number[]> = {
  1: [2, 5, 8, 11], // Mar, Jun, Sep, Dec (0-indexed)
  2: [1, 4, 7, 10], // Feb, May, Aug, Nov
  3: [0, 3, 6, 9],  // Jan, Apr, Jul, Oct
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month + 1, 0).toISOString().split('T')[0]
}

function firstDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 1).toISOString().split('T')[0]
}

export default function VatReturn({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [returns, setReturns] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [result, setResult] = useState<VatReturnResult | null>(null)
  const [calculatingResult, setCalculatingResult] = useState(false)
  const [calcTab, setCalcTab] = useState<'return' | 'details'>('return')
  const [detail, setDetail] = useState<VatReturnDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [box2, setBox2] = useState('0')
  const [box8, setBox8] = useState('0')
  const [box9, setBox9] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [markingFiledId, setMarkingFiledId] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [clientId])

  useEffect(() => {
    if (periodStart && periodEnd) fetchLiveCalculation()
  }, [periodStart, periodEnd])

  async function fetchAll() {
    setLoading(true)
    const [returnsRes, settingsRes] = await Promise.all([
      supabase.from('vat_returns').select('*').eq('client_id', clientId).order('period_end', { ascending: false }),
      supabase.from('vat_settings').select('*').eq('client_id', clientId).maybeSingle(),
    ])
    setReturns(returnsRes.data || [])
    setSettings(settingsRes.data || null)
    setLoading(false)
  }

  async function fetchLiveCalculation() {
    setCalculatingResult(true)
    setDetail(null)
    let calc: VatReturnResult
    if (settings?.scheme === 'cash_accounting') {
      calc = await calculateVatReturnCashBasis(clientId, periodStart, periodEnd)
    } else if (settings?.scheme === 'flat_rate') {
      calc = await calculateVatReturnFlatRate(clientId, periodStart, periodEnd, {
        sector: settings?.flat_rate_sector || null,
        registrationDate: settings?.registration_date || null,
        lctOverride: settings?.lct_override || 'auto',
      })
    } else {
      calc = await calculateVatReturn(clientId, periodStart, periodEnd)
    }
    setResult(calc)
    setCalculatingResult(false)
  }

  async function handleViewDetails() {
    setCalcTab('details')
    if (detail) return // already fetched for this period - no need to refetch on every tab click
    setLoadingDetail(true)
    const d = await getVatReturnDetail(clientId, periodStart, periodEnd, settings?.scheme || 'standard')
    setDetail(d)
    setLoadingDetail(false)
  }

  function suggestNextPeriod(): { start: string; end: string } | null {
    if (!settings) return null
    const lastReturn = returns[0]
    const anchorDate = lastReturn ? new Date(lastReturn.period_end) : settings.registration_date ? new Date(settings.registration_date) : null
    if (!anchorDate) return null

    if (settings.filing_frequency === 'monthly') {
      const next = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + (lastReturn ? 1 : 0), 1)
      return { start: firstDayOfMonth(next.getFullYear(), next.getMonth()), end: lastDayOfMonth(next.getFullYear(), next.getMonth()) }
    }

    if (settings.filing_frequency === 'quarterly' && settings.stagger_group) {
      const staggerMonths = STAGGER_MONTHS[settings.stagger_group]
      let year = anchorDate.getFullYear()
      let monthIdx = staggerMonths.findIndex((m) => m >= anchorDate.getMonth())
      if (lastReturn || monthIdx === -1) {
        monthIdx += 1
      }
      if (monthIdx >= staggerMonths.length) { monthIdx = 0; year += 1 }
      const endMonth = staggerMonths[monthIdx]
      const startMonth = endMonth - 2 < 0 ? endMonth + 10 : endMonth - 2
      const startYear = endMonth - 2 < 0 ? year - 1 : year
      return { start: firstDayOfMonth(startYear, startMonth), end: lastDayOfMonth(year, endMonth) }
    }

    return null
  }

  function openCalculator() {
    const suggested = suggestNextPeriod()
    setPeriodStart(suggested?.start || '')
    setPeriodEnd(suggested?.end || '')
    setResult(null)
    setBox2('0')
    setBox8('0')
    setBox9('0')
    setNotes('')
    setError('')
    setCalcTab('return')
    setDetail(null)
    setCalculating(true)
  }

  function handleSaveClick() {
    if (!periodStart || !periodEnd) { setError('Enter the VAT period dates'); return }
    if (!result) { setError('Waiting for the calculation to finish'); return }
    setShowConfirm(true)
  }

  async function handleSave() {
    if (!result) return
    setSaving(true)
    setError('')

    const box2Val = parseFloat(box2) || 0
    const box3 = result.box1VatOnSales + box2Val
    const box5 = box3 - result.box4VatReclaimed

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const { data: saved, error: saveError } = await supabase
      .from('vat_returns')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        box1_vat_on_sales: result.box1VatOnSales,
        box2_vat_on_eu_acquisitions: box2Val,
        box3_total_vat_due: box3,
        box4_vat_reclaimed: result.box4VatReclaimed,
        box5_net_vat: box5,
        box6_total_sales_ex_vat: result.box6TotalSalesExVat,
        box7_total_purchases_ex_vat: result.box7TotalPurchasesExVat,
        box8_eu_goods_supplied: parseFloat(box8) || 0,
        box9_eu_goods_acquired: parseFloat(box9) || 0,
        status: 'draft',
        notes: notes || null,
        created_by: user!.id,
      })
      .select()
      .single()

    if (saveError) { setError(saveError.message); setSaving(false); setShowConfirm(false); return }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'vat_return',
      p_entity_id: saved.id,
      p_action: 'created',
      p_old_data: null,
      p_new_data: saved,
      p_description: `VAT Return for period ${periodStart} to ${periodEnd} — net ${box5 >= 0 ? 'payable' : 'reclaimable'} £${Math.abs(box5).toFixed(2)}`,
    })

    setShowConfirm(false)
    setCalculating(false)
    setSaving(false)
    fetchAll()
  }

  async function handleMarkFiled(vatReturn: any) {
    setMarkingFiledId(vatReturn.id)
    const filedDate = new Date().toISOString().split('T')[0]
    await supabase.from('vat_returns').update({ status: 'filed', filed_date: filedDate }).eq('id', vatReturn.id)

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'vat_return',
      p_entity_id: vatReturn.id,
      p_action: 'filed',
      p_old_data: { status: 'draft' },
      p_new_data: { status: 'filed', filed_date: filedDate },
      p_description: `Marked VAT Return as filed for period ${vatReturn.period_start} to ${vatReturn.period_end}`,
    })

    setMarkingFiledId(null)
    fetchAll()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const box2Val = parseFloat(box2) || 0
  const netVat = result ? result.box1VatOnSales + box2Val - result.box4VatReclaimed : 0

  function formBox(number: number, label: string, value: string, options?: { editable?: boolean; onChange?: (v: string) => void; bold?: boolean }) {
    return (
      <div className={`flex items-center justify-between px-5 py-3.5 ${options?.bold ? 'bg-brand-light' : ''}`}>
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-bold text-white bg-brand-dark rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{number}</span>
          <span className={`text-sm ${options?.bold ? 'font-semibold text-brand-dark' : 'text-gray-600'}`}>{label}</span>
        </div>
        {options?.editable ? (
          <input
            type="number"
            value={value}
            onChange={(e) => options.onChange?.(e.target.value)}
            className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        ) : (
          <span className={`text-sm font-mono ${options?.bold ? 'font-bold text-brand-dark text-base' : 'text-brand-dark'}`}>£{value}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">VAT Returns</h3>
        {can.manageEngagements && !calculating && (
          <button onClick={openCalculator} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + New VAT Return
          </button>
        )}
      </div>

      {!settings && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">No VAT Setup found for this client yet — set up their VAT scheme and filing frequency first so periods can be suggested automatically.</p>
        </div>
      )}

      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          Calculated on a standard (accrual) VAT accounting basis, using invoice/bill dates. Boxes 2, 8, and 9 relate to Northern Ireland EU goods movements and are left for manual entry. Reverse charge lines are flagged for manual review, not automated. Not yet connected to HMRC for filing — that's a separate, upcoming piece.
        </p>
      </div>

      {calculating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-brand-dark px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">VAT Return</p>
              <h3 className="text-white text-lg font-semibold">
                {periodStart && periodEnd ? `${new Date(periodStart).toLocaleDateString('en-GB')} – ${new Date(periodEnd).toLocaleDateString('en-GB')}` : 'New Period'}
              </h3>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-white/10 text-white capitalize">
              {settings?.scheme ? settings.scheme.replace('_', ' ') : 'Standard'} Scheme
            </span>
          </div>

          <div className="p-6 space-y-4">
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

            {calculatingResult && <p className="text-xs text-gray-400">Calculating from invoices and bills for this period...</p>}

            {result && !calculatingResult && (
              <>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setCalcTab('return')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${calcTab === 'return' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
                  >
                    View Return
                  </button>
                  <button
                    onClick={handleViewDetails}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${calcTab === 'details' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
                  >
                    View Details
                  </button>
                </div>

                {settings?.scheme === 'flat_rate' && 'appliedPercentage' in result && (
                  <div className="bg-brand-light rounded-xl p-4 text-sm text-brand-dark space-y-1">
                    <p>
                      Rate applied this period: <span className="font-bold">{(result as any).appliedPercentage}%</span>
                      {' — '}
                      {(result as any).isLimitedCostTrader ? 'Limited Cost Trader rate (automatic)' : 'sector rate (automatic)'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qualifying goods spend this period: £{(result as any).lctDetail.qualifyingGoodsSpend.toFixed(2)} vs threshold £{(result as any).lctDetail.threshold.toFixed(2)}
                      {settings?.lct_override && settings.lct_override !== 'auto' && ' — manually overridden in VAT Setup'}
                    </p>
                  </div>
                )}

                {calcTab === 'return' && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {result.reverseChargeLinesFound > 0 && (
                      <div className="bg-amber-100 px-5 py-2.5">
                        <p className="text-xs text-amber-800">
                          ⚠ {result.reverseChargeLinesFound} line(s) this period use a reverse charge VAT code — review manually before filing.
                        </p>
                      </div>
                    )}
                    {formBox(1, 'VAT due on sales and other outputs', result.box1VatOnSales.toFixed(2))}
                    {formBox(2, 'VAT due on acquisitions from EU member states (NI only)', box2, { editable: true, onChange: setBox2 })}
                    {formBox(3, 'Total VAT due (Box 1 + Box 2)', (result.box1VatOnSales + box2Val).toFixed(2), { bold: true })}
                    {formBox(4, 'VAT reclaimed on purchases', result.box4VatReclaimed.toFixed(2))}
                    {formBox(5, `Net VAT ${netVat >= 0 ? 'to pay' : 'to reclaim'}`, Math.abs(netVat).toFixed(2), { bold: true })}
                    {formBox(6, settings?.scheme === 'flat_rate' ? 'Total sales, INCLUDING VAT (Flat Rate uses gross turnover here)' : 'Total value of sales, excluding VAT', result.box6TotalSalesExVat.toFixed(2))}
                    {formBox(7, 'Total value of purchases, excluding VAT', result.box7TotalPurchasesExVat.toFixed(2))}
                    {formBox(8, 'Total value of goods supplied to EU (NI only)', box8, { editable: true, onChange: setBox8 })}
                    {formBox(9, 'Total value of goods acquired from EU (NI only)', box9, { editable: true, onChange: setBox9 })}
                  </div>
                )}

                {calcTab === 'details' && (
                  <div className="space-y-6">
                    {loadingDetail ? (
                      <p className="text-xs text-gray-400">Loading underlying transactions...</p>
                    ) : detail ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">
                              Sales — feeds Box 1 (VAT) and Box 6 ({settings?.scheme === 'flat_rate' ? 'gross' : 'net'} value)
                            </p>
                            <p className="text-xs text-gray-400">{detail.salesTransactions.length} line(s)</p>
                          </div>
                          {detail.box1IsCalculated && (
                            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                              Box 1 under Flat Rate is calculated as gross turnover × your rate — it isn't a sum of these lines' own VAT amounts, since that's not how this scheme works.
                            </p>
                          )}
                          {detail.salesTransactions.length === 0 ? (
                            <p className="text-xs text-gray-400">No sales lines in this period</p>
                          ) : (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Date</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Reference</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Customer</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Net</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">VAT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.salesTransactions.map((t, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="px-3 py-1.5 text-gray-500">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                                      <td className="px-3 py-1.5 text-brand-dark font-mono">{t.reference}</td>
                                      <td className="px-3 py-1.5 text-brand-dark">{t.contactName}</td>
                                      <td className="px-3 py-1.5 text-right text-brand-dark">£{t.netAmount.toFixed(2)}</td>
                                      <td className="px-3 py-1.5 text-right text-brand-dark">£{t.vatAmount.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                                    <td colSpan={3} className="px-3 py-2 text-gray-500">Total</td>
                                    <td className="px-3 py-2 text-right text-brand-dark">£{detail.salesTransactions.reduce((s, t) => s + t.netAmount, 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right text-brand-dark">£{detail.salesTransactions.reduce((s, t) => s + t.vatAmount, 0).toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Purchases — feeds Box 4 (VAT) and Box 7 (net value)</p>
                            <p className="text-xs text-gray-400">{detail.purchaseTransactions.length} line(s)</p>
                          </div>
                          {settings?.scheme === 'flat_rate' && (
                            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                              Only capital purchases over £2,000 (including VAT) are shown — under Flat Rate, everything else isn't reclaimable.
                            </p>
                          )}
                          {detail.purchaseTransactions.length === 0 ? (
                            <p className="text-xs text-gray-400">No purchase lines in this period</p>
                          ) : (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Date</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Reference</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Supplier</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Net</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-500">VAT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.purchaseTransactions.map((t, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="px-3 py-1.5 text-gray-500">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                                      <td className="px-3 py-1.5 text-brand-dark font-mono">{t.reference}</td>
                                      <td className="px-3 py-1.5 text-brand-dark">{t.contactName}</td>
                                      <td className="px-3 py-1.5 text-right text-brand-dark">£{t.netAmount.toFixed(2)}</td>
                                      <td className="px-3 py-1.5 text-right text-brand-dark">£{t.vatAmount.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                                    <td colSpan={3} className="px-3 py-2 text-gray-500">Total</td>
                                    <td className="px-3 py-2 text-right text-brand-dark">£{detail.purchaseTransactions.reduce((s, t) => s + t.netAmount, 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right text-brand-dark">£{detail.purchaseTransactions.reduce((s, t) => s + t.vatAmount, 0).toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSaveClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
                Save VAT Return
              </button>
              <button onClick={() => setCalculating(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Save this VAT Return?"
        message={result ? `Net VAT ${netVat >= 0 ? 'to pay' : 'to reclaim'}: £${Math.abs(netVat).toFixed(2)} for the period ${periodStart} to ${periodEnd}.` : ''}
        confirmLabel="Save VAT Return"
        confirming={saving}
        onConfirm={handleSave}
        onCancel={() => setShowConfirm(false)}
      />

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No VAT Returns yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Box 5 (Net VAT)</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-3 text-sm text-brand-dark">
                      {new Date(r.period_start).toLocaleDateString('en-GB')} – {new Date(r.period_end).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-brand-dark">
                      £{Math.abs(parseFloat(r.box5_net_vat)).toFixed(2)} {parseFloat(r.box5_net_vat) >= 0 ? 'to pay' : 'to reclaim'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${r.status === 'filed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {can.manageEngagements && r.status === 'draft' && (
                        <button
                          onClick={() => handleMarkFiled(r)}
                          disabled={markingFiledId === r.id}
                          className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                        >
                          {markingFiledId === r.id ? 'Marking...' : 'Mark as Filed'}
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
