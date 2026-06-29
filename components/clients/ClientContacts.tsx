'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ContactCard from '@/components/clients/ContactCard'
import { useRole } from '@/hooks/useRole'

export default function ClientContacts({ clientId }: { clientId: string }) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('director')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [niNumber, setNiNumber] = useState('')
  const [personalUtr, setPersonalUtr] = useState('')
  const [shareholding, setShareholding] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [chAuthCode, setChAuthCode] = useState('')
  const [chVerified, setChVerified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchContacts() }, [clientId])

  async function fetchContacts() {
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
    if (data) setContacts(data)
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    setError('')
    if (!name) { setError('Name is required'); setSaving(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    const { error: insertError } = await supabase.from('client_contacts').insert({
      client_id: clientId,
      firm_id: firmUser!.firm_id,
      name, role,
      email: email || null,
      phone: phone || null,
      date_of_birth: dob || null,
      national_insurance_number: niNumber || null,
      personal_utr: personalUtr || null,
      shareholding_percentage: shareholding ? parseFloat(shareholding) : null,
      appointment_date: appointmentDate || null,
      ch_authentication_code: chAuthCode || null,
      ch_identity_verified: chVerified,
      is_primary: contacts.length === 0,
    })
    if (insertError) { setError(insertError.message) }
    else {
      setAdding(false)
      setName(''); setRole('director'); setEmail(''); setPhone('')
      setDob(''); setNiNumber(''); setPersonalUtr(''); setShareholding('')
      setAppointmentDate(''); setChAuthCode(''); setChVerified(false)
      fetchContacts()
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {contacts.length === 0 && !adding && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-4">No directors or contacts added yet</p>
          {can.addDirectors && (
            <button onClick={() => setAdding(true)}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              + Add Director
            </button>
          )}
        </div>
      )}

      {contacts.map((contact) => <ContactCard key={contact.id} contact={contact} />)}

      {adding && can.addDirectors && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Add Director / Contact</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Full name *', value: name, setter: setName, type: 'text', placeholder: 'John Smith' },
              { label: 'Email', value: email, setter: setEmail, type: 'email', placeholder: 'john@example.com' },
              { label: 'Phone', value: phone, setter: setPhone, type: 'text', placeholder: '07700 900000' },
              { label: 'Date of birth', value: dob, setter: setDob, type: 'date', placeholder: '' },
              { label: 'NI Number', value: niNumber, setter: setNiNumber, type: 'text', placeholder: 'AB123456C' },
              { label: 'Personal UTR', value: personalUtr, setter: setPersonalUtr, type: 'text', placeholder: '1234567890' },
              { label: 'Shareholding %', value: shareholding, setter: setShareholding, type: 'number', placeholder: '100' },
              { label: 'Appointment date', value: appointmentDate, setter: setAppointmentDate, type: 'date', placeholder: '' },
              { label: 'CH Authentication code', value: chAuthCode, setter: setChAuthCode, type: 'text', placeholder: '6 digit code' },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-brand-dark mb-1">{label}</label>
                <input type={type} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
                <option value="director">Director</option>
                <option value="owner">Owner</option>
                <option value="bookkeeper">Bookkeeper</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={chVerified} onChange={(e) => setChVerified(e.target.checked)} className="w-4 h-4 accent-brand-dark" />
            <span className="text-sm font-medium text-brand-dark">Companies House identity verified</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
              {saving ? 'Saving...' : 'Add director'}
            </button>
            <button onClick={() => setAdding(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-200 transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {contacts.length > 0 && !adding && can.addDirectors && (
        <button onClick={() => setAdding(true)}
          className="w-full bg-white border border-gray-200 text
