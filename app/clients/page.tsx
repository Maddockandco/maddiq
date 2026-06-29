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
  const [directorsToCreate, setDirectorsToCreate] = useState<string[]>([])
  const [chFound, setChFound] = useState(false)

  // Individual fields
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

  function handleCompanyFound(data: any) {
    setName(data.name || '')
    setCompanyNumber(data.company_number || '')
    setRegisteredAddress(data.registered_address || '')
    setIncorporationDate(data.incorporated_on || '')
    setSicCode(data.sic_codes?.[0] || '')
    setDirectors(data.directors || [])
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

    // Create the main client
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

    // Add directors as contacts
    for (const director of directors) {
      let linkedClientId = null

      // Create individual client record if ticked
      if (directorsToCreate.includes(director.name)) {
        const nameParts = director.name.split(', ')
        const formattedName = nameParts.length > 1
          ? `${nameParts[1]} ${nameParts[0]}`
          : director.name

        const { data: individualClient } = await supabase
          .from('clients')
          .insert({
            firm_id: firmUser.firm_id,
            name: formattedName,
            type: 'individual',
            status: status,
            date_of_birth: director.date_of_birth
              ? `${director.date_of_birth}-01`
              : null,
          })
          .select()
          .single()

        if (individualClient) {
          linkedClientId = individualClient.id
        }
      }

      // Add as contact on company record
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

    window.location.href = '/clients'
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

          {/* Companies House Lookup */}
          {type === 'company' && (
            <CompanyLookup onFound={handleCompanyFound} />
          )}

          {/* Directors found — with option to create as individual clients */}
          {chFound && directors.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-green-700">
                ✅ {directors.length} director{directors.length > 1 ? 's' : ''} found
              </p>
              <p className="text-xs text-green-600">
                Tick any directors you'd like to also create as individual client records:
              </p>
              {directors.map((d, i) => {
                const nameParts = d.name.split(', ')
                const formattedName = nameParts.length > 1
                  ? `${nameParts[1]} ${nameParts[0]}`
                  : d.name
                return (
                  <label key={i} className="flex items-center gap-3 cursor-pointer bg-white rounded-lg p-3 border border-green-100">
                    <input
                      type="checkbox"
                      checked={directorsToCreate.includes(d.name)}
                      onChange={() => toggleDirectorCreate(d.name)}
                      className="w-4 h-4 accent-brand-dark"
                    />
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
