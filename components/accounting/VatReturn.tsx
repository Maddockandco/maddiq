'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateVatReturn, calculateVatReturnCashBasis, calculateVatReturnFlatRate, getVatReturnDetail, VatReturnResult, VatReturnDetail } from '@/lib/vatReturn'
import { evaluateCorrectionsForReturn, CorrectionEvaluation } from '@/lib/vatErrorCorrection'
import { collectClientFraudPreventionData } from '@/lib/hmrcFraudPreventionClient'

export default function VatReturn({ clientId, onSwitchToSetup }: { clientId: string; onSwitchToSetup?: () => void }) {
  const supabase = createClient()
  const { can } = useRole()

  const [filedReturns, setFiledReturns] = useState<any[]>([])
  const [hmrcConnected, setHmrcConnected] = useState(false)
  const [obligations, setObligations] = useState<any[] | null>(null)
  const [loadingObligations, setLoadingObligations] = useState(false)
  const [obligationsError, setObligationsError] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // The obligation currently being prepared (live calculation, not yet submitted)
  const [preparing, setPreparing] = useState<any | null>(null)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false)
  const [result, setResult] = useState<VatReturnResult | null>(null)
  const [calculatingResult, setCalculatingResult] = useState(false)
  const [calcTab, setCalcTab] = useState<'return' | 'details'>('return')
  const [detail, setDetail] = useState<VatReturnDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [box2, setBox2] = useState('0')
  const [box8, setBox8] = useState('0')
  const [box9, setBox9] = useState('0')
  const [notes, setNotes] = useState('')
  const [correctionEval, setCorrectionEval] = useState<CorrectionEvaluation | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // A previously filed return, opened read-only
  const [viewingReturn, setViewingReturn] = useState<any | null>(null)
  const [viewTab, setViewTab] = useState<'return' | 'details'>('return')
  const [viewDetail, setViewDetail] = useState<VatReturnDetail | null>(null)
  const [loadingViewDetail, setLoadingViewDetail] = useState(false)

  useEffect(() => { fetchAll() }, [clientId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: firmUser } = await supabase.from('firm_users').select('full_name').eq('user_id', user.id).single()
      setUserDisplayName(firmUser?.full_name || user.email || 'Unknown user')
    })
  }, [])

  useEffect(() => {
    if (hmrcConnected && obligations === null && !loadingObligations) {
      handleFetchObligations()
    }
  }, [hmrcConnected])

  useEffect(() => {
    if (preparing) fetchLiveCalculation()
  }, [preparing])

  async function fetchAll() {
    setLoading(true)
    const [returnsRes, settingsRes, connectionRes] = await Promise.all([
      supabase.from('vat_returns').select('*').eq('client_id', clientId).eq('status', 'filed').order('period_end', { ascending: false }),
      supabase.from('vat_settings').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('hmrc_connections').select('status').eq('client_id', clientId).eq('status', 'active').maybeSingle(),
    ])
    setFiledReturns(returnsRes.data || [])
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
    if (!preparing) return
    setCalculatingResult(true)
    setDetail(null)
    setCalcTab('return')
    let calc: VatReturnResult
    if (settings?.scheme === 'cash_accounting') {
      calc = await calculateVatReturnCashBasis(clientId, preparing.start, preparing.end)
    } else if (settings?.scheme === 'flat_rate') {
      calc = await calculateVatReturnFlatRate(clientId, preparing.start, preparing.end, {
        sector: settings?.flat_rate_sector || null,
        registrationDate: settings?.registration_date || null,
        lctOverride: settings?.lct_override || 'auto',
      })
    } else {
      calc = await calculateVatReturn(clientId, preparing.start, preparing.end)
    }
    setResult(calc)
    const evaluation = await evaluateCorrectionsForReturn(clientId, calc.box6TotalSalesExVat)
    setCorrectionEval(evaluation.netPosition.corrections.length > 0 ? evaluation : null)
    setCalculatingResult(false)
  }

  async function handleViewDetails() {
    setCalcTab('details')
    if (detail || !preparing) return
    setLoadingDetail(true)
    const d = await getVatReturnDetail(clientId, preparing.start, preparing.end, settings?.scheme || 'standard')
    setDetail(d)
    setLoadingDetail(false)
  }

  function openPrepare(obligation: any) {
    setPreparing(obligation)
    setResult(null)
    setCorrectionEval(null)
    setBox2('0')
    setBox8('0')
    setBox9('0')
    setNotes('')
    setError('')
    setDeclarationConfirmed(false)
  }

  async function openViewReturn(r: any) {
    setViewingReturn(r)
    setViewTab('return')
    setViewDetail(null)
  }

  async function handleViewDetailsTab() {
    setViewTab('details')
    if (viewDetail || !viewingReturn) return
    setLoadingViewDetail(true)
    const d = await getVatReturnDetail(clientId, viewingReturn.period_start, viewingReturn.period_end, viewingReturn.scheme_at_filing || 'standard')
    setViewDetail(d)
    setLoadingViewDetail(false)
  }

  async function handleSubmitToHmrc() {
    if (!preparing || !result || !declarationConfirmed) return
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fraudPreventionData = await collectClientFraudPreventionData()
      const res = await fetch('/api/hmrc/submit-return', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          clientId,
          periodStart: preparing.start,
          periodEnd: preparing.end,
          obligationPeriodKey: preparing.periodKey,
          fraudPreventionData,
          notes: notes || null,
          declarationText,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Submission failed')

      setShowSubmitConfirm(false)
      setPreparing(null)
      setResult(null)
      await fetchAll()
      await handleFetchObligations()
    } catch (err: any) {
      setError(err.message)
      setShowSubmitConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const box2Val = parseFloat(box2) || 0
  const correctionsApplied = correctionEval?.withinThreshold ?? false
  const box1Adj = correctionsApplied ? correctionEval!.box1Adjustment : 0
  const box4Adj = correctionsApplied ? correctionEval!.box4Adjustment : 0
  const box1Display = result ? result.box1VatOnSales + box1Adj : 0
  const box4Display = result ? result.box4VatReclaimed + box4Adj : 0
  const netVat = result ? box1Display + box2Val - box4Display : 0
  const canSubmit = !!result && (!correctionEval || correctionEval.withinThreshold) && declarationConfirmed
  const declarationText = `I, ${userDisplayName || 'the submitting user'}, confirm that my client has received a copy of the information contained in this return and approved the information as being correct and complete to the best of their knowledge and belief.`

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

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  if (!hmrcConnected) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-brand-dark">Not connected to HMRC</p>
        <p className="text-sm text-gray-400">Connect this client to HMRC to see obligations and file returns.</p>
        {onSwitchToSetup && (
          <button
            onClick={onSwitchToSetup}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            Connect to HMRC
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
            {loadingObligations ? 'Fetching...' : 'Refresh from HMRC'}
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((o, i) => (
                    <tr
                      key={i}
                      onClick={() => o.status === 'O' && can.manageEngagements && openPrepare(o)}
                      className={`border-t border-gray-100 ${o.status === 'O' ? 'cursor-pointer hover:bg-brand-light/40' : ''}`}
                    >
                      <td className="px-4 py-2 text-brand-dark">
                        {new Date(o.start).toLocaleDateString('en-GB')} – {new Date(o.end).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 text-brand-dark">{new Date(o.due).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'O' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {o.status === 'O' ? 'Open' : 'Fulfilled'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {o.status === 'O' && can.manageEngagements && (
                          <span className="text-xs text-brand-dark font-semibold">Prepare return →</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {preparing && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-brand-dark px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Preparing VAT Return</p>
              <h3 className="text-white text-lg font-semibold">
                {new Date(preparing.start).toLocaleDateString('en-GB')} – {new Date(preparing.end).toLocaleDateString('en-GB')}
              </h3>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-white/10 text-white capitalize">
              {settings?.scheme ? settings.scheme.replace('_', ' ') : 'Standard'} Scheme
            </span>
          </div>

          <div className="p-6 space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

            <p className="text-xs text-gray-400">
              Period fixed by HMRC's obligation — due {new Date(preparing.due).toLocaleDateString('en-GB')}.
            </p>

            {calculatingResult && <p className="text-xs text-gray-400">Calculating from invoices and bills for this period...</p>}

            {settings?.scheme === 'flat_rate' && result && 'appliedPercentage' in result && (
              <div className="bg-brand-light rounded-xl p-4 text-sm text-brand-dark space-y-1">
                <p>
                  Rate applied this period: <span className="font-bold">{(result as any).appliedPercentage}%</span>
                  {' — '}
                  {(result as any).isLimitedCostTrader ? 'Limited Cost Trader rate (automatic)' : 'sector rate (automatic)'}
                </p>
                <p className="text-xs text-gray-500">
                  Qualifying goods spend this period: £{(result as any).lctDetail.qualifyingGoodsSpend.toFixed(2)} vs threshold £{(result as any).lctDetail.threshold.toFixed(2)}
                </p>
              </div>
            )}

            {correctionEval && (
              correctionEval.withinThreshold ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
                  <p>
                    {correctionEval.netPosition.corrections.length} pending error correction{correctionEval.netPosition.corrections.length !== 1 ? 's' : ''} will be folded into Box {box1Adj !== 0 ? '1' : ''}{box1Adj !== 0 && box4Adj !== 0 ? ' / ' : ''}{box4Adj !== 0 ? '4' : ''} on submission.
                  </p>
                  <p className="text-xs text-green-700">
                    Net £{correctionEval.netPosition.netAmountAbs.toFixed(2)} vs disclosure threshold £{correctionEval.threshold.toFixed(2)} for this period — within limit.
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                  <p className="font-semibold">Pending error corrections exceed the disclosure threshold — cannot submit yet.</p>
                  <p className="text-xs">
                    Net £{correctionEval.netPosition.netAmountAbs.toFixed(2)} vs threshold £{correctionEval.threshold.toFixed(2)}. Resolve or cancel them in Error Corrections, or report separately via VAT652, before submitting this return.
                  </p>
                </div>
              )
            )}

            {result && (
              <>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                  <button onClick={() => setCalcTab('return')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${calcTab === 'return' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                    Return
                  </button>
                  <button onClick={handleViewDetails} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${calcTab === 'details' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                    Transaction Detail
                  </button>
                </div>

                {calcTab === 'return' && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {result.reverseChargeLinesFound > 0 && (
                      <div className="bg-amber-50 px-5 py-3 text-xs text-amber-700">
                        {result.reverseChargeLinesFound} reverse charge line(s) found in this period — review manually, not yet automated.
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes (internal only, not sent to HMRC)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
            </div>

            {result && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationConfirmed}
                    onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <span className="text-sm text-brand-dark">{declarationText}</span>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={!canSubmit}
                className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-40"
              >
                Submit to HMRC
              </button>
              <button onClick={() => setPreparing(null)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
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
              <p className="text-white/60 text-xs uppercase tracking-wider">Filed VAT Return</p>
              <h3 className="text-white text-lg font-semibold">
                {new Date(viewingReturn.period_start).toLocaleDateString('en-GB')} – {new Date(viewingReturn.period_end).toLocaleDateString('en-GB')}
              </h3>
            </div>
            <button onClick={() => setViewingReturn(null)} className="text-white/70 hover:text-white text-sm">✕ Close</button>
          </div>

          <div className="p-6 space-y-4">
            {viewingReturn.hmrc_form_bundle_number && (
              <p className="text-xs text-gray-400">
                Submission reference: <span className="font-mono text-brand-dark">{viewingReturn.hmrc_form_bundle_number}</span>
                {' · '}Processed {new Date(viewingReturn.hmrc_processing_date).toLocaleString('en-GB')}
              </p>
            )}
            {viewingReturn.declaration_confirmed_by_name && (
              <p className="text-xs text-gray-400">
                Declaration confirmed by <span className="font-medium text-brand-dark">{viewingReturn.declaration_confirmed_by_name}</span>
              </p>
            )}

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button onClick={() => setViewTab('return')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${viewTab === 'return' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                View Return
              </button>
              <button onClick={handleViewDetailsTab} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${viewTab === 'details' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
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
                {formBox(6, viewingReturn.scheme_at_filing === 'flat_rate' ? 'Total sales, INCLUDING VAT (Flat Rate uses gross turnover here)' : 'Total value of sales, excluding VAT', parseFloat(viewingReturn.box6_total_sales_ex_vat).toFixed(2))}
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
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showSubmitConfirm}
        title="Submit this VAT Return to HMRC?"
        message={result ? `This is a real, final submission to HMRC's sandbox service. Net VAT ${netVat >= 0 ? 'to pay' : 'to reclaim'}: £${Math.abs(netVat).toFixed(2)} for ${preparing ? new Date(preparing.start).toLocaleDateString('en-GB') : ''} to ${preparing ? new Date(preparing.end).toLocaleDateString('en-GB') : ''}. Once accepted, this cannot be edited — only corrected in a future return.` : ''}
        confirmLabel={submitting ? 'Submitting...' : 'Submit to HMRC'}
        confirming={submitting}
        danger
        onConfirm={handleSubmitToHmrc}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      <div>
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Filed Returns</h3>
        {filedReturns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-400">No VAT Returns filed yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-brand-dark">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Box 5 (Net VAT)</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {filedReturns.map((r, i) => (
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
                      <td className="px-6 py-3 text-sm text-gray-500">{new Date(r.filed_date).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
