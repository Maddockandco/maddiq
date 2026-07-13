'use client'

import { useEffect, useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import { detectIndustry } from '@/lib/industryDetection'
import ConfirmModal from '@/components/ui/ConfirmModal'

const ACCOUNT_TYPE_GROUPS = [
  {
    group: 'Assets',
    options: [
      { value: 'bank', label: 'Bank' },
      { value: 'current_asset', label: 'Current Asset' },
      { value: 'fixed_asset', label: 'Fixed Asset' },
      { value: 'inventory', label: 'Inventory' },
      { value: 'non_current_asset', label: 'Non-current Asset' },
      { value: 'prepayment', label: 'Prepayment' },
    ],
  },
  {
    group: 'Liabilities',
    options: [
      { value: 'current_liability', label: 'Current Liability' },
      { value: 'non_current_liability', label: 'Non-current Liability' },
      { value: 'liability', label: 'Liability' },
    ],
  },
  {
    group: 'Equity',
    options: [
      { value: 'equity', label: 'Equity' },
    ],
  },
  {
    group: 'Expenses',
    options: [
      { value: 'direct_costs', label: 'Direct Costs' },
      { value: 'expense', label: 'Expense' },
      { value: 'overhead', label: 'Overhead' },
      { value: 'depreciation', label: 'Depreciation' },
    ],
  },
  {
    group: 'Income',
    options: [
      { value: 'sales', label: 'Sales' },
      { value: 'revenue', label: 'Revenue' },
      { value: 'other_income', label: 'Other Income' },
    ],
  },
]

const TYPE_TO_CATEGORY: Record<string, string> = {
  bank: 'asset', current_asset: 'asset', fixed_asset: 'asset', inventory: 'asset', non_current_asset: 'asset', prepayment: 'asset',
  current_liability: 'liability', non_current_liability: 'liability', liability: 'liability',
  equity: 'equity',
  direct_costs: 'expense', expense: 'expense', overhead: 'expense', depreciation: 'expense',
  sales: 'income', revenue: 'income', other_income: 'income',
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank', current_asset: 'Current Asset', fixed_asset: 'Fixed Asset', inventory: 'Inventory',
  non_current_asset: 'Non-current Asset', prepayment: 'Prepayment',
  current_liability: 'Current Liability', non_current_liability: 'Non-current Liability', liability: 'Liability',
  equity: 'Equity',
  direct_costs: 'Direct Costs', expense: 'Expense', overhead: 'Overhead', depreciation: 'Depreciation',
  sales: 'Sales', revenue: 'Revenue', other_income: 'Other Income',
}

const TYPE_STYLES: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  income: 'bg-green-100 text-green-700',
  expense: 'bg-amber-100 text-amber-700',
}

type TemplateAccount = { code: string; name: string; account_type: string }

