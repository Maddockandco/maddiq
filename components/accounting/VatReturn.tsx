'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { calculateVatReturn, VatReturnResult } from '@/lib/vatReturn'

export default function VatReturn({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [result, setResult] = useState<VatReturnResult | null>(null)
  const [calculatingResult, setCalculatingResult] = useState(false)
  const [box2, setBox2] = useState('0')
  const [box8, setBox8] = useState('0')
  const [box9, setBox9] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [markingFiledId, setMarkingFiledId] = useState<string | null>(null)

  useEffect(() => { fetchReturns() }, [clientId])

  useEffect(() => {
    if (periodStart && periodEnd) fetchLiveCalculation()
  }, [periodStart, periodEnd])

  async function fetchReturns() {
    setLoading(true)
    const { data } = await supabase.from('vat_returns').select('*').eq('client_id', clientId).order('period_end', { ascending: false })
    setReturns(data || [])
    setLoading(false)
  }

  async function fetchLiveCalculation() {
    setCalculatingResult(true)
    const calc = await calculateVatReturn(clientId, periodStart, periodEnd)
    setResult(calc)
    setCalculatingResult(false)
  }

  function openCalculator() {
    setPeriodStart('')
    setPeriodEnd('')
    setResult(null)
    setBox2('0')
    setBox8('0')
    setBox9('0')
    setNotes('')
    setError('')
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
    fetchReturns()
  }

  async function handleMarkFiled(vatReturn: any) {
    setMarkingFiledId(vatReturn.id)
    const filedDate = new Date().toISOString().split('T')[0]
    const { data: updated } = await supabase
      .from('vat_returns')
      .update({ status: 'filed', filed_date: filedDate })
      .eq('id', vatReturn.id)
      .select()
      .single()

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
    fetchReturns()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

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

      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          Calculated on a standard (accrual) VAT accounting basis, using invoice/bill dates rather than payment dates. Boxes 2, 8, and 9 relate to Northern Ireland EU goods movements and are left for manual entry, since they need EU trade data this app doesn't hold. If any line uses a reverse charge VAT code, it's flagged below for manual review — reverse charge treatment isn't automated yet. This is not yet connected to HMRC for filing; that's a separate, upcoming piece.
        </p>
      </div>

      {calculating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New VAT Return</h3>
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
            <div className="bg-brand-light rounded-xl p-4 space-y-2">
              {result.reverseChargeLinesFound > 0 && (
                <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mb-2">
                  <p className="text-xs text-amber-800">
                    ⚠ {result.reverseChargeLinesFound} line(s) in this period use a reverse charge VAT code. These aren't specially handled below — review manually before filing.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Box 1 — VAT due on sales</span><span className="text-brand-dark">£{result.box1VatOnSales.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 4 — VAT reclaimed on purchases</span><span className="text-brand-dark">£{result.box4VatReclaimed.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 6 — Total sales, ex VAT</span><span className="text-brand-dark">£{result.box6TotalSalesExVat.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Box 7 — Total purchases, ex VAT</span><span className="text-brand-dark">£{result.box7TotalPurchasesExVat.toFixed(2)}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm border-t border-gray-200 pt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Box 2 — EU acquisitions (NI only)</label>
                  <input type="number" value={box2} onChange={(e) => setBox2(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Box 8 — EU goods supplied (NI only)</label>
                  <input type="number" value={box8} onChange={(e) => setBox8(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Box 9 — EU goods acquired (NI only)</label>
                  <input type="number" value={box9} onChange={(e) => setBox9(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex justify-between items-baseline border-t border-gray-200 pt-2">
                <span className="text-sm font-semibold text-brand-dark">Box 5 — Net VAT {(result.box1VatOnSales + (parseFloat(box2) || 0) - result.box4VatReclaimed) >= 0 ? 'to pay' : 'to reclaim'}</span>
                <span className="text-2xl font-bold text-brand-dark">
                  £{Math.abs(result.box1VatOnSales + (parseFloat(box2) || 0) - result.box4VatReclaimed).toFixed(2)}
                </span>
              </div>
            </div>
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
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Save this VAT Return?"
        message={result ? `Net VAT ${(result.box1VatOnSales + (parseFloat(box2) || 0) - result.box4VatReclaimed) >= 0 ? 'to pay' : 'to reclaim'}: £${Math.abs(result.box1VatOnSales + (parseFloat(box2) || 0) - result.box4VatReclaimed).toFixed(2)} for the period ${periodStart} to ${periodEnd}.` : ''}
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
