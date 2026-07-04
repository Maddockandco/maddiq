'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

export default function Contacts({ clientId }: { clientId: string }) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<'all' | 'customers' | 'suppliers'>('all')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isCustomer, setIsCustomer] = useState(true)
  const [isSupplier, setIsSupplier] = useState(false)
  const [paymentTerms, setPaymentTerms] = useState('30')
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

  async function handleAdd() {
    setSaving(true)
    setError('')
    if (!name) { setError('Name is required'); setSaving(false); return }
    if (!isCustomer && !isSupplier) { setError('Must be marked as a customer, supplier, or both'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { error: insertError } = await supabase.from('contacts').insert({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      name,
      email: email || null,
      phone: phone || null,
      is_customer: isCustomer,
      is_supplier: isSupplier,
      payment_terms_days: parseInt(paymentTerms) || 30,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName(''); setEmail(''); setPhone(''); setIsCustomer(true); setIsSupplier(false); setPaymentTerms('30')
      setAdding(false)
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
        {can.manageEngagements && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Contact
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Ltd" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="accounts@acme.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment terms (days)</label>
              <input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputClass} />
            </div>
            <div className="md:col-span-2 flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm text-brand-dark">
                <input type="checkbox" checked={isCustomer} onChange={(e) => setIsCustomer(e.target.checked)} className="rounded" />
                Customer
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-dark">
                <input type="checkbox" checked={isSupplier} onChange={(e) => setIsSupplier(e.target.checked)} className="rounded" />
                Supplier
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Add contact'}
            </button>
            <button onClick={() => setAdding(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No contacts yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Terms</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={`border-b border-gray-100 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-3 text-sm font-semibold text-brand-dark">{c.name}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
