'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import CompanyLookup from '@/components/companies-house/CompanyLookup'

const ENTITY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_trader', label: 'Sole Trader' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'llp', label: 'LLP' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust', label: 'Trust' },
]

const CH_ELIGIBLE_TYPES = ['limited_company', 'llp']

const EMPTY_FORM = {
  name: '',
  entity_type: 'limited_company',
  email: '',
  phone: '',
  contact_person: '',
  website: '',
  is_customer: true,
  is_supplier: false,
  payment_terms_days: '30',
  account_reference: '',
  vat_number: '',
  company_number: '',
  company_status: '',
  incorporated_on: '',
  registered_office_address: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  country: 'United Kingdom',
  notes: '',
  bank_account_name: '',
  bank_sort_code: '',
  bank_account_number: '',
  bank_iban: '',
}

export default function Contacts({ clientId }: { clientId: string }) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'customers' | 'suppliers'>('all')
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchContacts() }, [clientId])

  async function fetchContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('name', { ascending: true })
    if (data) setContacts(data)
    setLoading(false)
  }

  function updateField(key: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm({ ...form, [key]: value })
  }

  function handleCompanyFound(data: any) {
    setForm({
      ...form,
      name: form.name || data.name || '',
      company_number: data.company_number || '',
      company_status: data.status || '',
      incorporated_on: data.incorporated_on || '',
      registered_office_address: data.registered_address || '',
    })
  }

  function openNewForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  function openEditForm(contact: any) {
    setForm({
      name: contact.name || '',
      entity_type: contact.entity_type || 'limited_company',
      email: contact.email || '',
      phone: contact.phone || '',
      contact_person: contact.contact_person || '',
      website: contact.website || '',
      is_customer: contact.is_customer ?? true,
      is_supplier: contact.is_supplier ?? false,
      payment_terms_days: String(contact.payment_terms_days ?? 30),
      account_reference: contact.account_reference || '',
      vat_number: contact.vat_number || '',
      company_number: contact.company_number || '',
      company_status: contact.company_status || '',
      incorporated_on: contact.incorporated_on || '',
      registered_office_address: contact.registered_office_address || '',
      address_line1: contact.address_line1 || '',
      address_line2: contact.address_line2 || '',
      city: contact.city || '',
      postcode: contact.postcode || '',
      country: contact.country || 'United Kingdom',
      notes: contact.notes || '',
      bank_account_name: contact.bank_account_name || '',
      bank_sort_code: contact.bank_sort_code || '',
      bank_account_number: contact.bank_account_number || '',
      bank_iban: contact.bank_iban || '',
    })
    setEditingId(contact.id)
    setError('')
    setFormOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    if (!form.name) { setError('Name is required'); setSaving(false); return }
    if (!form.is_customer && !form.is_supplier) { setError('Must be marked as a customer, supplier, or both'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const payload: any = {
      name: form.name,
      entity_type: form.entity_type,
      email: form.email || null,
      phone: form.phone || null,
      contact_person: form.contact_person || null,
      website: form.website || null,
      is_customer: form.is_customer,
      is_supplier: form.is_supplier,
      payment_terms_days: parseInt(form.payment_terms_days) || 30,
      account_reference: form.account_reference || null,
      vat_number: form.vat_number || null,
      company_number: form.company_number || null,
      company_status: form.company_status || null,
      incorporated_on: form.incorporated_on || null,
      registered_office_address: form.registered_office_address || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      postcode: form.postcode || null,
      country: form.country || null,
      notes: form.notes || null,
      bank_account_name: form.bank_account_name || null,
      bank_sort_code: form.bank_sort_code || null,
      bank_account_number: form.bank_account_number || null,
      bank_iban: form.bank_iban || null,
    }

    let saveError
    if (editingId) {
      const { error: updateError } = await supabase.from('contacts').update(payload).eq('id', editingId)
      saveError = updateError
    } else {
      const { error: insertError } = await supabase.from('contacts').insert({
        ...payload,
        firm_id: firmUser.firm_id,
        client_id: clientId,
      })
      saveError = insertError
    }

    if (saveError) {
      setError(saveError.message)
    } else {
      setFormOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
      fetchContacts()
    }
    setSaving(false)
  }

  async function handleToggleActive(contactId: string, isActive: boolean) {
    await supabase.from('contacts').update({ is_active: !isActive }).eq('id', contactId)
    setContacts(contacts.map(c => c.id === contactId ? { ...c, is_active: !isActive } : c))
  }

  const filtered = contacts.filter((c) => {
    if (filter === 'customers') return c.is_customer
    if (filter === 'suppliers') return c.is_supplier
    return true
  })

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const sectionLabel = "text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading contacts...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(['all', 'customers', 'suppliers'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition capitalize ${
                filter === f ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {can.manageEngagements && !formOpen && (
          <button
            onClick={openNewForm}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Contact
          </button>
        )}
      </div>

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          {/* Type */}
          <div>
            <p className={sectionLabel}>Contact type</p>
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 text-sm text-brand-dark">
                <input type="checkbox" checked={form.is_customer} onChange={(e) => updateField('is_customer', e.target.checked)} className="rounded" />
                Customer
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-dark">
                <input type="checkbox" checked={form.is_supplier} onChange={(e) => updateField('is_supplier', e.target.checked)} className="rounded" />
                Supplier
              </label>
            </div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity type</label>
            <select value={form.entity_type} onChange={(e) => updateField('entity_type', e.target.value)} className={`${inputClass} max-w-xs`}>
              {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Companies House lookup */}
          {CH_ELIGIBLE_TYPES.includes(form.entity_type) && (
            <CompanyLookup onFound={handleCompanyFound} />
          )}

          {/* Details */}
          <div>
            <p className={sectionLabel}>Details</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Acme Ltd" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact person</label>
                <input type="text" value={form.contact_person} onChange={(e) => updateField('contact_person', e.target.value)} placeholder="Jane Smith" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account reference</label>
                <input type="text" value={form.account_reference} onChange={(e) => updateField('account_reference', e.target.value)} placeholder="CUST-001" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
                <input type="text" value={form.website} onChange={(e) => updateField('website', e.target.value)} placeholder="acme.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment terms (days)</label>
                <input type="number" value={form.payment_terms_days} onChange={(e) => updateField('payment_terms_days', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Trading address */}
          <div>
            <p className={sectionLabel}>Trading address</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" value={form.address_line1} onChange={(e) => updateField('address_line1', e.target.value)} placeholder="Address line 1" className={inputClass} />
              <input type="text" value={form.address_line2} onChange={(e) => updateField('address_line2', e.target.value)} placeholder="Address line 2" className={inputClass} />
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="City" className={inputClass} />
              <input type="text" value={form.postcode} onChange={(e) => updateField('postcode', e.target.value)} placeholder="Postcode" className={inputClass} />
              <input type="text" value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="Country" className={inputClass} />
            </div>
          </div>

          {/* Registered office - only relevant for CH-eligible entities */}
          {CH_ELIGIBLE_TYPES.includes(form.entity_type) && (
            <div>
              <p className={sectionLabel}>Registered office (Companies House)</p>
              <textarea
                value={form.registered_office_address}
                onChange={(e) => updateField('registered_office_address', e.target.value)}
                placeholder="Auto-filled from Companies House lookup above, or enter manually"
                rows={2}
                className={inputClass}
              />
              {form.company_status && (
                <p className="text-xs text-gray-400 mt-2">
                  Status: <span className="font-medium">{form.company_status}</span>
                  {form.incorporated_on && ` · Incorporated ${new Date(form.incorporated_on).toLocaleDateString('en-GB')}`}
                </p>
              )}
            </div>
          )}

          {/* Tax & registration */}
          <div>
            <p className={sectionLabel}>Tax & registration</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">VAT number</label>
                <input type="text" value={form.vat_number} onChange={(e) => updateField('vat_number', e.target.value)} placeholder="GB123456789" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Company number</label>
                <input type="text" value={form.company_number} onChange={(e) => updateField('company_number', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Bank details - suppliers only */}
          {form.is_supplier && (
            <div>
              <p className={sectionLabel}>Bank details (for payments)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={form.bank_account_name} onChange={(e) => updateField('bank_account_name', e.target.value)} placeholder="Account name" className={inputClass} />
                <input type="text" value={form.bank_sort_code} onChange={(e) => updateField('bank_sort_code', e.target.value)} placeholder="Sort code" className={inputClass} />
                <input type="text" value={form.bank_account_number} onChange={(e) => updateField('bank_account_number', e.target.value)} placeholder="Account number" className={inputClass} />
                <input type="text" value={form.bank_iban} onChange={(e) => updateField('bank_iban', e.target.value)} placeholder="IBAN (if international)" className={inputClass} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className={sectionLabel}>Notes</p>
            <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} className={inputClass} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add contact'}
            </button>
            <button onClick={() => { setFormOpen(false); setEditingId(null) }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && !formOpen ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No contacts yet</p>
        </div>
      ) : !formOpen && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Company No.</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Terms</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={`border-b border-gray-100 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-3 text-sm font-semibold text-brand-dark">{c.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500 font-mono">{c.company_number || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{c.email || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {c.is_customer && c.is_supplier ? 'Customer & Supplier' : c.is_customer ? 'Customer' : 'Supplier'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{c.payment_terms_days} days</td>
                  <td className="px-6 py-3">
                    {can.manageEngagements ? (
                      <button
                        onClick={() => handleToggleActive(c.id, c.is_active)}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition ${
                          c.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {can.manageEngagements && (
                      <button onClick={() => openEditForm(c)} className="text-xs text-brand-dark font-medium hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
