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
