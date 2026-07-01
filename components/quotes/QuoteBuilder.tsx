'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const SERVICE_TYPES = [
  'Accounts Production',
  'Corporation Tax (CT600)',
  'VAT Returns & MTD',
  'Self Assessment',
  'Payroll & RTI',
  'CIS Returns',
  'Partnership Accounts',
  'Bookkeeping',
  'MTD for Income Tax',
  'Other',
]

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'one_off', label: 'One-off' },
]

type LineItem = {
  service_type: string
  description: string
  fee: string
  frequency: string
}

export default function QuoteBuilder({
  prefillClientId,
  prefillLeadId,
}: {
  prefillClientId?: string
  prefillLeadId?: string
}) {
  const [source, setSource] = useState<'standalone' | 'client' | 'lead'>(
    prefillClientId ? 'client' : prefillLeadId ? 'lead' : 'standalone'
  )
  const [clients, setClients] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState(prefillClientId || '')
  const [selectedLeadId, setSelectedLeadId] = useState(prefillLeadId || '')
  const [prospectName, setProspectName] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')
  const [prospectCompany, setProspectCompany] = useState('')
  const [introMessage, setIntroMessage] = useState('Thank you for the opportunity to quote for our services. Please find our proposed fees below.')
  const [validUntil, setValidUntil] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { service_type: 'Accounts Production', description: '', fee: '', frequency: 'annually' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function fetchOptions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', user.id)
        .single()
      if (!firmUser) return

      const [{ data: clientsData }, { data: leadsData }] = await Promise.all([
        supabase.from('clients').select('id, name, email').eq('firm_id', firmUser.firm_id).order('name'),
        supabase.from('pipeline_leads').select('id, name, email, company').eq('firm_id', firmUser.firm_id).order('created_at', { ascending: false }),
      ])

      if (clientsData) setClients(clientsData)
      if (leadsData) setLeads(leadsData)
    }
    fetchOptions()

    const defaultValid = new Date()
    defaultValid.setDate(defaultValid.getDate() + 30)
    setValidUntil(defaultValid.toISOString().split('T')[0])
  }, [])

  function addLineItem() {
    setLineItems([...lineItems, { service_type: 'Other', description: '', fee: '', frequency: 'monthly' }])
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  function calculateTotals() {
    let monthlyTotal = 0
    let oneOffTotal = 0
    lineItems.forEach((item) => {
      const fee = parseFloat(item.fee) || 0
      if (item.frequency === 'monthly') monthlyTotal += fee
      else if (item.frequency === 'quarterly') monthlyTotal += fee / 3
      else if (item.frequency === 'annually') monthlyTotal += fee / 12
      else if (item.frequency === 'one_off') oneOffTotal += fee
    })
    return { monthlyTotal, oneOffTotal }
  }

  async function handleSave(status: 'draft') {
    setSaving(true)
    setError('')

    if (lineItems.length === 0 || lineItems.some(i => !i.fee)) {
      setError('Please add at least one line item with a fee')
      setSaving(false)
      return
    }

    if (source === 'standalone' && (!prospectName || !prospectEmail)) {
      setError('Prospect name and email are required')
      setSaving(false)
      return
    }
    if (source === 'client' && !selectedClientId) {
      setError('Please select a client')
      setSaving(false)
      return
    }
    if (source === 'lead' && !selectedLeadId) {
      setError('Please select a lead')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    let leadDetails: any = null
    if (source === 'lead') {
      const lead = leads.find(l => l.id === selectedLeadId)
      leadDetails = lead
    }

    const { data: quote, error: insertError } = await supabase
      .from('quotes')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: source === 'client' ? selectedClientId : null,
        pipeline_lead_id: source === 'lead' ? selectedLeadId : null,
        prospect_name: source === 'standalone' ? prospectName : (leadDetails?.name || null),
        prospect_email: source === 'standalone' ? prospectEmail : (leadDetails?.email || null),
        prospect_company: source === 'standalone' ? prospectCompany : (leadDetails?.company || null),
        intro_message: introMessage,
        valid_until: validUntil || null,
        status: 'draft',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    const itemsToInsert = lineItems.map((item, index) => ({
      quote_id: quote.id,
      service_type: item.service_type,
      description: item.description || null,
      fee: parseFloat(item.fee) || 0,
      frequency: item.frequency,
      sort_order: index,
    }))

    const { error: itemsError } = await supabase.from('quote_line_items').insert(itemsToInsert)
    if (itemsError) { setError(itemsError.message); setSaving(false); return }

    router.push(`/quotes/${quote.id}`)
  }

  const { monthlyTotal, oneOffTotal } = calculateTotals()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="max-w-3xl space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* Source selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Who is this quote for?</h3>
        <div className="flex gap-3">
          {[
            { value: 'standalone', label: 'New prospect' },
            { value: 'lead', label: 'Pipeline lead' },
            { value: 'client', label: 'Existing client' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setSource(s.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                source === s.value ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {source === 'standalone' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Prospect name *</label>
              <input type="text" value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="John Smith" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Email address *</label>
              <input type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} placeholder="john@example.com" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-dark mb-1">Company name</label>
              <input type="text" value={prospectCompany} onChange={(e) => setProspectCompany(e.target.value)} placeholder="Acme Ltd" className={inputClass} />
            </div>
          </div>
        )}

        {source === 'lead' && (
          <div className="pt-2">
            <label className="block text-sm font-medium text-brand-dark mb-1">Select lead</label>
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)} className={inputClass}>
              <option value="">Select a lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {source === 'client' && (
          <div className="pt-2">
            <label className="block text-sm font-medium text-brand-dark mb-1">Select client</label>
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className={inputClass}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Intro & validity */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Quote details</h3>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Introduction message</label>
          <textarea value={introMessage} onChange={(e) => setIntroMessage(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Valid until</label>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Services & fees</h3>
          <button onClick={addLineItem} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-brand-dark hover:bg-gray-200 transition font-medium">
            + Add line
          </button>
        </div>

        {lineItems.map((item, index) => (
          <div key={index} className="border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Service</label>
                <select value={item.service_type} onChange={(e) => updateLineItem(index, 'service_type', e.target.value)} className={inputClass}>
                  {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                <input type="text" value={item.description} onChange={(e) => updateLineItem(index, 'description', e.target.value)} placeholder="e.g. Monthly bookkeeping and VAT prep" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fee (£)</label>
                <input type="number" value={item.fee} onChange={(e) => updateLineItem(index, 'fee', e.target.value)} placeholder="250" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                <select value={item.frequency} onChange={(e) => updateLineItem(index, 'frequency', e.target.value)} className={inputClass}>
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            {lineItems.length > 1 && (
              <button onClick={() => removeLineItem(index)} className="text-xs text-red-500 hover:text-red-600 transition">
                Remove line
              </button>
            )}
          </div>
        ))}

        <div className="bg-brand-light rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Estimated monthly total</p>
            <p className="text-xl font-bold text-brand-dark">£{monthlyTotal.toFixed(2)}</p>
          </div>
          {oneOffTotal > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">One-off fees</p>
              <p className="text-xl font-bold text-brand-dark">£{oneOffTotal.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => handleSave('draft')} disabled={saving}
        className="w-full bg-brand-dark text-white font-semibold py-3 rounded-xl hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
        {saving ? 'Saving...' : 'Save quote as draft'}
      </button>
    </div>
  )
}
