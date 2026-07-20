'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import AddContactModal from '@/components/accounting/AddContactModal'
import AddAccountModal from '@/components/accounting/AddAccountModal'

type LineDraft = {
  description: string
  quantity: string
  unit_price: string
  income_account_id: string
  vat_rate_id: string
  project_id: string
}
const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unit_price: '', income_account_id: '', vat_rate_id: '', project_id: '' }
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  expired: 'bg-orange-100 text-orange-600',
  converted: 'bg-brand-gold/20 text-brand-dark',
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function SalesQuotes({ clientId }: { clientId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasAutoOpenedRef = useRef(false)
  const [quotes, setQuotes] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddAccountForLine, setShowAddAccountForLine] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [contactId, setContactId] = useState('')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0])
  const [expiryDate, setExpiryDate] = useState(addDays(new Date().toISOString().split('T')[0], 30))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null)
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const [quotesRes, contactsRes, accountsRes, vatRes, projectsRes] = await Promise.all([
      supabase.from('sales_quotes').select('*, contacts(name, payment_terms_days)').eq('client_id', clientId).order('quote_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_customer', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name, account_type, default_vat_rate_id').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('projects').select('id, name').eq('client_id', clientId).eq('status', 'active').order('name'),
    ])
    if (quotesRes.data) {
      const withTotals = await Promise.all(quotesRes.data.map(async (q: any) => {
        const { data: lineRows } = await supabase.from('sales_quote_lines').select('line_total, vat_amount').eq('quote_id', q.id)
        const total = (lineRows || []).reduce((sum: number, l: any) => sum + parseFloat(l.line_total) + parseFloat(l.vat_amount), 0)
        return { ...q, sales_quote_lines_total: total }
      }))
      setQuotes(withTotals)

      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true
        const editQuoteId = searchParams.get('edit')
        if (editQuoteId) {
          const toEdit = withTotals.find((q: any) => q.id === editQuoteId)
          if (toEdit && ['draft', 'sent'].includes(toEdit.status)) openEditForm(toEdit)
        }
      }
    }
    if (contactsRes.data) setContacts(contactsRes.data)
    if (accountsRes.data) setAccounts(accountsRes.data.filter((a) => ['sales', 'revenue', 'other_income'].includes(a.account_type)))
    if (vatRes.data) setVatRates(vatRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
    setLoading(false)
  }

  function addLine() { setLines([...lines, { ...EMPTY_LINE }]) }
  function updateLine(index: number, field: keyof LineDraft, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }
  function relevantVatRates() {
    const universal = ['no_vat']
    const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']
    return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
  }
  function removeLine(index: number) { setLines(lines.filter((_, i) => i !== index)) }
  function lineAmounts(line: LineDraft) {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unit_price) || 0
    const net = qty * price
    const rate = vatRates.find((r) => r.id === line.vat_rate_id)
    const vatAmount = rate ? net * (parseFloat(rate.rate) / 100) : 0
    return { net, vatAmount, gross: net + vatAmount }
  }
  function calculateTotals() {
    let subtotal = 0, vatTotal = 0
    lines.forEach((l) => {
      const { net, vatAmount } = lineAmounts(l)
      subtotal += net
      vatTotal += vatAmount
    })
    return { subtotal, vatTotal, total: subtotal + vatTotal }
  }
  function resetForm() {
    setContactId('')
    setQuoteDate(new Date().toISOString().split('T')[0])
    setExpiryDate(addDays(new Date().toISOString().split('T')[0], 30))
    setNotes('')
    setLines([{ ...EMPTY_LINE }])
    setError('')
    setEditingQuoteId(null)
  }

  async function openEditForm(quote: any) {
    setError('')
    const { data: existingLines } = await supabase.from('sales_quote_lines').select('*').eq('quote_id', quote.id).order('sort_order')
    setEditingQuoteId(quote.id)
    setContactId(quote.contact_id)
    setQuoteDate(quote.quote_date)
    setExpiryDate(quote.expiry_date || '')
    setNotes(quote.notes || '')
    setLines(
      (existingLines && existingLines.length > 0 ? existingLines : [{}]).map((l: any) => ({
        description: l.description || '',
        quantity: String(l.quantity || 1),
        unit_price: String(l.unit_price || ''),
        income_account_id: l.income_account_id || '',
        vat_rate_id: l.vat_rate_id || '',
        project_id: l.project_id || '',
      }))
    )
    setCreating(true)
  }

  async function logAudit(params: { entityId: string; action: string; oldData?: any; newData?: any; description: string }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'sales_quote',
      p_entity_id: params.entityId,
      p_action: params.action,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setLineErrors({})
    if (!contactId) { setError('Select a customer'); setSaving(false); return }

    // A line is "touched" if the person has started filling it in at all - an
    // untouched blank line (e.g. a leftover extra row) is just ignored, but any
    // line with something in it must be fully complete before saving
    const touchedLines = lines
      .map((l, i) => ({ line: l, index: i }))
      .filter(({ line }) => line.description.trim() !== '' || line.unit_price !== '')

    if (touchedLines.length === 0) {
      setError('At least one line with a description and price is required')
      setSaving(false)
      return
    }

    const newLineErrors: Record<number, string> = {}
    for (const { line, index } of touchedLines) {
      const missing: string[] = []
      if (!line.description.trim()) missing.push('description')
      if (!(parseFloat(line.unit_price) > 0)) missing.push('unit price')
      if (!line.income_account_id) missing.push('income account')
      if (!line.vat_rate_id) missing.push('VAT rate')
      if (missing.length > 0) newLineErrors[index] = `Missing: ${missing.join(', ')} - complete or remove this line`
    }

    if (Object.keys(newLineErrors).length > 0) {
      setLineErrors(newLineErrors)
      setError('Some lines are incomplete - fix or remove them below')
      setSaving(false)
      return
    }

    const validLines = touchedLines.map(({ line }) => line)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { subtotal, vatTotal, total } = calculateTotals()
    const linesPayload = (quoteId: string) => validLines.map((l, i) => {
      const { net, vatAmount } = lineAmounts(l)
      return {
        quote_id: quoteId,
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        income_account_id: l.income_account_id || null,
        vat_rate_id: l.vat_rate_id || null,
        vat_amount: vatAmount,
        line_total: net,
        project_id: l.project_id || null,
        sort_order: i,
      }
    })

    if (editingQuoteId) {
      const { data: before } = await supabase.from('sales_quotes').select('*, sales_quote_lines(*)').eq('id', editingQuoteId).single()
      const wasSent = before?.status === 'sent'
      const { error: updateError } = await supabase
        .from('sales_quotes')
        .update({
          contact_id: contactId,
          quote_date: quoteDate,
          expiry_date: expiryDate || null,
          notes: notes || null,
          // If it had already been sent, revert to draft and issue a fresh link -
          // the customer shouldn't silently see different figures on the same link
          ...(wasSent ? { status: 'draft', accept_token: crypto.randomUUID() } : {}),
        })
        .eq('id', editingQuoteId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
      await supabase.from('sales_quote_lines').delete().eq('quote_id', editingQuoteId)
      const { error: linesError } = await supabase.from('sales_quote_lines').insert(linesPayload(editingQuoteId))
      if (linesError) { setError(linesError.message); setSaving(false); return }
      const { data: after } = await supabase.from('sales_quotes').select('*, sales_quote_lines(*)').eq('id', editingQuoteId).single()
      await logAudit({
        entityId: editingQuoteId,
        action: 'updated',
        oldData: before,
        newData: after,
        description: wasSent
          ? `Edited sent quote "${before?.quote_number}" — reverted to draft, new link issued, now £${total.toFixed(2)} total`
          : `Edited draft quote "${before?.quote_number}" — now £${total.toFixed(2)} total`,
      })
      setCreating(false); resetForm(); router.replace(`/accounting/${clientId}/sales-quotes`); fetchData(); setSaving(false)
      return
    }

    const { count } = await supabase.from('sales_quotes').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
    const quoteNumber = `QT-${String((count || 0) + 1).padStart(4, '0')}`
    const { data: quote, error: quoteError } = await supabase
      .from('sales_quotes')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        contact_id: contactId,
        quote_number: quoteNumber,
        quote_date: quoteDate,
        expiry_date: expiryDate || null,
        status: 'draft',
        notes: notes || null,
        created_by: user!.id,
      })
      .select()
      .single()
    if (quoteError) { setError(quoteError.message); setSaving(false); return }
    const { error: linesError } = await supabase.from('sales_quote_lines').insert(linesPayload(quote.id))
    if (linesError) { setError(linesError.message); setSaving(false); return }
    await logAudit({ entityId: quote.id, action: 'created', newData: quote, description: `Created quote "${quoteNumber}" for £${total.toFixed(2)}` })
    setCreating(false); resetForm(); router.replace(`/accounting/${clientId}/sales-quotes`); fetchData(); setSaving(false)
  }

  async function handleMarkSent(quote: any) {
    await supabase.from('sales_quotes').update({ status: 'sent' }).eq('id', quote.id)
    await logAudit({ entityId: quote.id, action: 'sent', oldData: { status: 'draft' }, newData: { status: 'sent' }, description: `Marked quote "${quote.quote_number}" as sent to customer` })
    fetchData()
  }

  function openConvert(quote: any) {
    const todayStr = new Date().toISOString().split('T')[0]
    setOrderDate(todayStr)
    setExpectedDate(addDays(todayStr, 14))
    setConvertError('')
    setConvertingQuoteId(quote.id)
  }

  async function handleConvert(quoteId: string) {
    setConverting(true)
    setConvertError('')
    const quote = quotes.find((q) => q.id === quoteId)
    const { error: convertErr } = await supabase.rpc('convert_quote_to_sales_order', {
      p_quote_id: quoteId,
      p_order_date: orderDate,
      p_expected_date: expectedDate || null,
    })
    if (convertErr) { setConvertError(convertErr.message); setConverting(false); return }
    await logAudit({ entityId: quoteId, action: 'converted_to_sales_order', description: `Converted "${quote?.quote_number}" to a sales order` })
    setConvertingQuoteId(null)
    setConverting(false)
    fetchData()
  }

  const { subtotal, vatTotal, total } = calculateTotals()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading quotes...</p>
    </div>
  )
  if (contacts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No customers available</p>
      <p className="text-gray-400 text-xs">Add a customer in Contacts first before creating quotes</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button onClick={() => setCreating(true)} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + New Quote
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingQuoteId ? 'Edit Draft Quote' : 'New Quote'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
              <select
                value={contactId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') { setShowAddCustomer(true); return }
                  setContactId(e.target.value)
                }}
                className={inputClass}
              >
                <option value="">Select customer</option>
                <option value="__add_new__">+ Add new customer...</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <AddContactModal
                isOpen={showAddCustomer}
                clientId={clientId}
                type="customer"
                onCancel={() => setShowAddCustomer(false)}
                onCreated={(contact) => { setContacts((prev) => [...prev, contact]); setContactId(contact.id); setShowAddCustomer(false) }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quote date</label>
              <DatePicker value={quoteDate} onChange={setQuoteDate} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expiry date</label>
              <DatePicker value={expiryDate} onChange={setExpiryDate} className="w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit price (£)</div>
              <div className="col-span-2">Income account</div>
              <div className="col-span-2">VAT rate</div>
              <div className="col-span-1"></div>
            </div>
            {lines.map((line, index) => {
              const { net, vatAmount } = lineAmounts(line)
              return (
                <div key={index} className={lineErrors[index] ? 'bg-red-50 rounded-lg p-2 -mx-2' : ''}>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input type="text" value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} placeholder="Item or service"
                      className="col-span-4 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    <input type="number" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      className="col-span-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    <input type="number" value={line.unit_price} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} placeholder="0.00"
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    <select
                      value={line.income_account_id}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') { setShowAddAccountForLine(index); return }
                        updateLine(index, 'income_account_id', e.target.value)
                        const account = accounts.find((a) => a.id === e.target.value)
                        if (account && !line.vat_rate_id) updateLine(index, 'vat_rate_id', account.default_vat_rate_id || '')
                      }}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">Account</option>
                      <option value="__add_new__">+ Add new account...</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <AddAccountModal
                      isOpen={showAddAccountForLine === index}
                      clientId={clientId}
                      context="sales"
                      onCancel={() => setShowAddAccountForLine(null)}
                      onCreated={(account) => { setAccounts((prev) => [...prev, account]); updateLine(index, 'income_account_id', account.id); setShowAddAccountForLine(null) }}
                    />
                    <select value={line.vat_rate_id} onChange={(e) => updateLine(index, 'vat_rate_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold">
                      <option value="">Select VAT rate...</option>
                      {relevantVatRates().map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                    </select>
                    <button onClick={() => removeLine(index)} disabled={lines.length <= 1} className="col-span-1 text-red-400 hover:text-red-600 text-xs disabled:opacity-30">✕</button>
                  </div>
                  {lineErrors[index] && (
                    <p className="text-xs text-red-600 pl-1 mt-1 font-medium">⚠ {lineErrors[index]}</p>
                  )}
                  {(net > 0) && (
                    <p className="text-xs text-gray-400 pl-1 mt-0.5">Net £{net.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = £{(net + vatAmount).toFixed(2)}</p>
                  )}
                  {projects.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-gray-400">Project:</label>
                      <select value={line.project_id || ''} onChange={(e) => updateLine(index, 'project_id', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold">
                        <option value="">No project</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addLine} className="text-xs text-brand-dark font-medium hover:underline">+ Add line</button>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="bg-gray-50 rounded-xl p-4 flex justify-end gap-6 text-sm">
            <div><span className="text-gray-500">Subtotal: </span><span className="font-semibold text-brand-dark">£{subtotal.toFixed(2)}</span></div>
            <div><span className="text-gray-500">VAT: </span><span className="font-semibold text-brand-dark">£{vatTotal.toFixed(2)}</span></div>
            <div><span className="text-gray-500">Total: </span><span className="font-semibold text-brand-dark">£{total.toFixed(2)}</span></div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingQuoteId ? 'Save Changes' : 'Save as draft'}
            </button>
            <button onClick={() => { setCreating(false); resetForm(); router.replace(`/accounting/${clientId}/sales-quotes`) }} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {quotes.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No quotes yet</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Quote #</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <>
                    <tr key={q.id} className="border-b border-gray-100">
                      <td className="px-6 py-3 text-sm">
                        <button onClick={() => router.push(`/accounting/${clientId}/sales-quotes/${q.id}`)} className="font-mono text-brand-dark font-medium hover:underline">
                          {q.quote_number}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-brand-dark">{q.contacts?.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{new Date(q.quote_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(q.sales_quote_lines_total || 0).toFixed(2)}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[q.status]}`}>{q.status}</span>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                        {can.manageEngagements && ['draft', 'sent'].includes(q.status) && (
                          <button onClick={() => openEditForm(q)} className="text-xs bg-gray-100 text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">Edit</button>
                        )}
                        {can.manageEngagements && q.status === 'draft' && (
                          <button onClick={() => handleMarkSent(q)} className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-200 transition">Mark as Sent</button>
                        )}
                        {can.manageEngagements && q.status === 'accepted' && (
                          <button onClick={() => openConvert(q)} className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition">
                            Convert to Sales Order
                          </button>
                        )}
                        {q.status === 'converted' && <span className="text-xs text-gray-400">Order created</span>}
                      </td>
                    </tr>
                    {convertingQuoteId === q.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex items-end gap-4 flex-wrap">
                            {convertError && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{convertError}</div>}
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Order date</label>
                              <DatePicker value={orderDate} onChange={setOrderDate} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Expected date</label>
                              <DatePicker value={expectedDate} onChange={setExpectedDate} />
                            </div>
                            <button onClick={() => handleConvert(q.id)} disabled={converting} className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
                              {converting ? 'Converting...' : 'Confirm conversion'}
                            </button>
                            <button onClick={() => setConvertingQuoteId(null)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