const INDUSTRY_TEMPLATES: Record<string, { label: string; description: string; vatSchemes: string[]; accounts: TemplateAccount[] }> = {
  general: {
    label: 'General / Professional Services',
    description: 'Consultancy, agencies, and general small businesses',
    vatSchemes: ['standard'],
    accounts: [
      { code: '1000', name: 'Bank Current Account', account_type: 'bank' },
      { code: '1100', name: 'Trade Debtors', account_type: 'current_asset' },
      { code: '1200', name: 'Prepayments', account_type: 'prepayment' },
      { code: '2000', name: 'Trade Creditors', account_type: 'current_liability' },
      { code: '2100', name: 'VAT Control Account', account_type: 'current_liability' },
      { code: '3000', name: 'Capital Introduced', account_type: 'equity' },
      { code: '4000', name: 'Sales / Fees', account_type: 'sales' },
      { code: '5000', name: 'Cost of Sales', account_type: 'direct_costs' },
      { code: '6000', name: 'General Expenses', account_type: 'overhead' },
      { code: '6100', name: 'Professional Fees', account_type: 'overhead' },
      { code: '6200', name: 'Software & Subscriptions', account_type: 'overhead' },
      { code: '6300', name: 'Travel & Subsistence', account_type: 'overhead' },
    ],
  },
  hospitality: {
    label: 'Hospitality',
    description: 'Restaurants, bars, cafes, and hotels',
    vatSchemes: ['standard'],
    accounts: [
      { code: '1000', name: 'Bank Current Account', account_type: 'bank' },
      { code: '1010', name: 'Till / Cash Account', account_type: 'bank' },
      { code: '1100', name: 'Trade Debtors', account_type: 'current_asset' },
      { code: '1300', name: 'Stock — Food & Beverage', account_type: 'inventory' },
      { code: '2000', name: 'Trade Creditors', account_type: 'current_liability' },
      { code: '2100', name: 'VAT Control Account', account_type: 'current_liability' },
      { code: '3000', name: 'Capital Introduced', account_type: 'equity' },
      { code: '4000', name: 'Food Sales', account_type: 'sales' },
      { code: '4010', name: 'Beverage Sales', account_type: 'sales' },
      { code: '4020', name: 'Room / Accommodation Sales', account_type: 'sales' },
      { code: '4030', name: 'Service Charge Income', account_type: 'sales' },
      { code: '5000', name: 'Cost of Sales — Food', account_type: 'direct_costs' },
      { code: '5010', name: 'Cost of Sales — Beverage', account_type: 'direct_costs' },
      { code: '6000', name: 'Wages & Salaries', account_type: 'overhead' },
      { code: '6100', name: 'Rent & Rates', account_type: 'overhead' },
      { code: '6200', name: 'Utilities', account_type: 'overhead' },
      { code: '6300', name: 'Repairs & Maintenance', account_type: 'overhead' },
    ],
  },
  construction: {
    label: 'Construction',
    description: 'Contractors and subcontractors under the Construction Industry Scheme (CIS)',
    vatSchemes: ['domestic_reverse_charge'],
    accounts: [
      { code: '1000', name: 'Bank Current Account', account_type: 'bank' },
      { code: '1100', name: 'Trade Debtors', account_type: 'current_asset' },
      { code: '1150', name: 'Retention Debtors', account_type: 'current_asset' },
      { code: '2000', name: 'Trade Creditors', account_type: 'current_liability' },
      { code: '2050', name: 'CIS Tax Withheld', account_type: 'current_liability' },
      { code: '2100', name: 'VAT Control Account', account_type: 'current_liability' },
      { code: '3000', name: 'Capital Introduced', account_type: 'equity' },
      { code: '4000', name: 'Contract Income', account_type: 'sales' },
      { code: '5000', name: 'Materials', account_type: 'direct_costs' },
      { code: '5100', name: 'Subcontractor Costs', account_type: 'direct_costs' },
      { code: '5200', name: 'Plant & Equipment Hire', account_type: 'direct_costs' },
      { code: '6000', name: 'Wages & Salaries', account_type: 'overhead' },
      { code: '6100', name: 'Insurance', account_type: 'overhead' },
      { code: '6200', name: 'Vehicle Costs', account_type: 'overhead' },
    ],
  },
  property: {
    label: 'Property / Landlord',
    description: 'Residential and commercial letting',
    vatSchemes: ['exempt'],
    accounts: [
      { code: '1000', name: 'Bank Current Account', account_type: 'bank' },
      { code: '1100', name: 'Rent Debtors', account_type: 'current_asset' },
      { code: '1400', name: 'Tenant Deposits Held', account_type: 'current_liability' },
      { code: '2000', name: 'Trade Creditors', account_type: 'current_liability' },
      { code: '3000', name: 'Capital Introduced', account_type: 'equity' },
      { code: '4000', name: 'Rental Income', account_type: 'sales' },
      { code: '4100', name: 'Service Charge Income', account_type: 'sales' },
      { code: '5000', name: 'Letting Agent Fees', account_type: 'direct_costs' },
      { code: '5100', name: 'Repairs & Maintenance', account_type: 'direct_costs' },
      { code: '6000', name: 'Mortgage Interest', account_type: 'overhead' },
      { code: '6100', name: 'Insurance', account_type: 'overhead' },
      { code: '6200', name: 'Ground Rent & Service Charges', account_type: 'overhead' },
    ],
  },
}

