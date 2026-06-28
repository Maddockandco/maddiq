'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewClientPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState('company')
  const [status, setStatus] = useState('prospect')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [vatRegistered, setVatRegistered] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')

    if (!name) {
      setError('Client name is required')
      setLoading(false)
      return
    }

    // Get current user's firm
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) {
      setError('Could not find your firm')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('clients')
      .insert({
        firm_id: firmUser.firm_id,
        name,
        type,
        status,
        email: email || null,
        phone: phone || null,
        industry: industry || null,
        company_number: companyNumber || null,
        vat_registered: vatRegistered,
        vat_number: vatNumber || null,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    window.location.href = '/clients'
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to clients
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-brand-dark mb-8">Add new client</h1>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">

          {/* Client Type */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">
              Client type
            </label>
            <div className="flex gap-4">
              {['company', 'individual'].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                    type === t
                      ? 'bg-brand-dark text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              placeholder={type === 'company' ? 'Acme Ltd' : 'John Smith'}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          {/* Company Number */}
          {type === 'company' && (
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Companies House number
              </label>
              <input
                type="text"
                value={companyNumber}
                onChange={(e) => setCompanyNumber(e.target.value)}
                placeholder="12345678"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Status
            </label>
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
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@acme.co.uk"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Phone number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07700 900000"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Hospitality, Construction, Retail..."
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
              <label className="block text-sm font-medium text-brand-dark mb-1">
                VAT number
              </label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="GB123456789"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
            >
              {loading ? 'Saving...' : 'Save client'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
