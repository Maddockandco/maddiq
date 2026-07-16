'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  isOpen: boolean
  clientId: string
  context?: 'purchase' | 'sales'
  onCreated: (account: any) => void
  onCancel: () => void
}

const PURCHASE_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'direct_costs', label: 'Direct Costs (Cost of Sales)' },
  { value: 'fixed_asset', label: 'Fixed Asset (at Cost)' },
]

const SALES_TYPE_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'other_income', label: 'Other Income' },
]

export default function AddAccountModal({ isOpen, clientId, context = 'purchase', onCreated, onCancel }: Props) {
  const supabase = createClient()
  const typeOptions = context === 'sales' ? SALES_TYPE_OPTIONS : PURCHASE_TYPE_OPTIONS
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState(typeOptions[0].value)
  const [vatRateId, setVatRateId] = useState('')
  const [vatRates, setVatRates] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [nameWarning, setNameWarning] = useState('')
  const [checkingCode, setCheckingCode] = useState(false)
  const [checkingName, setCheckingName] = useState(false)

  const [allAccountNames, setAllAccountNames] = useState<{ code: string; name: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      setAccountType(typeOptions[0].value)
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
        if (data) setVatRates(data)
      })
      supabase.from('chart_of_accounts').select('code, name').eq('client_id', clientId).then(({ data }) => {
        if (data) setAllAccountNames(data)
      })
    }
  }, [isOpen, context])

  useEffect(() => {
    if (!code.trim()) { setCodeError(''); return }
    setCheckingCode(true)
    const timeout = setTimeout(async () => {
      const { data, error: checkErr } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('client_id', clientId)
        .eq('code', code.trim())
        .limit(1)
      if (!checkErr && data && data.length > 0) {
        setCodeError(`Account code ${code.trim()} already exists`)
      } else {
        setCodeError('')
      }
      setCheckingCode(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [code, clientId])

  useEffect(() => {
    if (!name.trim() || name.trim().length < 3) { setNameWarning(''); return }
    setCheckingName(true)
    const timeout = setTimeout(() => {
      const typed = name.trim().toLowerCase()
      const match = allAccountNames.find((a) => {
        const existing = a.name.toLowerCase()
        return existing.includes(typed) || typed.includes(existing)
      })
      if (match) {
        setNameWarning(`A possibly similar account "${match.name}" (${match.code}) already exists — you can still create this one if you genuinely need a separate account.`)
      } else {
        setNameWarning('')
      }
      setCheckingName(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [name, allAccountNames])

  if (!isOpen) return null

  function reset() {
    setCode('')
    setName('')
    setAccountType(typeOptions[0].value)
    setVatRateId('')
    setError('')
    setCodeError('')
    setNameWarning('')
  }

  function relevantVatRates() {
    const universal = ['no_vat']
    if (context === 'sales') {
      const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']
      return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
    }
    const expenseOnly = ['reverse_charge_expense_20', 'reverse_charge_construction', 'vat_on_imports', 'ec_acquisitions_20', 'ec_acquisitions_zero']
    return vatRates.filter((r) => r.code.endsWith('_expense') || universal.includes(r.code) || expenseOnly.includes(r.code))
  }

  async function handleSave() {
    if (!code.trim() || !name.trim()) { setError('Code and name are required'); return }
    if (accountType !== 'fixed_asset' && !vatRateId) { setError('Select a VAT rate'); return }
    if (codeError) { setError(codeError); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { data: existingRows, error: checkError } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('client_id', clientId)
      .eq('code', code.trim())
      .limit(1)

    if (checkError) { setError(`Could not check for duplicate codes: ${checkError.message}`); setSaving(false); return }
    if (existingRows && existingRows.length > 0) { setError(`Account code ${code.trim()} already exists`); setSaving(false); return }

    const { data: account, error: insertError } = await supabase
      .from('chart_of_accounts')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        code: code.trim(),
        name: name.trim(),
        account_type: accountType,
        default_vat_rate_id: accountType !== 'fixed_asset' ? (vatRateId || null) : null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    setSaving(false)
    reset()
    onCreated(account)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-dark">New Account</h3>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} ${codeError ? 'border-red-400' : ''}`}
              autoFocus
            />
            {checkingCode && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {!checkingCode && codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
              {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} ${nameWarning ? 'border-amber-400' : ''}`}
            placeholder={context === 'sales' ? 'e.g. Consulting Income' : 'e.g. Small Tools & Equipment'}
          />
          {checkingName && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
          {!checkingName && nameWarning && <p className="text-xs text-amber-600 mt-1">{nameWarning}</p>}
        </div>
        {accountType !== 'fixed_asset' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">VAT rate</label>
            <select value={vatRateId} onChange={(e) => setVatRateId(e.target.value)} className={inputClass}>
              <option value="">Select VAT rate</option>
              {relevantVatRates().map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || checkingCode}
            className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Account'}
          </button>
          <button
            onClick={() => { reset(); onCancel() }}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
