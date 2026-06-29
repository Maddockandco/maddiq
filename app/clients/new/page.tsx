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

    // Add directors as contacts for companies
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

          {/* Companies House Lookup — companies only */}
          {type === 'company' && (
            <CompanyLookup onFound={handleCompanyFound} />
          )}

          {/* CH Found confirmation */}
          {chFound && directors.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">
                ✅ Company found — {directors.length} director{directors.length > 1 ? 's' : ''} will be imported
              </p>
              {directors.map((d, i) => (
                <p key={i} className="text-xs text-green-600">👤 {d.name}</p>
              ))}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              {type === 'company' ? 'Company name' : 'Full legal name'} *
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === 'company' ? 'Acme Ltd' : 'John Smith'}
              className={inputClass} />
          </div>

          {/* Company specific fields */}
          {type === 'company' && (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Companies House number</label>
                <input type="text" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)}
                  placeholder="12345678" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Year end date</label>
                <input type="date" value={yearEndDate} onChange={(e) => setYearEndDate(e.target.value)}
                  className={inputClass} />
              </div>
            </>
          )}

          {/* Individual specific fields */}
          {type === 'individual' && (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Date of birth</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                  className={inputClass} />
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

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="prospect">Prospect</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="offboarded">Offboarded</option>
            </select>
          </div>

          {/* Common fields */}
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

          {/* VAT — both company and individual can be VAT registered */}
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
  )
}
