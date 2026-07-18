'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

export default function AssociatedCompanies({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [ownershipPercentage, setOwnershipPercentage] = useState('')

  useEffect(() => { fetchCompanies() }, [clientId])

  async function fetchCompanies() {
    const { data } = await supabase.from('associated_companies').select('*').eq('client_id', clientId).order('name')
    if (data) setCompanies(data)
    setLoading(false)
  }

  function openNewForm() {
    setEditingId(null)
    setName('')
    setCompanyNumber('')
    setOwnershipPercentage('')
    setError('')
    setFormOpen(true)
  }

  function openEditForm(c: any) {
    setEditingId(c.id)
    setName(c.name)
    setCompanyNumber(c.companies_house_number || '')
    setOwnershipPercentage(c.ownership_percentage != null ? String(c.ownership_percentage) : '')
    setError('')
    setFormOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Company name is required'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      name: name.trim(),
      companies_house_number: companyNumber || null,
      ownership_percentage: ownershipPercentage ? parseFloat(ownershipPercentage) : null,
    }

    if (editingId) {
      const { error: updateError } = await supabase.from('associated_companies').update(payload).eq('id', editingId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('associated_companies').insert({ ...payload, is_active: true })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    setFormOpen(false)
    setSaving(false)
    fetchCompanies()
  }

  async function toggleActive(c: any) {
    await supabase.from('associated_companies').update({ is_active: !c.is_active }).eq('id', c.id)
    fetchCompanies()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const activeCount = companies.filter((c) => c.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Associated Companies</h3>
        {can.manageEngagements && !formOpen && (
          <button onClick={openNewForm} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Add Company
          </button>
        )}
      </div>

      <div className="bg-brand-light rounded-xl p-4">
        <p className="text-xs text-gray-500">
          Companies are associated when one controls the other, or both are controlled by the same person(s) — broadly, 51%+ common ownership. This matters for Corporation Tax because the £50,000 and £250,000 thresholds get divided between the company and all its active associated companies.
        </p>
        <p className="text-sm font-semibold text-brand-dark mt-2">{activeCount} active associated {activeCount === 1 ? 'company' : 'companies'}</p>
      </div>

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingId ? 'Edit Associated Company' : 'New Associated Company'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Company Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Companies House Number (optional)</label>
              <input type="text" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ownership % (optional)</label>
              <input type="number" value={ownershipPercentage} onChange={(e) => setOwnershipPercentage(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Company'}
            </button>
            <button onClick={() => setFormOpen(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No associated companies on record</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Companies House No.</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Ownership %</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => (
                  <tr key={c.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{c.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{c.companies_house_number || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{c.ownership_percentage != null ? `${c.ownership_percentage}%` : '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {can.manageEngagements && (
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => openEditForm(c)} className="text-xs text-brand-dark font-medium hover:underline">Edit</button>
                          <button onClick={() => toggleActive(c)} className="text-xs text-gray-500 font-medium hover:underline">
                            {c.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
