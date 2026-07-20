'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import { FLAT_RATE_SECTORS, LIMITED_COST_TRADER_RATE } from '@/lib/flatRateSectors'

const STAGGER_LABELS: Record<number, string> = {
  1: 'Stagger 1 — Mar / Jun / Sep / Dec quarter ends',
  2: 'Stagger 2 — Feb / May / Aug / Nov quarter ends',
  3: 'Stagger 3 — Jan / Apr / Jul / Oct quarter ends',
}

const LCT_OVERRIDE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Automatic — determine from actual purchase history each period (recommended)' },
  { value: 'force_standard', label: 'Always use the sector rate (override)' },
  { value: 'force_limited_cost', label: 'Always use the 16.5% Limited Cost Trader rate (override)' },
]

export default function VatSettings({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [vrn, setVrn] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [scheme, setScheme] = useState('standard')
  const [filingFrequency, setFilingFrequency] = useState('quarterly')
  const [staggerGroup, setStaggerGroup] = useState('1')
  const [flatRateSector, setFlatRateSector] = useState('')
  const [lctOverride, setLctOverride] = useState('auto')

  useEffect(() => { fetchSettings() }, [clientId])

  async function fetchSettings() {
    setLoading(true)
    const { data } = await supabase.from('vat_settings').select('*').eq('client_id', clientId).maybeSingle()
    if (data) {
      setSettings(data)
      setVrn(data.vat_registration_number || '')
      setRegistrationDate(data.registration_date || '')
      setScheme(data.scheme || 'standard')
      setFilingFrequency(data.filing_frequency || 'quarterly')
      setStaggerGroup(String(data.stagger_group || 1))
      setFlatRateSector(data.flat_rate_sector || '')
      setLctOverride(data.lct_override || 'auto')
    }
    setLoading(false)
  }

  function firstYearDiscountActive(): boolean {
    if (!registrationDate) return false
    const oneYearOn = new Date(registrationDate)
    oneYearOn.setFullYear(oneYearOn.getFullYear() + 1)
    return new Date() < oneYearOn
  }

  async function handleSave() {
    if (scheme === 'flat_rate' && !flatRateSector) {
      setError("Select a business sector for the Flat Rate Scheme — this is the rate used for any period the client isn't a Limited Cost Trader")
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      vat_registration_number: vrn || null,
      registration_date: registrationDate || null,
      scheme,
      filing_frequency: filingFrequency,
      stagger_group: filingFrequency === 'quarterly' ? parseInt(staggerGroup) : null,
      flat_rate_sector: scheme === 'flat_rate' ? flatRateSector : null,
      lct_override: scheme === 'flat_rate' ? lctOverride : 'auto',
      updated_at: new Date().toISOString(),
      created_by: user!.id,
    }

    const { error: saveError } = await supabase.from('vat_settings').upsert(payload, { onConflict: 'client_id' })
    if (saveError) { setError(saveError.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    fetchSettings()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const sectorRate = FLAT_RATE_SECTORS.find((s) => s.sector === flatRateSector)?.rate

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">VAT Setup</h3>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
        {saved && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">VAT setup saved</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">VAT Registration Number</label>
            <input type="text" value={vrn} onChange={(e) => setVrn(e.target.value)} className={inputClass} placeholder="e.g. 123456789" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">VAT Registration Date</label>
            <DatePicker value={registrationDate} onChange={setRegistrationDate} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">VAT Scheme</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'standard', label: 'Standard (Accrual)', desc: 'VAT accounted for by invoice/bill date' },
              { value: 'cash_accounting', label: 'Cash Accounting', desc: 'VAT accounted for by payment date' },
              { value: 'flat_rate', label: 'Flat Rate Scheme', desc: 'Fixed % of gross turnover' },
              { value: 'annual_accounting', label: 'Annual Accounting', desc: 'One annual return, interim payments' },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setScheme(s.value)}
                className={`text-left border rounded-xl p-3 transition ${scheme === s.value ? 'border-brand-gold bg-brand-light' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <p className="text-sm font-semibold text-brand-dark">{s.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {scheme === 'flat_rate' && (
          <div className="bg-brand-light rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Business Sector</label>
              <select value={flatRateSector} onChange={(e) => setFlatRateSector(e.target.value)} className={inputClass}>
                <option value="">Select a sector...</option>
                {FLAT_RATE_SECTORS.map((s) => <option key={s.sector} value={s.sector}>{s.sector} — {s.rate}%</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This is the rate used for any period the client isn't a Limited Cost Trader. Limited Cost Trader status
                (16.5% flat, regardless of sector) is now determined automatically each period from actual purchase
                history — it can genuinely change from one return to the next, so it's calculated live rather than
                fixed here.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Limited Cost Trader Determination</label>
              <select value={lctOverride} onChange={(e) => setLctOverride(e.target.value)} className={inputClass}>
                {LCT_OVERRIDE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {lctOverride !== 'auto' && (
                <p className="text-xs text-amber-700 mt-1">
                  Overriding the automatic test — only do this for a specific judgement call you've made yourself
                  (e.g. HMRC's "relevant goods" definition genuinely doesn't fit this client's setup).
                </p>
              )}
            </div>

            {sectorRate != null && (
              <p className="text-sm text-brand-dark">
                Sector rate: <span className="font-bold">{firstYearDiscountActive() ? Math.round((sectorRate - 1) * 100) / 100 : sectorRate}%</span>
                {' · '}Limited Cost Trader rate: <span className="font-bold">{firstYearDiscountActive() ? Math.round((LIMITED_COST_TRADER_RATE - 1) * 100) / 100 : LIMITED_COST_TRADER_RATE}%</span>
                {firstYearDiscountActive() && <span className="text-xs text-gray-500"> (includes the 1% first-year discount)</span>}
                <br />
                <span className="text-xs text-gray-500">The actual rate used on each return is shown when you calculate that return.</span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Filing Frequency</label>
            <select value={filingFrequency} onChange={(e) => setFilingFrequency(e.target.value)} className={inputClass}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          {filingFrequency === 'quarterly' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quarter Stagger Group</label>
              <select value={staggerGroup} onChange={(e) => setStaggerGroup(e.target.value)} className={inputClass}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{STAGGER_LABELS[n]}</option>)}
              </select>
            </div>
          )}
        </div>

        {can.manageEngagements && (
          <button onClick={handleSave} disabled={saving} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save VAT Setup'}
          </button>
        )}
      </div>
    </div>
  )
}
