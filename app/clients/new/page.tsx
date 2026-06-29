'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import CompanyLookup from '@/components/clients/CompanyLookup'

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
  const [registeredAddress, setRegisteredAddress] = useState('')
  const [incorporationDate, setIncorporationDate] = useState('')
  const [sicCode, setSicCode] = useState('')
  const [yearEndDate, setYearEndDate] = useState('')
  const [directors, setDirectors] = useState<any[]>([])
  const [chFound, setChFound] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  function handleCompanyFound(data: any) {
    setName(data.name || '')
    setCompanyNumber(data.company_number || '')
    setRegisteredAddress(data.registered_address || '')
    setIncorporationDate(data.incorporated_on || '')
    setSicCode(data.sic_codes?.[0] || '')
    setDirectors(data.directors || [])
    setChFound(true)

    // Calculate year end from accounting reference date
    if (data.accounting_reference_date) {
      const [day, month] = data.accounting_reference_date.split('/')
      const year = new Date().getFullYear()
      setYearEndDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    if (!name) {
      setError('Client name is required')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) { setError('Could not find your firm'); setLoading(false); return }

    const { data: client, error: insertError } = await supabase
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
        registered_address: registeredAddress || null,
        incorporation_date: incorporationDate || null,
        sic_code: sicCode || null,
        year_end_date: yearEndDate || null,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setLoading(false); return }

    // Add directors as contacts
    if (directors.length > 0 && client) {
      for (const director of directors) {
        await supabase.from('client_contacts').insert({
          client_id: client.id,
          firm_id: firmUser.firm_id,
          name: director.name,
          role: 'director',
          appointment_date: director.appointment_date || null,
          is_primary: directors.indexOf(director) === 0,
        })
      }
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
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">

          {/* Client Type */}
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

          {/* Companies House Lookup — only for companies */}
          {type === 'company' && (
            <CompanyLookup onFound={handleCompanyFound} />
          )}

          {/* CH Found confirmation */}
          {chFound && directors.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">
                ✅ Company found — {directors.length} director{directors.length > 1 ? 's' : ''} will be imported
              </p>
              <div className="space-y-1">
                {directors.map((d, i) => (
                  <p key={i} className="text-xs text-green-600">👤 {d.name}</p>
                ))}
              </div>
            </div>
          )}

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
              <label className="block text-sm font-medium text-brand-dark mb-1">Companies House number</label>
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
              placeholder="contact@acme.co.uk"
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
              placeholder="07700 900000"
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
              placeholder="Hospitality, Construction, Retail..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          {/* Year End */}
          {type === 'company' && (
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Year end date</label>
              <input
                type="date"
                value={yearEndDate}
                onChange={(e) => setYearEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          )}

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
                placeholder="GB123456789"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
          )}

          {/* Registered Address (auto-filled from CH) */}
          {registeredAddress && (
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Registered address</label>
              <input
                type="text"
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
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
