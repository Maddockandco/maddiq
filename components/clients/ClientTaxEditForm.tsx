'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Field, Toggle, Section, SelectField } from '@/components/clients/TaxSections'

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
