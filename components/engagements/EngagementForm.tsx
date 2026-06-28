'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = { clientId: string; engagement?: any; onSaved: () => void; onCancel: () => void }

export default function EngagementForm({ clientId, engagement, onSaved, onCancel }: Props) {
  const [type, setType] = useState(engagement?.type || 'bookkeeping')
  const [status, setStatus] = useState(engagement?.status || 'active')
  const [frequency, setFrequency] = useState(engagement?.frequency || 'monthly')
  const [feeAmount, setFeeAmount] = useState(engagement?.fee_amount || '')
  const [startDate, setStartDate] = useState(engagement?.start_date || '')
  const [endDate, setEndDate] = useState(engagement?.end_date || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    if (engagement) {
      const { error: updateError } = await supabase.from('engagements').update({
        type, status, frequency,
        fee_amount: feeAmount || null,
        start_date: startDate || null,
        end_date: endDate || null,
      }).eq('id', engagement.id)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('engagements').insert({
        client_id: clientId,
        firm_id: firmUser.firm_id,
        type, status, frequency,
        fee_amount: feeAmount || null,
        fee_currency: 'GBP',
        start_date: startDate || null,
        end_date: endDate || null,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }
    onSaved()
    setSaving(false)
  }

  const selectClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
        {engagement ? 'Edit Engagement' : 'New Engagement'}
      </h3>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Service type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            <option value="bookkeeping">Bookkeeping</option>
            <option value="vat">VAT Returns</option>
            <option value="self_assessment">Self Assessment</option>
            <option value="corporation_tax">Corporation Tax</option>
            <option value="payroll">Payroll</option>
            <option value="accounts">Annual Accounts</option>
            <option value="advisory">Advisory</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={selectClass}>
            <option value="one_off">One Off</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Fee amount (£)</label>
          <input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="250" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
          {saving ? 'Saving...' : engagement ? 'Save changes' : 'Add engagement'}
        </button>
        <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-200 transition text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
