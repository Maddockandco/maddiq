'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClientTaxEditForm({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const [chAuthCode, setChAuthCode] = useState('')
  const [sicCode, setSicCode] = useState('')
  const [incorporationDate, setIncorporationDate] = useState('')
  const [accountingReferenceDate, setAccountingReferenceDate] = useState('')
  const [registeredAddress, setRegisteredAddress] = useState('')
  const [tradingAddress, setTradingAddress] = useState('')
  const [ctUtr, setCtUtr] = useState('')
  const [ctPaymentReference, setCtPaymentReference] = useState('')
  const [vatScheme, setVatScheme] = useState('')
  const [vatRegistrationDate, setVatRegistrationDate] = useState('')
  const [vatFlatRate, setVatFlatRate] = useState('')
  const [payeReference, setPayeReference] = useState('')
  const [accountsOfficeReference, setAccountsOfficeReference] = useState('')
  const [numberOfEmployees, setNumberOfEmployees] = useState('')
  const [payrollFrequency, setPayrollFrequency] = useState('')
  const [cisRegistered, setCisRegistered] = useState(false)
  const [cisUtr, setCisUtr] = useState('')
  const [autoEnrolment, setAutoEnrolment] = useState(false)
  const [pensionProvider, setPensionProvider] = useState('')
  const [pensionStagingDate, setPensionStagingDate] = useState('')
  const [personalUtr, setPersonalUtr] = useState('')
  const [niNumber, setNiNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [saStatus, setSaStatus] = useState('')
  const [studentLoan, setStudentLoan] = useState(false)
  const [studentLoanPlan, setStudentLoanPlan] = useState('')
  const [marriageAllowance, setMarriageAllowance] = useState(false)
  const [childBenefit, setChildBenefit] = useState(false)
  const [foreignIncome, setForeignIncome] = useState(false)
  const [bankName, setBankName] = useState('')
  const [sortCode, setSortCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [billingDay, setBillingDay] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      if (data) {
        setChAuthCode(data.ch_authentication_code || '')
        setSicCode(data.sic_code || '')
        setIncorporationDate(data.incorporation_date || '')
        setAccountingReferenceDate(data.accounting_reference_date || '')
        setRegisteredAddress(data.registered_address || '')
        setTradingAddress(data.trading_address || '')
        setCtUtr(data.ct_utr || '')
        setCtPaymentReference(data.ct_payment_reference || '')
        setVatScheme(data.vat_scheme || '')
        setVatRegistrationDate(data.vat_registration_date || '')
        setVatFlatRate(data.vat_flat_rate_percentage || '')
        setPayeReference(data.paye_reference || '')
        setAccountsOfficeReference(data.accounts_office_reference || '')
        setNumberOfEmployees(data.number_of_employees || '')
        setPayrollFrequency(data.payroll_frequency || '')
        setCisRegistered(data.cis_registered || false)
        setCisUtr(data.cis_utr || '')
        setAutoEnrolment(data.auto_enrolment || false)
        setPensionProvider(data.pension_provider || '')
        setPensionStagingDate(data.pension_staging_date || '')
        setPersonalUtr(data.personal_utr || '')
        setNiNumber(data.national_insurance_number || '')
        setDateOfBirth(data.date_of_birth || '')
        setSaStatus(data.sa_status || '')
        setStudentLoan(data.student_loan || false)
        setStudentLoanPlan(data.student_loan_plan || '')
        setMarriageAllowance(data.marriage_allowance || false)
        setChildBenefit(data.child_benefit || false)
        setForeignIncome(data.foreign_income || false)
        setBankName(data.bank_name || '')
        setSortCode(data.bank_sort_code || '')
        setAccountNumber(data.bank_account_number || '')
        setMonthlyFee(data.monthly_fee || '')
        setHourlyRate(data.hourly_rate || '')
        setBillingDay(data.billing_day || '')
        setPaymentMethod(data.payment_method || '')
      }
      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        ch_authentication_code: chAuthCode || null,
        sic_code: sicCode || null,
        incorporation_date: incorporationDate || null,
        accounting_reference_date: accountingReferenceDate || null,
        registered_address: registeredAddress || null,
        trading_address: tradingAddress || null,
        ct_utr: ctUtr || null,
        ct_payment_reference: ctPaymentReference || null,
        vat_scheme: vatScheme || null,
        vat_registration_date: vatRegistrationDate || null,
        vat_flat_rate_percentage: vatFlatRate || null,
        paye_reference: payeReference || null,
        accounts_office_reference: accountsOfficeReference || null,
        number_of_employees: numberOfEmployees || null,
        payroll_frequency: payrollFrequency || null,
        cis_registered: cisRegistered,
        cis_utr: cisUtr || null,
        auto_enrolment: autoEnrolment,
        pension_provider: pensionProvider || null,
        pension_staging_date: pensionStagingDate || null,
        personal_utr: personalUtr || null,
        national_insurance_number: niNumber || null,
        date_of_birth: dateOfBirth || null,
        sa_status: saStatus || null,
        student_loan: studentLoan,
        student_loan_plan: studentLoanPlan || null,
        marriage_allowance: marriageAllowance,
        child_benefit: childBenefit,
        foreign_income: foreignIncome,
        bank_name: bankName || null,
        bank_sort_code: sortCode || null,
        bank_account_number: accountNumber || null,
        monthly_fee: monthlyFee || null,
        hourly_rate: hourlyRate || null,
        billing_day: billingDay || null,
        payment_method: paymentMethod || null,
      })
      .eq('id', clientId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )

  const Field = ({ label, value, setter, type = 'text', placeholder = '' }: any) => (
    <div>
      <label className="block text-sm font-medium text-brand-dark mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
      />
    </div>
  )

  const Toggle = ({ label, value, setter }: any) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setter(e.target.checked)}
        className="w-4 h-4 accent-brand-dark"
      />
      <span className="text-sm font-medium text-brand-dark">{label}</span>
    </label>
  )

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Tax info saved successfully!</div>}

      <Section title="🏢 Companies House">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CH Authentication Code" value={chAuthCode} setter={setChAuthCode} placeholder="6 digit code" />
          <Field label="SIC Code" value={sicCode} setter={setSicCode} placeholder="62012" />
          <Field label="Incorporation Date" value={incorporationDate} setter={setIncorporationDate} type="date" />
          <Field label="Accounting Reference Date" value={accountingReferenceDate} setter={setAccountingReferenceDate} type="date" />
          <Field label="Registered Address" value={registeredAddress} setter={setRegisteredAddress} />
          <Field label="Trading Address" value={tradingAddress} setter={setTradingAddress} />
        </div>
      </Section>

      <Section title="💼 Corporation Tax">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CT UTR" value={ctUtr} setter={setCtUtr} placeholder="1234567890" />
          <Field label="CT Payment Reference" value={ctPaymentReference} setter={setCtPaymentReference} />
        </div>
      </Section>

      <Section title="🧾 VAT">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">VAT Scheme</label>
            <select value={vatScheme} onChange={(e) => setVatScheme(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              <option value="">Select scheme</option>
              <option value="standard">Standard</option>
              <option value="flat_rate">Flat Rate</option>
              <option value="cash_accounting">Cash Accounting</option>
              <option value="annual">Annual Accounting</option>
            </select>
          </div>
          <Field label="VAT Registration Date" value={vatRegistrationDate} setter={setVatRegistrationDate} type="date" />
          <Field label="Flat Rate %" value={vatFlatRate} setter={setVatFlatRate} type="number" placeholder="12.5" />
        </div>
      </Section>

      <Section title="👥 PAYE & Payroll">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PAYE Reference" value={payeReference} setter={setPayeReference} placeholder="123/AB456" />
          <Field label="Accounts Office Reference" value={accountsOfficeReference} setter={setAccountsOfficeReference} placeholder="123PA00012345" />
          <Field label="Number of Employees" value={numberOfEmployees} setter={setNumberOfEmployees} type="number" />
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Payroll Frequency</label>
            <select value={payrollFrequency} onChange={(e) => setPayrollFrequency(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              <option value="">Select frequency</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="four_weekly">Four Weekly</option>
            </select>
          </div>
          <Toggle label="Auto Enrolment" value={autoEnrolment} setter={setAutoEnrolment} />
          <Field label="Pension Provider" value={pensionProvider} setter={setPensionProvider} />
          <Field label="Pension Staging Date" value={pensionStagingDate} setter={setPensionStagingDate} type="date" />
        </div>
      </Section>

      <Section title="🏗️ CIS">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle label="CIS Registered" value={cisRegistered} setter={setCisRegistered} />
          <Field label="CIS UTR" value={cisUtr} setter={setCisUtr} placeholder="1234567890" />
        </div>
      </Section>

      <Section title="📊 Self Assessment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Personal UTR" value={personalUtr} setter={setPersonalUtr} placeholder="1234567890" />
          <Field label="National Insurance Number" value={niNumber} setter={setNiNumber} placeholder="AB123456C" />
          <Field label="Date of Birth" value={dateOfBirth} setter={setDateOfBirth} type="date" />
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">SA Status</label>
            <select value={saStatus} onChange={(e) => setSaStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              <option value="">Select status</option>
              <option value="active">Active</option>
              <option value="not_required">Not Required</option>
              <option value="dormant">Dormant</option>
            </select>
          </div>
          <Toggle label="Student Loan" value={studentLoan} setter={setStudentLoan} />
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Student Loan Plan</label>
            <select value={studentLoanPlan} onChange={(e) => setStudentLoanPlan(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              <option value="">Select plan</option>
              <option value="plan_1">Plan 1</option>
              <option value="plan_2">Plan 2</option>
              <option value="plan_4">Plan 4</option>
            </select>
          </div>
          <Toggle label="Marriage Allowance" value={marriageAllowance} setter={setMarriageAllowance} />
          <Toggle label="Child Benefit / High Income Charge" value={childBenefit} setter={setChildBenefit} />
          <Toggle label="Foreign Income" value={foreignIncome} setter={setForeignIncome} />
        </div>
      </Section>

      <Section title="🏦 Banking">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank Name" value={bankName} setter={setBankName} placeholder="Barclays" />
          <Field label="Sort Code" value={sortCode} setter={setSortCode} placeholder="00-00-00" />
          <Field label="Account Number" value={accountNumber} setter={setAccountNumber} placeholder="12345678" />
        </div>
      </Section>

      <Section title="💳 Billing">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Monthly Fee (£)" value={monthlyFee} setter={setMonthlyFee} type="number" placeholder="250" />
          <Field label="Hourly Rate (£)" value={hourlyRate} setter={setHourlyRate} type="number" placeholder="150" />
          <Field label="Billing Day" value={billingDay} setter={setBillingDay} type="number" placeholder="1" />
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
              <option value="">Select method</option>
              <option value="dd">Direct Debit</option>
              <option value="bacs">BACS</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
      </Section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-brand-dark text-white font-semibold py-3 rounded-xl hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
      >
        {saving ? 'Saving...' : 'Save tax info'}
      </button>
    </div>
  )
}
