'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  isOpen: boolean
  clientId: string
  type: 'customer' | 'supplier'
  onCreated: (contact: any) => void
  onCancel: () => void
}

export default function AddContactModal({ isOpen, clientId, type, onCreated, onCancel }: Props) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState('30')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  function reset() {
    setName('')
    setEmail('')
    setPhone('')
    setPaymentTermsDays('30')
    setError('')
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { data: contact, error: insertError } = await supabase
      .from('contacts')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        is_customer: type === 'customer',
        is_supplier: type === 'supplier',
        payment_terms_days: parseInt(paymentTermsDays) || 30,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    setSaving(false)
    reset()
    onCreated(contact)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-brand-dark">New {type === 'customer' ? 'Customer' : 'Supplier'}</h3>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Phone (optional)</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Payment terms</label>
          <select
            value={['0', '14', '30', '60', '90'].includes(paymentTermsDays) ? paymentTermsDays : 'custom'}
            onChange={(e) => setPaymentTermsDays(e.target.value === 'custom' ? '' : e.target.value)}
            className={inputClass}
          >
            <option value="0">Due on Receipt</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="custom">Custom...</option>
          </select>
          {!['0', '14', '30', '60', '90'].includes(paymentTermsDays) && (
            <input
              type="number"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="Number of days"
              className={`${inputClass} mt-2`}
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : `Create ${type === 'customer' ? 'Customer' : 'Supplier'}`}
          </button>
          <button
            onClick={() => { reset(); onCancel() }}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
