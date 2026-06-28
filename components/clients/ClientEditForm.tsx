'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClientEditForm({ clientId }: { clientId: string }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('company')
  const [status, setStatus] = useState('prospect')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [vatRegistered, setVatRegistered] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [yearEndDate, setYearEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      if (data) {
        setName(data.name || '')
        setType(data.type || 'company')
        setStatus(data.status || 'prospect')
        setEmail(data.email || '')
        setPhone(data.phone || '')
        setIndustry(data.industry || '')
        setCompanyNumber(data.company_number || '')
        setVatRegistered(data.vat_registered || false)
        setVatNumber(data.vat_number || '')
        setYearEndDate(data.year_end_date || '')
        setNotes(data.notes || '')
      }
      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        name,
        type,
        status,
        email: email || null,
        phone: phone || null,
        industry: industry || null,
        company_number: companyNumber || null,
        vat_registered: vatRegistered,
        vat_number: vatNumber || null,
        year_end_date: yearEndDate || null,
        notes: notes || null,
      })
      .eq('id', clientId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this client? This cannot be undone.')) return

    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      window.location.href = '/clients'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading client...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Client updated successfully!</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Edit Client</h2>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-2">Client type</label>
          <div className="flex gap-4">
            {['company', 'individual'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  type === t ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">
            {type === 'company' ? 'Company name' : 'Full name'} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        {/* Company Number */}
        {type === 'company' && (
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Companies House number</label>
            <input
              type="text"
              value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          >
            <option value="prospect">Prospect</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="offboarded">Offboarded</option>
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Phone number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Industry</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        {/* Year End */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Year end date</label>
          <input
            type="date"
            value={yearEndDate}
            onChange={(e) => setYearEndDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        {/* VAT */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => setVatRegistered(e.target.checked)}
              className="w-4 h-4 accent-brand-dark"
            />
            <span className="text-sm font-medium text-brand-dark">VAT registered</span>
          </label>
        </div>

        {vatRegistered && (
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">VAT number</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
        <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-4">Danger Zone</h3>
        <button
          onClick={handleDelete}
          className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-lg hover:bg-red-100 transition text-sm"
        >
          Delete client
        </button>
      </div>
    </div>
  )
}
