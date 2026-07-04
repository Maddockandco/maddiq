'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

type ControlAccountKey =
  | 'debtors_account_id'
  | 'creditors_account_id'
  | 'vat_account_id'
  | 'default_sales_account_id'
  | 'default_purchase_account_id'
  | 'default_bank_account_id'

const FIELDS: { key: ControlAccountKey; label: string; hint: string; filterTypes: string[] }[] = [
  {
    key: 'debtors_account_id',
    label: 'Debtors control account',
    hint: 'Sales invoices post here on the debit side until paid (e.g. "Trade Debtors")',
    filterTypes: ['current_asset'],
  },
  {
    key: 'creditors_account_id',
    label: 'Creditors control account',
    hint: 'Purchase bills post here on the credit side until paid (e.g. "Trade Creditors")',
    filterTypes: ['current_liability', 'liability'],
  },
  {
    key: 'vat_account_id',
    label: 'VAT control account',
    hint: 'VAT on sales and purchases nets off here',
    filterTypes: ['current_liability', 'liability'],
  },
  {
    key: 'default_sales_account_id',
    label: 'Default sales account',
    hint: 'Used as the default income account on new invoice lines (can be overridden per line)',
    filterTypes: ['sales', 'revenue', 'other_income'],
  },
  {
    key: 'default_purchase_account_id',
    label: 'Default purchase account',
    hint: 'Used as the default expense account on new bill lines (can be overridden per line)',
    filterTypes: ['direct_costs', 'expense', 'overhead'],
  },
  {
    key: 'default_bank_account_id',
    label: 'Default bank account',
    hint: 'Pre-selected when recording a new receipt or payment',
    filterTypes: ['bank'],
  },
]

export default function AccountingSettings({ clientId }: { clientId: string }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const accountsResult = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('code', { ascending: true })

    const settingsResult = await supabase
      .from('accounting_settings')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (accountsResult.data) setAccounts(accountsResult.data)
    if (settingsResult.data) setSettings(settingsResult.data)
    setLoading(false)
  }

  function updateField(key: ControlAccountKey, value: string) {
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const payload = {
      client_id: clientId,
      firm_id: firmUser.firm_id,
      debtors_account_id: settings.debtors_account_id || null,
      creditors_account_id: settings.creditors_account_id || null,
      vat_account_id: settings.vat_account_id || null,
      default_sales_account_id: settings.default_sales_account_id || null,
      default_purchase_account_id: settings.default_purchase_account_id || null,
      default_bank_account_id: settings.default_bank_account_id || null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('accounting_settings')
      .upsert(payload, { onConflict: 'client_id' })

    if (upsertError) {
      setError(upsertError.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading accounting settings...</p>
    </div>
  )

  const allMapped = FIELDS.every((f) => settings[f.key])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-1">Control accounts</h3>
        <p className="text-xs text-gray-400 mb-6">
          These mappings tell Maddiq which ledger accounts to post to automatically when invoices, bills, receipts, and payments are recorded.
        </p>

        {!allMapped && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-3 mb-6">
            All six accounts must be mapped before invoices or bills can be posted for this client.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}
        {saved && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 mb-6">Settings saved.</div>}

        <div className="space-y-5">
          {FIELDS.map((field) => {
            const relevant = accounts.filter((a) => field.filterTypes.includes(a.account_type))
            const others = accounts.filter((a) => !field.filterTypes.includes(a.account_type))
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-brand-dark mb-1">{field.label}</label>
                <p className="text-xs text-gray-400 mb-2">{field.hint}</p>
                <select
                  value={settings[field.key] || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  disabled={!can.manageEngagements}
                  className={inputClass}
                >
                  <option value="">Select account...</option>
                  {relevant.length > 0 && (
                    <optgroup label="Suggested">
                      {relevant.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All accounts">
                    {others.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )
          })}
        </div>

        {can.manageEngagements && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        )}
      </div>
    </div>
  )
}
