'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOVERNING_BODIES = [
  { value: '', label: 'Select governing body' },
  { value: 'icaew', label: 'ICAEW' },
  { value: 'acca', label: 'ACCA' },
  { value: 'aat', label: 'AAT' },
  { value: 'cima', label: 'CIMA' },
  { value: 'iab', label: 'Institute of Accountants and Bookkeepers (IAB)' },
  { value: 'att_ciot', label: 'ATT / CIOT' },
  { value: 'unregulated', label: 'Unregulated / Other' },
]

export default function SettingsForm() {
  const [firmName, setFirmName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [governingBody, setGoverningBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [firmId, setFirmId] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchFirm() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, firms(id, name, email, phone, address, governing_body)')
        .eq('user_id', user.id)
        .single()

      if (firmUser?.firms) {
        const firm = firmUser.firms as any
        setFirmId(firm.id)
        setFirmName(firm.name || '')
        setEmail(firm.email || '')
        setPhone(firm.phone || '')
        setAddress(firm.address || '')
        setGoverningBody(firm.governing_body || '')
      }
      setLoading(false)
    }
    fetchFirm()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('firms')
      .update({ name: firmName, email, phone, address, governing_body: governingBody || null })
      .eq('id', firmId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">
          Settings saved successfully!
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Firm Details</h2>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Firm name</label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Phone number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Governing body</label>
          <select
            value={governingBody}
            onChange={(e) => setGoverningBody(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          >
            {GOVERNING_BODIES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Used to show which engagement letter clauses are typically required by your professional body.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
