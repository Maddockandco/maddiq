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
  const [contactRole, setContactRole] = useState('director')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [niNumber, setNiNumber] = useState('')
  const [personalUtr, setPersonalUtr] = useState('')
  const [shareholding, setShareholding] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [chAuthCode, setChAuthCode] = useState('')
  const [chVerified, setChVerified] = useState(false)
  const [createDLA, setCreateDLA] = useState(false)
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
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    const { data: inserted, error: insertError } = await supabase.from('client_contacts').insert({
      client_id: clientId,
      firm_id: firmUser!.firm_id,
      name,
      role: contactRole,
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
    }).select().single()

    if (insertError) {
      setError(insertError.message)
    } else {
      if (createDLA) {
        const { data: existingCodes } = await supabase
          .from('chart_of_accounts')
          .select('code')
          .eq('client_id', clientId)
          .gte('code', '2200')
          .lte('code', '2299')

        let nextCode = 2200
        if (existingCodes && existingCodes.length > 0) {
          const numericCodes = existingCodes.map((a) => parseInt(a.code, 10)).filter((n) => !isNaN(n))
          if (numericCodes.length > 0) nextCode = Math.max(...numericCodes) + 1
        }

        const loanCode = String(nextCode).padStart(4, '0')
        const currentCode = String(nextCode + 1).padStart(4, '0')

        await supabase.from('chart_of_accounts').insert([
          {
            firm_id: firmUser!.firm_id,
            client_id: clientId,
            code: loanCode,
            name: `${name} - Director's Loan Account`,
            account_type: 'current_liability',
          },
          {
            firm_id: firmUser!.firm_id,
            client_id: clientId,
            code: currentCode,
            name: `${name} - Director's Current Account`,
            account_type: 'current_liability',
          },
        ])
      }

      setAdding(false)
      setName(''); setContactRole('director'); setEmail(''); setPhone('')
      setDob(''); setNiNumber(''); setPersonalUtr(''); setShareholding('')
      setAppointmentDate(''); setChAuthCode(''); setChVerified(false); setCreateDLA(false)
      fetchContacts()
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  )

  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

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

      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}

      {adding && can.addDirectors && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Add Director / Contact</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Full name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="John Smith" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Role</label>
              <select value={contactRole} onChange={(e) => setContactRole(e.target.value)} className={inputClass}>
                <option value="director">Director</option>
                <option value="owner">Owner</option>
                <option value="partner">Partner</option>
                <option value="bookkeeper">Bookkeeper</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900000" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Date of birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">NI Number</label>
              <input type="text" value={niNumber} onChange={(e) => setNiNumber(e.target.value)}
                placeholder="AB123456C" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Personal UTR</label>
              <input type="text" value={personalUtr} onChange={(e) => setPersonalUtr(e.target.value)}
                placeholder="1234567890" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Shareholding %</label>
              <input type="number" value={shareholding} onChange={(e) => setShareholding(e.target.value)}
                placeholder="100" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Appointment date</label>
              <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">CH Authentication code</label>
              <input type="text" value={chAuthCode} onChange={(e) => setChAuthCode(e.target.value)}
                placeholder="6 digit code" className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={chVerified} onChange={(e) => setChVerified(e.target.checked)}
              className="w-4 h-4 accent-brand-dark" />
            <span className="text-sm font-medium text-brand-dark">Companies House identity verified</span>
          </label>
          {['director', 'owner'].includes(contactRole) && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={createDLA} onChange={(e) => setCreateDLA(e.target.checked)}
                className="w-4 h-4 accent-brand-dark" />
              <span className="text-sm font-medium text-brand-dark">Create Director's Loan Account & Current Account in Chart of Accounts</span>
            </label>
          )}
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
          className="w-full bg-white border border-gray-200 text-brand-dark font-semibold py-3 rounded-xl text-sm hover:bg-brand-light transition">
          + Add another director
        </button>
      )}
    </div>
  )
}
