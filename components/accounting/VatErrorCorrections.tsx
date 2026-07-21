'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { VatErrorCorrection } from '@/lib/vatErrorCorrection'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  applied: 'bg-green-100 text-green-700',
  requires_disclosure: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  applied: 'Applied to a return',
  requires_disclosure: 'Requires separate disclosure (VAT652)',
  cancelled: 'Cancelled',
}

export default function VatErrorCorrections({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [corrections, setCorrections] = useState<VatErrorCorrection[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [originalPeriodStart, setOriginalPeriodStart] = useState('')
  const [originalPeriodEnd, setOriginalPeriodEnd] = useState('')
  const [discoveredDate, setDiscoveredDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [box1Adjustment, setBox1Adjustment] = useState('0')
  const [box4Adjustment, setBox4Adjustment] = useState('0')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [cancelling, setCancelling] = useState<VatErrorCorrection | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => { fetchCorrections() }, [clientId])

  async function fetchCorrections() {
    setLoading(true)
    const { data } = await supabase
      .from('vat_error_corrections')
      .select('*')
      .eq('client_id', clientId)
      .order('discovered_date', { ascending: false })
    if (data) setCorrections(data as VatErrorCorrection[])
    setLoading(false)
  }

  async function logAudit(entityId: string, action: string, desc: string, oldData?: any, newData?: any) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'vat_error_correction',
      p_entity_id: entityId,
      p_action: action,
      p_old_data: oldData ?? null,
      p_new_data: newData ?? null,
      p_description: desc,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  function resetForm() {
    setOriginalPeriodStart('')
    setOriginalPeriodEnd('')
    setDiscoveredDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setBox1Adjustment('0')
    setBox4Adjustment('0')
    setError('')
  }

  async function handleSave() {
    if (!originalPeriodStart || !originalPeriodEnd) { setError('The original period this error relates to is required'); return }
    if (!description.trim()) { setError('A description is required — HMRC may query this later'); return }
    const box1Val = parseFloat(box1Adjustment) || 0
    const box4Val = parseFloat(box4Adjustment) || 0
    if (box1Val === 0 && box4Val === 0) { setError('Enter a non-zero adjustment to at least one box'); return }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { data: inserted, error: insertError } = await supabase
      .from('vat_error_corrections')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        original_period_start: originalPeriodStart,
        original_period_end: originalPeriodEnd,
        discovered_date: discoveredDate,
        description: description.trim(),
        box1_adjustment: box1Val,
        box4_adjustment: box4Val,
        status: 'pending',
        created_by: user!.id,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    await logAudit(inserted.id, 'logged', `Logged VAT error correction for period ${originalPeriodStart} to ${originalPeriodEnd}`, null, inserted)

    setSaving(false)
    setFormOpen(false)
    resetForm()
    fetchCorrections()
  }

  async function handleCancel() {
    if (!cancelling) return
    setSaving(true)
    const { error: cancelError } = await supabase
      .from('vat_error_corrections')
      .update({ status: 'cancelled', cancellation_reason: cancelReason || null, updated_at: new Date().toISOString() })
      .eq('id', cancelling.id)

    if (!cancelError) {
      await logAudit(cancelling.id, 'cancelled', `Cancelled VAT error correction: ${cancelReason || 'no reason given'}`, cancelling, { status: 'cancelled' })
      fetchCorrections()
    } else {
      setError(cancelError.message)
    }
    setSaving(false)
    setCancelling(null)
    setCancelReason('')
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  const pending = corrections.filter((c) => c.status === 'pending')
  const netPending = pending.reduce((sum, c) => sum + c.box1_adjustment - c.box4_adjustment, 0)

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">VAT Error Corrections</h3>
        {can.manageEngagements && !formOpen && (
          <button onClick={() => setFormOpen(true)} className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Log Correction
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="bg-brand-light rounded-xl p-4 text-sm text-brand-dark">
          <p>
            {pending.length} pending correction{pending.length !== 1 ? 's' : ''}, net position{' '}
            <span className="font-bold">£{Math.abs(netPending).toFixed(2)}</span>{' '}
            {netPending >= 0 ? 'owed to HMRC' : 'owed by HMRC'}.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            These will be checked against the threshold and folded into Box 1/4 automatically next time you calculate
            a VAT return for this client — or flagged for separate disclosure if they exceed it.
          </p>
        </div>
      )}

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Original Period Start</label>
              <DatePicker value={originalPeriodStart} onChange={setOriginalPeriodStart} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Original Period End</label>
              <DatePicker value={originalPeriodEnd} onChange={setOriginalPeriodEnd} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Discovered Date</label>
            <DatePicker value={discoveredDate} onChange={setDiscoveredDate} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} placeholder="e.g. Sales invoice #1234 VAT rate incorrectly applied as zero-rated instead of standard" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Box 1 Adjustment (output VAT)</label>
              <input type="number" step="0.01" value={box1Adjustment} onChange={(e) => setBox1Adjustment(e.target.value)} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Positive = more output VAT was due than declared</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Box 4 Adjustment (input VAT)</label>
              <input type="number" step="0.01" value={box4Adjustment} onChange={(e) => setBox4Adjustment(e.target.value)} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Positive = more input VAT was reclaimable than claimed</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Log Correction'}
            </button>
            <button onClick={() => { setFormOpen(false); resetForm() }} className="text-sm text-gray-500 font-medium hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Original Period</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Description</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Net Effect</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {corrections.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">No error corrections logged</td></tr>
            )}
            {corrections.map((c) => {
              const net = c.box1_adjustment - c.box4_adjustment
              return (
                <tr key={c.id} className="border-b border-gray-100 bg-white">
                  <td className="px-6 py-3 text-sm text-gray-600">{c.original_period_start} – {c.original_period_end}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 max-w-md">{c.description}</td>
                  <td className="px-6 py-3 text-sm font-mono text-gray-700">£{Math.abs(net).toFixed(2)} {net >= 0 ? 'due' : 'reclaim'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    {c.status === 'applied' && c.threshold_at_evaluation != null && (
                      <p className="text-xs text-gray-400 mt-1">
                        Net £{Math.abs(c.net_position_at_evaluation || 0).toFixed(2)} vs threshold £{c.threshold_at_evaluation.toFixed(2)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {c.status === 'pending' && can.manageEngagements && (
                      <button onClick={() => setCancelling(c)} className="text-xs text-red-500 font-medium hover:underline">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!cancelling}
        title="Cancel this correction?"
        message="This removes it from the pending queue — it won't be applied to any future return."
        confirmLabel={saving ? 'Cancelling...' : 'Cancel Correction'}
        cancelLabel="Keep it"
        confirming={saving}
        danger
        requireInput
        inputLabel="Reason (optional)"
        inputValue={cancelReason}
        onInputChange={setCancelReason}
        inputPlaceholder="e.g. Logged against the wrong period"
        onConfirm={handleCancel}
        onCancel={() => { setCancelling(null); setCancelReason('') }}
      />
    </div>
  )
}