export default function ChartOfAccounts({ clientId }: { clientId: string }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState('expense')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showIndustryPicker, setShowIndustryPicker] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('general')
  const [suggestedIndustry, setSuggestedIndustry] = useState<string | null>(null)
  const [vatRates, setVatRates] = useState<any[]>([])
  const [vatRateId, setVatRateId] = useState('')
  const [isIntendedGroup, setIsIntendedGroup] = useState(false)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchAccounts() }, [clientId])
  useEffect(() => {
    supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setVatRates(data)
    })
  }, [])

  async function fetchAccounts() {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('client_id', clientId)
      .order('code', { ascending: true })
    if (data) setAccounts(data)
    setLoading(false)
  }

  async function logAudit(params: {
    entityType: string
    entityId: string
    action: string
    oldData?: any
    newData?: any
    description: string
  }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_action: params.action,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  async function openIndustryPicker() {
    const { data: client } = await supabase
      .from('clients')
      .select('sic_code, industry')
      .eq('id', clientId)
      .single()

    const suggestion = detectIndustry(client?.sic_code, client?.industry)
    setSuggestedIndustry(suggestion)
    setSelectedIndustry(suggestion || 'general')
    setShowIndustryPicker(true)
  }

  function openNewForm() {
    setCode('')
    setName('')
    setAccountType('expense')
    setParentId('')
    setVatRateId('')
    setIsIntendedGroup(false)
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  function openEditForm(account: any) {
    setCode(account.code)
    setName(account.name)
    setAccountType(account.account_type)
    setParentId(account.parent_id || '')
    setVatRateId(account.default_vat_rate_id || '')
    setIsIntendedGroup(false)
    setEditingId(account.id)
    setError('')
    setFormOpen(true)
  }

  function isVatRelevantType(type: string) {
    const category = TYPE_TO_CATEGORY[type]
    return category === 'expense' || category === 'income'
  }

  function getRelevantVatRates(type: string) {
    const category = TYPE_TO_CATEGORY[type]
    const universal = ['no_vat']
    const expenseOnly = ['reverse_charge_expense_20', 'reverse_charge_construction', 'vat_on_imports', 'ec_acquisitions_20', 'ec_acquisitions_zero']
    const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']

    if (category === 'expense') {
      return vatRates.filter((r) => r.code.endsWith('_expense') || universal.includes(r.code) || expenseOnly.includes(r.code))
    }
    if (category === 'income') {
      return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
    }
    return vatRates
  }

  function isLeafAccount(id: string | null) {
    if (!id) return true // brand new account — can't have children yet
    return !accounts.some((a) => a.parent_id === id)
  }

  function handleSaveClick() {
    if (!code || !name) { setError('Code and name are required'); return }
    if (editingId && parentId === editingId) { setError('An account cannot be its own parent'); return }
    if (isVatRelevantType(accountType) && isLeafAccount(editingId) && !isIntendedGroup && !vatRateId) {
      setError('A VAT rate is required for this account, since it can be posted to directly')
      return
    }
    if (editingId) {
      setShowConfirm(true)
    } else {
      handleSave()
    }
  }

  async function handleSave() {
    setShowConfirm(false)
    setSaving(true)
    setError('')
    if (!code || !name) { setError('Code and name are required'); setSaving(false); return }
    if (editingId && parentId === editingId) { setError('An account cannot be its own parent'); setSaving(false); return }
    if (isVatRelevantType(accountType) && isLeafAccount(editingId) && !isIntendedGroup && !vatRateId) {
      setError('A VAT rate is required for this account, since it can be posted to directly')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    if (editingId) {
      const before = accounts.find((a) => a.id === editingId)
      const { data: updated, error: updateError } = await supabase
        .from('chart_of_accounts')
        .update({
          code,
          name,
          account_type: accountType,
          parent_id: parentId || null,
          default_vat_rate_id: isVatRelevantType(accountType) ? (vatRateId || null) : null,
        })
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
      } else {
        await logAudit({
          entityType: 'chart_of_accounts',
          entityId: editingId,
          action: 'updated',
          oldData: before,
          newData: updated,
          description: `Updated account "${before?.code} — ${before?.name}" → "${code} — ${name}" (${TYPE_LABELS[accountType] || accountType})`,
        })
        setFormOpen(false)
        setEditingId(null)
        fetchAccounts()
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('chart_of_accounts')
        .insert({
          firm_id: firmUser.firm_id,
          client_id: clientId,
          code,
          name,
          account_type: accountType,
          parent_id: parentId || null,
          default_vat_rate_id: isVatRelevantType(accountType) ? (vatRateId || null) : null,
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
      } else {
        await logAudit({
          entityType: 'chart_of_accounts',
          entityId: inserted.id,
          action: 'created',
          newData: inserted,
          description: `Created account "${code} — ${name}" (${TYPE_LABELS[accountType] || accountType})`,
        })
        setFormOpen(false)
        fetchAccounts()
      }
    }
    setSaving(false)
  }

  async function handleSeedIndustryTemplate() {
    setSaving(true)
    setError('')

    const template = INDUSTRY_TEMPLATES[selectedIndustry]

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const rows = template.accounts.map((a) => ({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      code: a.code,
      name: a.name,
      account_type: a.account_type,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('chart_of_accounts')
      .insert(rows)
      .select()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Best-effort default VAT scheme flag — the actual VAT Schemes selector UI
    // doesn't exist yet, so this just sets a sensible starting value on the client record.
    await supabase
      .from('clients')
      .update({ vat_schemes_enabled: template.vatSchemes })
      .eq('id', clientId)

    await logAudit({
      entityType: 'chart_of_accounts',
      entityId: clientId,
      action: 'bulk_seeded',
      newData: inserted,
      description: `Added ${template.accounts.length} accounts from the "${template.label}" industry template`,
    })

    setShowIndustryPicker(false)
    fetchAccounts()
    setSaving(false)
  }

  async function handleToggleActive(accountId: string, isActive: boolean) {
    const account = accounts.find(a => a.id === accountId)
    await supabase
      .from('chart_of_accounts')
      .update({ is_active: !isActive })
      .eq('id', accountId)

    await logAudit({
      entityType: 'chart_of_accounts',
      entityId: accountId,
      action: !isActive ? 'reactivated' : 'archived',
      oldData: { is_active: isActive },
      newData: { is_active: !isActive },
      description: `${!isActive ? 'Reactivated' : 'Archived'} account "${account?.code} — ${account?.name}"`,
    })

    setAccounts(accounts.map(a => a.id === accountId ? { ...a, is_active: !isActive } : a))
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading chart of accounts...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && (
        <div className="flex justify-end gap-3">
          {accounts.length === 0 && !showIndustryPicker && (
            <button
              onClick={openIndustryPicker}
              className="bg-gray-100 text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              Choose Industry Template
            </button>
          )}
          {!formOpen && !showIndustryPicker && (
            <button
              onClick={openNewForm}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
            >
              + New Account
            </button>
          )}
        </div>
      )}

      {showIndustryPicker && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Choose an industry template</h3>
          {suggestedIndustry ? (
            <p className="text-xs text-gray-500 -mt-2">
              We've pre-selected <span className="font-semibold text-brand-dark">{INDUSTRY_TEMPLATES[suggestedIndustry].label}</span> based on this client's business details — click a different card to change it.
            </p>
          ) : (
            <p className="text-xs text-gray-500 -mt-2">
              We couldn't auto-detect this client's industry from their business details — pick the closest match below.
            </p>
          )}
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(INDUSTRY_TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setSelectedIndustry(key)}
                className={`text-left rounded-xl p-4 border-2 transition relative ${
                  selectedIndustry === key ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {suggestedIndustry === key && (
                  <span className="absolute top-2 right-2 text-xs bg-brand-gold text-brand-dark px-2 py-0.5 rounded-full font-semibold">
                    Suggested
                  </span>
                )}
                <p className="text-sm font-semibold text-brand-dark">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                <p className="text-xs text-gray-400 mt-2">{t.accounts.length} accounts</p>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSeedIndustryTemplate} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Adding...' : `Add ${INDUSTRY_TEMPLATES[selectedIndustry].accounts.length} accounts`}
            </button>
            <button onClick={() => setShowIndustryPicker(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
            {editingId ? 'Edit Account' : 'New Account'}
          </h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="4000" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
                {ACCOUNT_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Parent account (optional)</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputClass}>
                <option value="">None — this is a top-level account</option>
                {accounts.filter(a => !a.parent_id && a.id !== editingId).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                e.g. set parent to "Motor Expenses" to create a sub-account like "Fuel" or "Insurance"
              </p>
            </div>

            {isVatRelevantType(accountType) && (
              isLeafAccount(editingId) ? (
                <div className="md:col-span-3 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isIntendedGroup}
                      onChange={(e) => { setIsIntendedGroup(e.target.checked); if (e.target.checked) setVatRateId('') }}
                      className="w-4 h-4 accent-brand-dark"
                    />
                    <span className="text-sm text-brand-dark">
                      This will be a group/heading account — I'll add sub-accounts under it and never post to it directly
                    </span>
                  </label>

                  {isIntendedGroup ? (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
                      No VAT rate needed — this account exists purely as a heading. Add sub-accounts underneath it (each with their own VAT rate) once it's created.
                    </p>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Default VAT rate *</label>
                      <select value={vatRateId} onChange={(e) => setVatRateId(e.target.value)} className={inputClass}>
                        <option value="">Select VAT rate</option>
                        {getRelevantVatRates(accountType).map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        Required — this rate is applied automatically whenever this account is used
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="md:col-span-3 bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500">
                    This account has sub-accounts, so it's a group/heading account — it can't be posted to directly, and doesn't need a VAT rate of its own. Post transactions to one of its sub-accounts instead.
                  </p>
                </div>
              )
            )}
          </div>
          {editingId && (
            <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-4 py-3">
              Changing an account's type after transactions have been posted to it can affect historical reports. Review Reports after saving to confirm everything still looks correct.
            </div>
          )}

          <ConfirmModal
            isOpen={showConfirm}
            title="Save changes to this account?"
            message="If transactions have already been posted to this account, changing its type or code may affect historical reports."
            confirmLabel="Yes, save"
            cancelLabel="Keep editing"
            confirming={saving}
            onConfirm={handleSave}
            onCancel={() => setShowConfirm(false)}
          />

          <div className="flex gap-3">
            <button onClick={handleSaveClick} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add account'}
            </button>
            <button onClick={() => { setFormOpen(false); setEditingId(null) }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !formOpen && !showIndustryPicker ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No accounts set up yet</p>
          <p className="text-gray-400 text-xs">Choose an industry template to get started, or build your own from scratch</p>
        </div>
      ) : !formOpen && !showIndustryPicker && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Code</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.filter(a => !a.parent_id).map((parent) => {
                const children = accounts.filter(a => a.parent_id === parent.id)
                return (
                  <Fragment key={parent.id}>
                    <tr className="border-b border-gray-100 bg-white">
                      <td className="px-6 py-3 text-sm font-mono text-gray-600">{parent.code}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-brand-dark">
                        {parent.name}
                        {isVatRelevantType(parent.account_type) && (
                          isLeafAccount(parent.id) ? (
                            parent.default_vat_rate_id ? (
                              <span className="block text-xs font-normal text-gray-400">
                                VAT: {vatRates.find((r) => r.id === parent.default_vat_rate_id)?.name || '—'}
                              </span>
                            ) : (
                              <span className="block text-xs font-normal text-red-500">No VAT rate set</span>
                            )
                          ) : (
                            <span className="block text-xs font-normal text-gray-400">Group account</span>
                          )
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TYPE_STYLES[TYPE_TO_CATEGORY[parent.account_type] || parent.account_type] || TYPE_STYLES.expense}`}>
                          {TYPE_LABELS[parent.account_type] || parent.account_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {can.manageEngagements ? (
                          <button
                            onClick={() => handleToggleActive(parent.id, parent.is_active)}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition ${
                              parent.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {parent.is_active ? 'Active' : 'Inactive'}
                          </button>
                        ) : (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${parent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {parent.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {can.manageEngagements && (
                          <button onClick={() => openEditForm(parent)} className="text-xs text-brand-dark font-medium hover:underline">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    {children.map((child) => (
                      <tr key={child.id} className={`border-b border-gray-100 bg-gray-50 ${!child.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-3 text-sm font-mono text-gray-500 pl-10">{child.code}</td>
                        <td className="px-6 py-3 text-sm text-gray-600 pl-10">
                          ↳ {child.name}
                          {isVatRelevantType(child.account_type) && (
                            isLeafAccount(child.id) ? (
                              child.default_vat_rate_id ? (
                                <span className="block text-xs font-normal text-gray-400">
                                  VAT: {vatRates.find((r) => r.id === child.default_vat_rate_id)?.name || '—'}
                                </span>
                              ) : (
                                <span className="block text-xs font-normal text-red-500">No VAT rate set</span>
                              )
                            ) : (
                              <span className="block text-xs font-normal text-gray-400">Group account</span>
                            )
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TYPE_STYLES[TYPE_TO_CATEGORY[child.account_type] || child.account_type] || TYPE_STYLES.expense}`}>
                            {TYPE_LABELS[child.account_type] || child.account_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {can.manageEngagements ? (
                            <button
                              onClick={() => handleToggleActive(child.id, child.is_active)}
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition ${
                                child.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {child.is_active ? 'Active' : 'Inactive'}
                            </button>
                          ) : (
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${child.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {child.is_active ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {can.manageEngagements && (
                            <button onClick={() => openEditForm(child)} className="text-xs text-brand-dark font-medium hover:underline">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
