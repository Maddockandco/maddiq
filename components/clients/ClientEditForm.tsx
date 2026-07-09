'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'

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
      })
      .eq('id', clientId)
    if (updateError) { setError(updateError.message); setSaving(false); return }
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
