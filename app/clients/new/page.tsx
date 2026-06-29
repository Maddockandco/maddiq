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
  const [nextAccountsDue, setNextAccountsDue] = useState('')
  const [nextConfirmationDue, setNextConfirmationDue] = useState('')
  const [directors, setDirectors] = useState<any[]>([])
  const [directorsToCreate, setDirectorsToCreate] = useState<string[]>([])
  const [chFound, setChFound] = useState(false)
  const [existingClientId, setExistingClientId] = useState<string | null>(null)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [niNumber, setNiNumber] = useState('')
  const [personalUtr, setPersonalUtr] = useState('')
  const [saStatus, setSaStatus] = useState('')
  const [studentLoan, setStudentLoan] = useState(false)
  const [studentLoanPlan, setStudentLoanPlan] = useState('')
  const [marriageAllowance, setMarriageAllowance] = useState(false)
  const [childBenefit, setChildBenefit] = useState(false)
  const [foreignIncome, setForeignIncome] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleCompanyFound(data: any) {
    const { data: existingList } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_number', data.company_number)
      .limit(1)

    const existing = existingList?.[0] || null

    if (existing) {
      setExistingClientId(existing.id)
      setDirectors(data.directors || [])
      setChFound(true)
      setName(data.name || '')
      setCompanyNumber(data.company_number || '')
      return
    }

    setExistingClientId(null)
    setName(data.name || '')
    setCompanyNumber(data.company_number || '')
    setRegisteredAddress(data.registered_address || '')
    setIncorporationDate(data.incorporated_on || '')
    setSicCode(data.sic_codes?.[0] || '')
    setDirectors(data.directors || [])
    setNextAccountsDue(data.next_accounts_due || '')
    setNextConfirmationDue(data.next_confirmation_due || '')
    setChFound(true)
    if (data.accounting_reference_date) {
      const [day, month] = data.accounting_reference_date.split('/')
      const year = new Date().getFullYear()
      setYearEndDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    }
  }

  function toggleDirectorCreate(directorName: string) {
    setDirectorsToCreate(prev =>
      prev.includes(directorName)
        ? prev.filter(n => n !== directorName)
        : [...prev, directorName]
    )
  }

  async function handleImportDirectorsOnly() {
    if (!existingClientId) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) { setError('Could not find your firm'); setLoading(false); return }

    for (const director of directors) {
      let linkedClientId = null
      if (directorsToCreate.includes(director.name)) {
        const nameParts = director.name.split(', ')
        const formattedName = nameParts.length > 1 ? `${nameParts[1]} ${nameParts[0]}` : director.name
        const { data: individualClient } = await supabase
          .from('clients')
          .insert({
            firm_id: firmUser.firm_id,
            name: formattedName,
            type: 'individual',
            status: 'active',
            date_of_birth: director.date_of_birth ? `${director.date_of_birth}-01` : null,
          })
          .select()
          .single()
        if (individualClient) linkedClientId = individualClient.id
      }
      await supabase.from('client_contacts').insert({
        client_id: existingClientId,
        firm_id: firmUser.firm_id,
        name: director.name,
        role: 'director',
        appointment_date: director.appointment_date || null,
        is_primary: directors.indexOf(director) === 0,
        linked_client_id: linkedClientId,
      })
    }
    window.location.replace('/clients')
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    if (!name) { setError('Client name is required'); setLoading(false); return }

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
        name, type, status,
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
        next_accounts_due: nextAccountsDue || null,
        next_confirmation_due: nextConfirmationDue || null,
        date_of_birth: dateOfBirth || null,
        national_insurance_number: niNumber || null,
        personal_utr: personalUtr || null,
        sa_status: saStatus || null,
        student_loan: studentLoan,
        student_loan_plan: studentLoanPlan || null,
        marriage_allowance: marriageAllowance,
        child_benefit: childBenefit,
        foreign_income: foreignIncome,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setLoading(false); return }

    for (const director of directors) {
      let linkedClientId = null
      if (directorsToCreate.includes(director.name)) {
        const nameParts = director.name.split(', ')
        const formattedName = nameParts.length > 1 ? `${nameParts[1]} ${nameParts[0]}` : director.name
        const { data: individualClient } = await supabase
          .from('clients')
          .insert({
            firm_id: firmUser.firm_id,
            name: formattedName,
            type: 'individual',
            status: status,
            date_of_birth: director.date_of_birth ? `${director.date_of_birth}-01` : null,
          })
          .select()
          .single()
        if (individualClient) linkedClientId = individualClient.id
      }
      await supabase.from('client_contacts').insert({
        client_id: client.id,
        firm_id: firmUser.firm_id,
        name: director.name,
        role: 'director',
        appointment_date: director.appointment_date || null,
        is_primary: directors.indexOf(director) === 0,
        linked_client_id: linkedClientId,
      })
    }

    window.location.replace('/clients')
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const selectClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to clients
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-brand-dark mb-8">Add new client</h1>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">Client type</label>
            <div className="flex gap-4">
              {['company', 'individual'].map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                    type === t ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {type === 'company' && <CompanyLookup onFound={handleCompanyFound} />}

          {/* Existing company warning */}
          {existingClientId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-700">⚠️ This company already exists in Maddiq</p>
              <p className="text-xs text-amber-600">
                <strong>{name}</strong> is already a client. You can import directors only instead of creating a duplicate.
              </p>
              {directors.length > 0 && (
                <>
                  <p className="text-xs text-amber-600 font-medium">Select directors to import:</p>
                  {directors.map((d, i) => {
                    const nameParts = d.name.split(', ')
                    const formattedName = nameParts.length > 1 ? `${nameParts[1]} ${nameParts[0]}` : d.name
                    return (
                      <label key={i} className="flex items-center gap-3 cursor-pointer bg-white rounded-lg p-3 border border-amber-100">
                        <input type="checkbox" checked={directorsToCreate.includes(d.name)}
                          onChange={() => toggleDirectorCreate(d.name)} className="w-4 h-4 accent-brand-dark" />
                        <div>
                          <p className="text-sm font-medium text-brand-dark">👤 {formattedName}</p>
                          <p className="text-xs text-gray-500">Director since {d.appointment_date || 'unknown'}</p>
                          {directorsToCreate.includes(d.name) && (
                            <p className="text-xs text-green-600 mt-0.5">✅ Will be created as individual client</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={handleImportDirectorsOnly} disabled={loading}
                  className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                  {loading ? 'Importing...' : 'Import directors only'}
                </button>
                <Link href="/clients" className="flex-1 text-center bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                  Cancel
                </Link>
              </div>
            </div>
          )}

          {!existingClientId && (
            <>
              {chFound && directors.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-green-700">
                    ✅ {directors.length} director{directors.length > 1 ? 's' : ''} found
                  </p>
                  {nextAccountsDue && (
                    <p className="text-xs text-green-600">📅 Next accounts due: <strong>{new Date(nextAccountsDue).toLocaleDateString('en-GB')}</strong> (from Companies House)</p>
                  )}
                  {nextConfirmationDue && (
                    <p className="text-xs text-green-600">📅 Next confirmation due: <strong>{new Date(nextConfirmationDue).toLocaleDateString('en-GB')}</strong> (from Companies House)</p>
                  )}
                  <p className="text-xs text-green-600">Tick any directors to also create as individual client records:</p>
                  {directors.map((d, i) => {
                    const nameParts = d.name.split(', ')
                    const formattedName = nameParts.length > 1 ? `${nameParts[1]} ${nameParts[0]}` : d.name
                    return (
                      <label key={i} className="flex items-center gap-3 cursor-pointer bg-white rounded-lg p-3 border border-green-100">
                        <input type="checkbox" checked={directorsToCreate.includes(d.name)}
                          onChange={() => toggleDirectorCreate(d.name)} className="w-4 h-4 accent-brand-dark" />
                        <div>
                          <p className="text-sm font-medium text-brand-dark">👤 {formattedName}</p>
                          <p className="text-xs text-gray-500">
                            Director since {d.appointment_date || 'unknown'}
                            {d.date_of_birth ? ` · DOB: ${d.date_of_birth}` : ''}
                          </p>
                          {directorsToCreate.includes(d.name) && (
                            <p className="text-xs text-green-600 mt-0.5">✅ Will be created as individual client</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">
                  {type === 'company' ? 'Company name' : 'Full legal name'} *
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'company' ? 'Acme Ltd' : 'John Smith'} className={inputClass} />
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

              {type === 'individual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">Date of birth</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">National Insurance number</label>
                    <input type="text" value={niNumber} onChange={(e) => setNiNumber(e.target.value)}
                      placeholder="AB123456C" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">Personal UTR</label>
                    <input type="text" value={personalUtr} onChange={(e) => setPersonalUtr(e.target.value)}
                      placeholder="1234567890" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">Self Assessment status</label>
                    <select value={saStatus} onChange={(e) => setSaStatus(e.target.value)} className={selectClass}>
                      <option value="">Select status</option>
                      <option value="active">Active</option>
                      <option value="not_required">Not Required</option>
                      <option value="dormant">Dormant</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={studentLoan} onChange={(e) => setStudentLoan(e.target.checked)}
                        className="w-4 h-4 accent-brand-dark" />
                      <span className="text-sm font-medium text-brand-dark">Student loan</span>
                    </label>
                    {studentLoan && (
                      <select value={studentLoanPlan} onChange={(e) => setStudentLoanPlan(e.target.value)} className={selectClass}>
                        <option value="">Select plan</option>
                        <option value="plan_1">Plan 1</option>
                        <option value="plan_2">Plan 2</option>
                        <option value="plan_4">Plan 4</option>
                      </select>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={marriageAllowance} onChange={(e) => setMarriageAllowance(e.target.checked)}
                        className="w-4 h-4 accent-brand-dark" />
                      <span className="text-sm font-medium text-brand-dark">Marriage allowance</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={childBenefit} onChange={(e) => setChildBenefit(e.target.checked)}
                        className="w-4 h-4 accent-brand-dark" />
                      <span className="text-sm font-medium text-brand-dark">Child benefit / high income charge</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={foreignIncome} onChange={(e) => setForeignIncome(e.target.checked)}
                        className="w-4 h-4 accent-brand-dark" />
                      <span className="text-sm font-medium text-brand-dark">Foreign income</span>
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  <option value="prospect">Prospect</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Active</option>
                  <option value="offboarded">Offboarded</option>
                </select>
              </div>

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

              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
                {loading ? 'Saving...' : 'Save client'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
