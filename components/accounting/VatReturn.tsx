'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateVatReturn, calculateVatReturnCashBasis, calculateVatReturnFlatRate, getVatReturnDetail, VatReturnResult, VatReturnDetail } from '@/lib/vatReturn'
import { evaluateCorrectionsForReturn, resolvePendingCorrections, CorrectionEvaluation } from '@/lib/vatErrorCorrection'
import { collectClientFraudPreventionData } from '@/lib/hmrcFraudPreventionClient'

const STAGGER_MONTHS: Record<number, number[]> = {
  1: [2, 5, 8, 11], // Mar, Jun, Sep, Dec (0-indexed)
  2: [1, 4, 7, 10], // Feb, May, Aug, Nov
  3: [0, 3, 6, 9],  // Jan, Apr, Jul, Oct
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function lastDayOfMonth(year: number, month: number): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return formatDate(year, month, daysInMonth)
}

function firstDayOfMonth(year: number, month: number): string {
  return formatDate(year, month, 1)
}

export default function VatReturn({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [returns, setReturns] = useState<any[]>([])
  const [hmrcConnected, setHmrcConnected] = useState(false)
  const [obligations, setObligations] = useState<any[] | null>(null)
  const [loadingObligations, setLoadingObligations] = useState(false)
  const [obligationsError, setObligationsError] = useState('')
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
  const [correctionEval, setCorrectionEval] = useState<CorrectionEvaluation | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [markingFiledId, setMarkingFiledId] = useState<string | null>(null)
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null)

  const [viewingReturn, setViewingReturn] = useState<any | null>(null)
  const [viewTab, setViewTab] = useState<'return' | 'details'>('return')
  const [viewDetail, setViewDetail] = useState<VatReturnDetail | null>(null)
  const [loadingViewDetail, setLoadingViewDetail] = useState(false)

  useEffect(() => { fetchAll() }, [clientId])

  useEffect(() => {
    if (periodStart && periodEnd) fetchLiveCalculation()
  }, [periodStart, periodEnd])

  async function fetchAll() {
    setLoading(true)
    const [returnsRes, settingsRes, connectionRes] = await Promise.all([
      supabase.from('vat_returns').select('*').eq('client_id', clientId).order('period_end', { ascending: false }),
      supabase.from('vat_settings').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('hmrc_connections').select('status').eq('client_id', clientId).eq('status', 'active').maybeSingle(),
    ])
    setReturns(returnsRes.data || [])
    setSettings(settingsRes.data || null)
    setHmrcConnected(!!connectionRes.data)
    setLoading(false)
  }

  async function handleFetchObligations() {
    setLoadingObligations(true)
    setObligationsError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fraudPreventionData = await collectClientFraudPreventionData()
      const res = await fetch('/api/hmrc/obligations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ clientId, fraudPreventionData }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not fetch obligations')
      setObligations(body.obligations)
    } catch (err: any) {
      setObligationsError(err.message)
    } finally {
      setLoadingObligations(false)
    }
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
    const evaluation = await evaluateCorrectionsForReturn(clientId, calc.box6TotalSalesExVat)
    setCorrectionEval(evaluation.netPosition.corrections.length > 0 ? evaluation : null)
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

    if (!lastReturn) {
      // First-ever return: HMRC requires the period to start on the actual
      // registration date, not the 1st of that month - the first period is
      // often a "long" or "short" stub running to the next normal
      // quarter/month end, not a full clean period.
      if (!settings.registration_date) return null
      const regDate = new Date(settings.registration_date)

      if (settings.filing_frequency === 'monthly') {
        return { start: settings.registration_date, end: lastDayOfMonth(regDate.getFullYear(), regDate.getMonth()) }
      }

      if (settings.filing_frequency === 'quarterly' && settings.stagger_group) {
        const staggerMonths = STAGGER_MONTHS[settings.stagger_group]
        let endYear = regDate.getFullYear()
        let endMonth = staggerMonths.find((m) => m >= regDate.getMonth())
        if (endMonth === undefined) { endMonth = staggerMonths[0]; endYear += 1 }
        return { start: settings.registration_date, end: lastDayOfMonth(endYear, endMonth) }
      }

      return null
    }

    // Subsequent returns always start the day after the prior period ended -
    // i.e. the first day of the following month, contiguous with the last filing.
    const priorEnd = new Date(lastReturn.period_end)
    let nextMonth = priorEnd.getMonth() + 1
    let nextYear = priorEnd.getFullYear()
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1 }

    if (settings.filing_frequency === 'monthly') {
      return { start: firstDayOfMonth(nextYear, nextMonth), end: lastDayOfMonth(nextYear, nextMonth) }
    }

    if (settings.filing_frequency === 'quarterly' && settings.stagger_group) {
      let endMonth = nextMonth + 2
      let endYear = nextYear
      if (endMonth > 11) { endMonth -= 12; endYear += 1 }
      return { start: firstDayOfMonth(nextYear, nextMonth), end: lastDayOfMonth(endYear, endMonth) }
    }

    return null
  }

  function openCalculator() {
    const suggested = suggestNextPeriod()
    setEditingReturnId(null)
    setPeriodStart(suggested?.start || '')
    setPeriodEnd(suggested?.end || '')
    setResult(null)
    setCorrectionEval(null)
    setBox2('0')
    setBox8('0')
    setBox9('0')
    setNotes('')
    setError('')
    setCalcTab('return')
    setDetail(null)
    setCalculating(true)
  }

  function openEditReturn(r: any) {
    setViewingReturn(null)
    setEditingReturnId(r.id)
    setResult(null)
    setCorrectionEval(null)
    setBox2(String(r.box2_vat_on_eu_acquisitions ?? 0))
    setBox8(String(r.box8_eu_goods_supplied ?? 0))
    setBox9(String(r.box9_eu_goods_acquired ?? 0))
    setNotes(r.notes || '')
    setError('')
    setCalcTab('return')
    setDetail(null)
    setCalculating(true)
    // periodStart/periodEnd set last so the useEffect fires the recalculation
    // against CURRENT transaction data, not whatever was true when first saved
    setPeriodStart(r.period_start)
    setPeriodEnd(r.period_end)
  }

  async function openViewReturn(r: any) {
    setCalculating(false)
    setViewingReturn(r)
    setViewTab('return')
    setViewDetail(null)
  }

  async function handleViewDetailsTab() {
    setViewTab('details')
    if (viewDetail || !viewingReturn) return
    setLoadingViewDetail(true)
    const d = await getVatReturnDetail(clientId, viewingReturn.period_start, viewingReturn.period_end, settings?.scheme || 'standard')
    setViewDetail(d)
    setLoadingViewDetail(false)
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

    const correctionsApplied = correctionEval?.withinThreshold ?? false
    const box1Adj = correctionsApplied ? correctionEval!.box1Adjustment : 0
    const box4Adj = correctionsApplied ? correctionEval!.box4Adjustment : 0

    const box1Total = result.box1VatOnSales + box1Adj
    const box4Total = result.box4VatReclaimed + box4Adj
    const box2Val = parseFloat(box2) || 0
    const box3 = box1Total + box2Val
    const box5 = box3 - box4Total

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      box1_vat_on_sales: box1Total,
      box2_vat_on_eu_acquisitions: box2Val,
      box3_total_vat_due: box3,
      box4_vat_reclaimed: box4Total,
      box5_net_vat: box5,
      box6_total_sales_ex_vat: result.box6TotalSalesExVat,
      box7_total_purchases_ex_vat: result.box7TotalPurchasesExVat,
      box8_eu_goods_supplied: parseFloat(box8) || 0,
      box9_eu_goods_acquired: parseFloat(box9) || 0,
      notes: notes || null,
    }

    let saved: any, saveError: any

    if (editingReturnId) {
      // Re-editing a draft: release any corrections that were tied to this
      // return on a previous save, so they get freshly re-evaluated against
      // the new calculation rather than double-counted or left stale.
      await supabase
        .from('vat_error_corrections')
        .update({ status: 'pending', applied_to_return_id: null, applied_date: null, threshold_at_evaluation: null, net_position_at_evaluation: null })
        .eq('applied_to_return_id', editingReturnId)

      const { data, error: updateError } = await supabase
        .from('vat_returns')
        .update(payload)
        .eq('id', editingReturnId)
        .select()
        .single()
      saved = data
      saveError = updateError
    } else {
      const { data, error: insertError } = await supabase
        .from('vat_returns')
        .insert({ ...payload, status: 'draft', created_by: user!.id })
        .select()
        .single()
      saved = data
      saveError = insertError
    }

    if (saveError) { setError(saveError.message); setSaving(false); setShowConfirm(false); return }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'vat_return',
      p_entity_id: saved.id,
      p_action: editingReturnId ? 'updated' : 'created',
      p_old_data: null,
      p_new_data: saved,
      p_description: `VAT Return for period ${periodStart} to ${periodEnd} — net ${box5 >= 0 ? 'payable' : 'reclaimable'} £${Math.abs(box5).toFixed(2)}`,
    })

    if (correctionEval && correctionEval.netPosition.corrections.length > 0) {
      await resolvePendingCorrections(clientId, saved.id, correctionEval)
    }

    setShowConfirm(false)
    setCalculating(false)
    setEditingReturnId(null)
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
  const correctionsApplied = correctionEval?.withinThreshold ?? false
  const box1Adj = correctionsApplied ? correctionEval!.box1Adjustment : 0
  const box4Adj = correctionsApplied ? correctionEval!.box4Adjustment : 0
  const box1Display = result ? result.box1VatOnSales + box1Adj : 0
  const box4Display = result ? result.box4VatReclaimed + box4Adj : 0
  const netVat = result ? box1Display + box2Val - box4Display : 0

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

  function renderTransactionDetail(d: VatReturnDetail | null, isLoading: boolean) {
    if (isLoading) return <p className="text-xs text-gray-400">Loading underlying transactions...</p>
    if (!d) return null
    return (
      <>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">
              Sales — feeds Box 1 (VAT) and Box 6 ({settings?.scheme === 'flat_rate' ? 'gross' : 'net'} value)
            </p>
            <p className="text-xs text-gray-400">{d.salesTransactions.length} line(s)</p>
          </div>
          {d.box1IsCalculated && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
              Box 1 under Flat Rate is calculated as gross turnover × your rate — it isn't a sum of these lines' own VAT amounts, since that's not how this scheme works.
            </p>
          )}
          {d.salesTransactions.length === 0 ? (
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
                  {d.salesTransactions.map((t, i) => (
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
                    <td className="px-3 py-2 text-right text-brand-dark">£{d.salesTransactions.reduce((s, t) => s + t.netAmount, 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-brand-dark">£{d.salesTransactions.reduce((s, t) => s + t.vatAmount, 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Purchases — feeds Box 4 (VAT) and Box 7 (net value)</p>
            <p className="text-xs text-gray-400">{d.purchaseTransactions.length} line(s)</p>
          </div>
          {settings?.scheme === 'flat_rate' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
              Only capital purchases over £2,000 (including VAT) are shown — under Flat Rate, everything else isn't reclaimable.
            </p>
          )}
          {d.purchaseTransactions.length === 0 ? (
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
                  {d.purchaseTransactions.map((t, i) => (
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
                    <td className="px-3 py-2 text-right text-brand-dark">£{d.purchaseTransactions.reduce((s, t) => s + t.netAmount, 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-brand-dark">£{d.purchaseTransactions.reduce((s, t) => s + t.vatAmount, 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      {hmrcConnected && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-dark">HMRC Obligations</p>
              <p className="text-xs text-gray-400 mt-0.5">What HMRC's own records say is due for this client</p>
            </div>
            <button
              onClick={handleFetchObligations}
              disabled={loadingObligations}
              className="bg-white border border-gray-200 text-brand-dark font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              {loadingObligations ? 'Fetching...' : 'Fetch from HMRC'}
            </button>
          </div>

          {obligationsError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mt-3">{obligationsError}</div>
          )}

          {obligations && (
            obligations.length === 0 ? (
              <p className="text-sm text-gray-400 mt-3">No open obligations — HMRC shows this client up to date.</p>
            ) : (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 font-semibold text-gray-500 text-xs">Period</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-500 text-xs">Due Date</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-500 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obligations.map((o, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-brand-dark">
                          {new Date(o.start).toLocaleDateString('en-GB')} – {new Date(o.end).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-4 py-2 text-brand-dark">{new Date(o.due).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'O' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {o.status === 'O' ? 'Open' : 'Fulfilled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

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
              <p className="text-white/60 text-xs uppercase tracking-wider">{editingReturnId ? 'Editing Draft VAT Return' : 'VAT Return'}</p>
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

                {correctionEval && (
                  correctionEval.withinThreshold ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
                      <p>
                        {correctionEval.netPosition.corrections.length} pending error correction{correctionEval.netPosition.corrections.length !== 1 ? 's' : ''} folded into Box {box1Adj !== 0 ? '1' : ''}{box1Adj !== 0 && box4Adj !== 0 ? ' / ' : ''}{box4Adj !== 0 ? '4' : ''} above.
                      </p>
                      <p className="text-xs text-green-700">
                        Net £{correctionEval.netPosition.netAmountAbs.toFixed(2)} vs disclosure threshold £{correctionEval.threshold.toFixed(2)} for this period — within limit, no separate HMRC notification required.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                      <p className="font-semibold">
                        Pending error corrections exceed the disclosure threshold — NOT included in this return.
                      </p>
                      <p className="text-xs">
                        Net £{correctionEval.netPosition.netAmountAbs.toFixed(2)} vs threshold £{correctionEval.threshold.toFixed(2)} for this period. These must be reported to HMRC separately (form VAT652) rather than adjusted here — see the Error Corrections tab.
                      </p>
                    </div>
                  )
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
                    {formBox(1, 'VAT due on sales and other outputs', box1Display.toFixed(2))}
                    {formBox(2, 'VAT due on acquisitions from EU member states (NI only)', box2, { editable: true, onChange: setBox2 })}
                    {formBox(3, 'Total VAT due (Box 1 + Box 2)', (box1Display + box2Val).toFixed(2), { bold: true })}
                    {formBox(4, 'VAT reclaimed on purchases', box4Display.toFixed(2))}
                    {formBox(5, `Net VAT ${netVat >= 0 ? 'to pay' : 'to reclaim'}`, Math.abs(netVat).toFixed(2), { bold: true })}
                    {formBox(6, settings?.scheme === 'flat_rate' ? 'Total sales, INCLUDING VAT (Flat Rate uses gross turnover here)' : 'Total value of sales, excluding VAT', result.box6TotalSalesExVat.toFixed(2))}
                    {formBox(7, 'Total value of purchases, excluding VAT', result.box7TotalPurchasesExVat.toFixed(2))}
                    {formBox(8, 'Total value of goods supplied to EU (NI only)', box8, { editable: true, onChange: setBox8 })}
                    {formBox(9, 'Total value of goods acquired from EU (NI only)', box9, { editable: true, onChange: setBox9 })}
                  </div>
                )}

                {calcTab === 'details' && (
                  <div className="space-y-6">
                    {renderTransactionDetail(detail, loadingDetail)}
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
                {editingReturnId ? 'Update Draft' : 'Save VAT Return'}
              </button>
              <button onClick={() => { setCalculating(false); setEditingReturnId(null) }} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingReturn && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-brand-dark px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider capitalize">{viewingReturn.status} VAT Return</p>
              <h3 className="text-white text-lg font-semibold">
                {new Date(viewingReturn.period_start).toLocaleDateString('en-GB')} – {new Date(viewingReturn.period_end).toLocaleDateString('en-GB')}
              </h3>
            </div>
            <button onClick={() => setViewingReturn(null)} className="text-white/70 hover:text-white text-sm">✕ Close</button>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setViewTab('return')}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${viewTab === 'return' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
              >
                View Return
              </button>
              <button
                onClick={handleViewDetailsTab}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${viewTab === 'details' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
              >
                View Details
              </button>
            </div>

            {viewTab === 'return' && (
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {formBox(1, 'VAT due on sales and other outputs', parseFloat(viewingReturn.box1_vat_on_sales).toFixed(2))}
                {formBox(2, 'VAT due on acquisitions from EU member states (NI only)', parseFloat(viewingReturn.box2_vat_on_eu_acquisitions).toFixed(2))}
                {formBox(3, 'Total VAT due (Box 1 + Box 2)', parseFloat(viewingReturn.box3_total_vat_due).toFixed(2), { bold: true })}
                {formBox(4, 'VAT reclaimed on purchases', parseFloat(viewingReturn.box4_vat_reclaimed).toFixed(2))}
                {formBox(5, `Net VAT ${parseFloat(viewingReturn.box5_net_vat) >= 0 ? 'to pay' : 'to reclaim'}`, Math.abs(parseFloat(viewingReturn.box5_net_vat)).toFixed(2), { bold: true })}
                {formBox(6, settings?.scheme === 'flat_rate' ? 'Total sales, INCLUDING VAT (Flat Rate uses gross turnover here)' : 'Total value of sales, excluding VAT', parseFloat(viewingReturn.box6_total_sales_ex_vat).toFixed(2))}
                {formBox(7, 'Total value of purchases, excluding VAT', parseFloat(viewingReturn.box7_total_purchases_ex_vat).toFixed(2))}
                {formBox(8, 'Total value of goods supplied to EU (NI only)', parseFloat(viewingReturn.box8_eu_goods_supplied).toFixed(2))}
                {formBox(9, 'Total value of goods acquired from EU (NI only)', parseFloat(viewingReturn.box9_eu_goods_acquired).toFixed(2))}
              </div>
            )}

            {viewTab === 'details' && (
              <div className="space-y-6">
                {renderTransactionDetail(viewDetail, loadingViewDetail)}
              </div>
            )}

            {viewingReturn.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{viewingReturn.notes}</p>
              </div>
            )}

            {viewingReturn.status === 'draft' && can.manageEngagements && (
              <button onClick={() => openEditReturn(viewingReturn)} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
                Edit Draft
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title={editingReturnId ? 'Update this draft?' : 'Save this VAT Return?'}
        message={result ? `Net VAT ${netVat >= 0 ? 'to pay' : 'to reclaim'}: £${Math.abs(netVat).toFixed(2)} for the period ${periodStart} to ${periodEnd}.` : ''}
        confirmLabel={editingReturnId ? 'Update Draft' : 'Save VAT Return'}
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
                  <tr
                    key={r.id}
                    onClick={() => openViewReturn(r)}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-brand-light/40 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
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
                      <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        {can.manageEngagements && r.status === 'draft' && (
                          <button
                            onClick={() => openEditReturn(r)}
                            className="text-xs bg-white border border-gray-200 text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                          >
                            Edit
                          </button>
                        )}
                        {can.manageEngagements && r.status === 'draft' && (
                          <button
                            onClick={() => handleMarkFiled(r)}
                            disabled={markingFiledId === r.id}
                            className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                          >
                            {markingFiledId === r.id ? 'Marking...' : 'Mark as Filed'}
                          </button>
                        )}
                      </div>
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
