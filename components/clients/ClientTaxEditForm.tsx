'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Field, Toggle, Section, SelectField } from '@/components/clients/TaxSections'
import { useRole } from '@/hooks/useRole'

export default function ClientTaxEditForm({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { role, loading: roleLoading } = useRole()
  const supabase = createClient()
  const isPayrollOnly = role === 'payroll_manager'

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
  const [cisStatus, setCisStatus] = useState('')
  const [cisGrossPayment, setCisGrossPayment] = useState(false)
  const [cisTaxRate, setCisTaxRate] = useState('')
  const [cisVerificationNumber, setCisVerificationNumber] = useState('')
  const [cisGrossPaymentDate, setCisGrossPaymentDate] = useState('')
  const [autoEnrolment, setAutoEnrolment] = useState(false)
  const [pensionProvider, setPensionProvider] = useState('')
  const [pensionStagingDate, setPensionStagingDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [sortCode, setSortCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [billingDay, setBillingDay] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
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
        setCisStatus(data.cis_status || '')
        setCisGrossPayment(data.cis_gross_payment_status || false)
        setCisTaxRate(data.cis_tax_rate || '')
        setCisVerificationNumber(data.cis_verification_number || '')
        setCisGrossPaymentDate(data.cis_gross_payment_date || '')
        setAutoEnrolment(data.auto_enrolment || false)
        setPensionProvider(data.pension_provider || '')
        setPensionStagingDate(data.pension_staging_date || '')
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
    const updateData: any = {
      paye_reference: payeReference || null,
      accounts_office_reference: accountsOfficeReference || null,
      number_of_employees: numberOfEmployees || null,
      payroll_frequency: payrollFrequency || null,
      cis_registered: cisRegistered,
      cis_utr: cisUtr || null,
      cis_status: cisStatus || null,
      cis_gross_payment_status: cisGrossPayment,
      cis_tax_rate: cisTaxRate || null,
      cis_verification_number: cisVerificationNumber || null,
      cis_gross_payment_date: cisGrossPaymentDate || null,
      auto_enrolment: autoEnrolment,
      pension_provider: pensionProvider || null,
      pension_staging_date: pensionStagingDate || null,
    }
    if (!isPayrollOnly) {
      updateData.ch_authentication_code = chAuthCode || null
      updateData.sic_code = sicCode || null
      updateData.incorporation_date = incorporationDate || null
      updateData.accounting_reference_date = accountingReferenceDate || null
      updateData.registered_address = registeredAddress || null
      updateData.trading_address = tradingAddress || null
      updateData.ct_utr = ctUtr || null
      updateData.ct_payment_reference = ctPaymentReference || null
      updateData.vat_scheme = vatScheme || null
      updateData.vat_registration_date = vatRegistrationDate || null
      updateData.vat_flat_rate_percentage = vatFlatRate || null
      updateData.bank_name = bankName || null
      updateData.bank_sort_code = sortCode || null
      updateData.bank_account_number = accountNumber || null
      updateData.monthly_fee = monthlyFee || null
      updateData.hourly_rate = hourlyRate || null
      updateData.billing_day = billingDay || null
      updateData.payment_method = paymentMethod || null
    }
    const { error: updateError } = await supabase.from('clients').update(updateData).eq('id', clientId)
    if (updateError) { setError(updateError.message) } else { setSuccess(true) }
    setSaving(false)
  }

  if (loading || roleLoading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Tax info saved!</div>}

      {!isPayrollOnly && (
        <>
          <Section title="Companies House">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="CH Authentication Code" value={chAuthCode} setter={setChAuthCode} placeholder="6 digit code" />
              <Field label="SIC Code" value={sicCode} setter={setSicCode} placeholder="62012" />
              <Field label="Incorporation Date" value={incorporationDate} setter={setIncorporationDate} type="date" />
              <Field label="Accounting Reference Date" value={accountingReferenceDate} setter={setAccountingReferenceDate} />
              <Field label="Registered Address" value={registeredAddress} setter={setRegisteredAddress} />
              <Field label="Trading Address" value={tradingAddress} setter={setTradingAddress} />
            </div>
          </Section>
          <Section title="Corporation Tax">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="CT UTR" value={ctUtr} setter={setCtUtr} placeholder="1234567890" />
              <Field label="CT Payment Reference" value={ctPaymentReference} setter={setCtPaymentReference} />
            </div>
          </Section>
          <Section title="VAT">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField label="VAT Scheme" value={vatScheme} setter={setVatScheme} options={[
                { value: '', label: 'Select scheme' },
                { value: 'standard', label: 'Standard' },
                { value: 'flat_rate', label: 'Flat Rate' },
                { value: 'cash_accounting', label: 'Cash Accounting' },
                { value: 'annual', label: 'Annual Accounting' },
              ]} />
              <Field label="VAT Registration Date" value={vatRegistrationDate} setter={setVatRegistrationDate} type="date" />
              <Field label="Flat Rate %" value={vatFlatRate} setter={setVatFlatRate} type="number" placeholder="12.5" />
            </div>
          </Section>
        </>
      )}

      <Section title="PAYE & Payroll">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PAYE Reference" value={payeReference} setter={setPayeReference} placeholder="123/AB456" />
          <Field label="Accounts Office Reference" value={accountsOfficeReference} setter={setAccountsOfficeReference} placeholder="123PA00012345" />
          <Field label="Number of Employees" value={numberOfEmployees} setter={setNumberOfEmployees} type="number" />
          <SelectField label="Payroll Frequency" value={payrollFrequency} setter={setPayrollFrequency} options={[
            { value: '', label: 'Select frequency' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'four_weekly', label: 'Four Weekly' },
          ]} />
          <Toggle label="Auto Enrolment" value={autoEnrolment} setter={setAutoEnrolment} />
          <Field label="Pension Provider" value={pensionProvider} setter={setPensionProvider} />
          <Field label="Pension Staging Date" value={pensionStagingDate} setter={setPensionStagingDate} type="date" />
        </div>
      </Section>

      <Section title="CIS">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle label="CIS Registered" value={cisRegistered} setter={setCisRegistered} />
          <SelectField label="CIS Status" value={cisStatus} setter={setCisStatus} options={[
            { value: '', label: 'Select CIS status' },
            { value: 'contractor', label: 'Contractor' },
            { value: 'subcontractor', label: 'Subcontractor' },
            { value: 'both', label: 'Both Contractor & Subcontractor' },
          ]} />
          <SelectField label="CIS Tax Rate" value={cisTaxRate} setter={setCisTaxRate} options={[
            { value: '', label: 'Select tax rate' },
            { value: 'gross', label: 'Gross (0%) — Gross Payment Status' },
            { value: 'standard', label: 'Standard (20%)' },
            { value: 'higher', label: 'Higher (30%) — Unverified' },
          ]} />
          <Toggle label="Gross Payment Status" value={cisGrossPayment} setter={setCisGrossPayment} />
          <Field label="Gross Payment Date" value={cisGrossPaymentDate} setter={setCisGrossPaymentDate} type="date" />
          <Field label="CIS Verification Number" value={cisVerificationNumber} setter={setCisVerificationNumber} placeholder="V0000000000" />
          <Field label="CIS UTR" value={cisUtr} setter={setCisUtr} placeholder="1234567890" />
        </div>
      </Section>

      {!isPayrollOnly && (
        <>
          <Section title="Banking">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bank Name" value={bankName} setter={setBankName} placeholder="Barclays" />
              <Field label="Sort Code" value={sortCode} setter={setSortCode} placeholder="00-00-00" />
              <Field label="Account Number" value={accountNumber} setter={setAccountNumber} placeholder="12345678" />
            </div>
          </Section>
          <Section title="Billing">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Monthly Fee (£)" value={monthlyFee} setter={setMonthlyFee} type="number" placeholder="250" />
              <Field label="Hourly Rate (£)" value={hourlyRate} setter={setHourlyRate} type="number" placeholder="150" />
              <Field label="Billing Day" value={billingDay} setter={setBillingDay} type="number" placeholder="1" />
              <SelectField label="Payment Method" value={paymentMethod} setter={setPaymentMethod} options={[
                { value: '', label: 'Select method' },
                { value: 'dd', label: 'Direct Debit' },
                { value: 'bacs', label: 'BACS' },
                { value: 'card', label: 'Card' },
              ]} />
            </div>
          </Section>
        </>
      )}

      <button onClick={handleSave} disabled={saving} className="w-full bg-brand-dark text-white font-semibold py-3 rounded-xl hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
        {saving ? 'Saving...' : 'Save tax info'}
      </button>
    </div>
  )
}
