'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { syncVatRegistrationToSettings } from '@/lib/syncVatRegistration'

export default function ClientEditForm({ clientId }: { clientId: string }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('company')
  const [status, setStatus] = useState('prospect')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [yearEndDate, setYearEndDate] = useState('')
  const [vatRegistered, setVatRegistered] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [registeredAddress, setRegisteredAddress] = useState('')
  const [tradingAddress, setTradingAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

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
        setYearEndDate(data.year_end_date || '')
        setVatRegistered(data.vat_registered || false)
        setVatNumber(data.vat_number || '')
        setAddressLine1(data.address_line1 || '')
        setAddressLine2(data.address_line2 || '')
        setCity(data.city || '')
        setPostcode(data.postcode || '')
        setCountry(data.country || 'United Kingdom')
        setRegisteredAddress(data.registered_address || '')
        setTradingAddress(data.trading_address || '')
      }
      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  function handleSaveClick() {
    if (!name) { setError('Name is required'); return }
    setError('')
    setShowConfirm(true)
  }

  async function handleSave() {
    setShowConfirm(false)
    setSaving(true)
    setError('')
    if (!name) { setError('Name is required'); setSaving(false); return }
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
        year_end_date: yearEndDate || null,
        vat_registered: vatRegistered,
        vat_number: vatNumber || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        country: country || null,
        registered_address: registeredAddress || null,
        trading_address: tradingAddress || null,
      })
      .eq('id', clientId)
    if (updateError) { setError(updateError.message); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user.id).single()
      if (firmUser) {
        await syncVatRegistrationToSettings({
          clientId,
          firmId: firmUser.firm_id,
          userId: user.id,
          vatRegistered,
          vatNumber: vatNumber || null,
        })
      }
    }

    router.push(`/clients/${clientId}`)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const selectClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Edit Client</h2>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Client type</label>
          <div className="flex gap-3">
            {['company', 'individual', 'partnership'].map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  type === t ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">
            {type === 'company' ? 'Company name' : type === 'partnership' ? 'Partnership name' : 'Full legal name'} *
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="prospect">Prospect</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="offboarded">Offboarded</option>
          </select>
        </div>

        {type === 'company' && (
          <>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Companies House number</label>
              <input type="text" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)}
                placeholder="12345678" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Year end date</label>
              <input type="date" value={yearEndDate} onChange={(e) => setYearEndDate(e.target.value)} className={inputClass} />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@example.com" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Phone number</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="07700 900000" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Industry</label>
          <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
            placeholder="Hospitality, Construction, Retail..." className={inputClass} />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)}
              className="w-4 h-4 accent-brand-dark" />
            <span className="text-sm font-medium text-brand-dark">VAT registered</span>
          </label>
        </div>

        {vatRegistered && (
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">VAT number</label>
            <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)}
              placeholder="GB123456789" className={inputClass} />
          </div>
        )}

        {['company', 'partnership'].includes(type) && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Addresses</p>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Registered office address</label>
              <input type="text" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)}
                placeholder="As registered with Companies House, if applicable" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Trading address</label>
              <input type="text" value={tradingAddress} onChange={(e) => setTradingAddress(e.target.value)}
                placeholder="Where the business actually operates, if different" className={inputClass} />
            </div>
          </div>
        )}

        {type === 'individual' && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Home Address</p>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Address line 1</label>
              <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Address line 2</label>
              <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Postcode</label>
                <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Country</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showConfirm}
          title="Save these changes?"
          message="You'll be taken back to the client page once saved."
          confirmLabel="Yes, save"
          cancelLabel="Keep editing"
          confirming={saving}
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />

        <div className="flex gap-3 pt-2">
          <button onClick={handleSaveClick} disabled={saving}
            className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button onClick={() => router.push(`/clients/${clientId}`)}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-200 transition text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
