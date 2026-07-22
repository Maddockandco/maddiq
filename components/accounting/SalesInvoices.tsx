'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import AddContactModal from '@/components/accounting/AddContactModal'
import AddAccountModal from '@/components/accounting/AddAccountModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ActionDropdown from '@/components/ui/ActionDropdown'
type LineDraft = {
  description: string
  quantity: string
  unit_price: string
  income_account_id: string
  vat_rate_id: string
  project_id?: string
}
const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unit_price: '', income_account_id: '', vat_rate_id: '', project_id: '' }
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
export default function SalesInvoices({ clientId }: { clientId: string }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddAccountForLine, setShowAddAccountForLine] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // Quick pay modal
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null)
  const [quickPayAmount, setQuickPayAmount] = useState('')
  const [quickPayDate, setQuickPayDate] = useState(new Date().toISOString().split('T')[0])
  const [quickPayMethod, setQuickPayMethod] = useState('bank_transfer')
  const [quickPayReference, setQuickPayReference] = useState('')
  const [quickPayBankAccountId, setQuickPayBankAccountId] = useState('')
  const [quickPaySaving, setQuickPaySaving] = useState(false)
  const [quickPayError, setQuickPayError] = useState('')
  const [postError, setPostError] = useState<Record<string, string>>({})
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [replacesInvoiceId, setReplacesInvoiceId] = useState<string | null>(null)
  const [contactId, setContactId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const { can } = useRole()
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => { fetchData() }, [clientId])
  async function fetchData() {
    const [invoicesRes, contactsRes, accountsRes, vatRes, projectsRes, banksRes] = await Promise.all([
      supabase.from('sales_invoices').select('*, contacts(name)').eq('client_id', clientId).order('invoice_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_customer', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name, account_type, parent_id, default_vat_rate_id').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('projects').select('id, name').eq('client_id', clientId).eq('status', 'active').order('name'),
      supabase.from('chart_of_accounts').select('id, code, name').eq('client_id', clientId).eq('is_active', true).eq('account_type', 'bank').order('code'),
    ])
    if (invoicesRes.data) setInvoices(invoicesRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
    if (banksRes.data) setBankAccounts(banksRes.data)
    if (accountsRes.data) {
      const parentIds = new Set(accountsRes.data.map((a) => a.parent_id).filter(Boolean))
      setAccounts(accountsRes.data.filter((a) => ['sales', 'revenue', 'other_income'].includes(a.account_type) && !parentIds.has(a.id)))
    }
    if (vatRes.data) setVatRates(vatRes.data)
    setLoading(false)
  }
  function addLine() {
    setLines([...lines, { ...EMPTY_LINE }])
  }
  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }
  function relevantVatRates() {
    const universal = ['no_vat']
    const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']
    return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
  }
  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }
  function lineAmounts(line: LineDraft) {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unit_price) || 0
    const net = qty * price
    const rate = vatRates.find((r) => r.id === line.vat_rate_id)
    const vatAmount = rate ? net * (parseFloat(rate.rate) / 100) : 0
    return { net, vatAmount, gross: net + vatAmount }
  }
  function calculateTotals() {
    let subtotal = 0
    let vatTotal = 0
    lines.forEach((l) => {
      const { net, vatAmount } = lineAmounts(l)
      subtotal += net
      vatTotal += vatAmount
    })
    return { subtotal, vatTotal, total: subtotal + vatTotal }
  }
  function resetForm() {
    setContactId('')
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setNotes('')
    setLines([{ ...EMPTY_LINE }])
    setError('')
    setLineErrors({})
    setReplacesInvoiceId(null)
    setEditingInvoiceId(null)
    setInvoiceNumberInput('')
    suggestNextInvoiceNumber()
  }
  async function logAudit(params: { entityId: string; action: string; oldData?: any; newData?: any; description: string }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'sales_invoice',
      p_entity_id: params.entityId,
      p_action: params.action,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }
  async function openEditForm(invoice: any) {
    setError('')
    setLineErrors({})
    const { data: existingLines } = await supabase
      .from('sales_invoice_lines')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order')
    setEditingInvoiceId(invoice.id)
    setReplacesInvoiceId(null)
    setContactId(invoice.contact_id)
    setInvoiceDate(invoice.invoice_date)
    setDueDate(invoice.due_date)
    setInvoiceNumberInput(invoice.invoice_number)
    setNotes(invoice.notes || '')
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
  async function suggestNextInvoiceNumber() {
    const { count } = await supabase
      .from('sales_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
    setInvoiceNumberInput(`INV-${String((count || 0) + 1).padStart(4, '0')}`)
  }
  function handleContactChange(id: string) {
    setContactId(id)
    const contact = contacts.find((c) => c.id === id)
    const terms = contact?.payment_terms_days ?? 30
    setDueDate(addDays(invoiceDate, terms))
  }
  function openCorrectedInvoice(voidedInvoice: any) {
    resetForm()
    setContactId(voidedInvoice.contact_id)
    const terms = contacts.find((c) => c.id === voidedInvoice.contact_id)?.payment_terms_days ?? 30
    const todayStr = new Date().toISOString().split('T')[0]
    setInvoiceDate(todayStr)
    setDueDate(addDays(todayStr, terms))
    setReplacesInvoiceId(voidedInvoice.id)
    setCreating(true)
  }
  async function runApprovalStep(invoiceId: string, approveAfter: 'none' | 'approve' | 'approve_and_email'): Promise<string> {
    if (approveAfter === 'none') return ''
    const { error: postErr } = await supabase.rpc('post_sales_invoice', { p_invoice_id: invoiceId })
    if (postErr) return postErr.message
    if (approveAfter === 'approve_and_email') {
      const res = await fetch('/api/sales-invoices/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const body = await res.json()
      if (!res.ok) return body.error || 'Approved, but the email could not be sent'
    }
    return ''
  }

  async function handleCreate(approveAfter: 'none' | 'approve' | 'approve_and_email' = 'none') {
    setSaving(true)
    setError('')
    setLineErrors({})
    if (!contactId) { setError('Select a customer'); setSaving(false); return }
    if (!dueDate) { setError('Due date is required'); setSaving(false); return }

    // A line is "touched" if the person has started filling it in at all - an
    // untouched blank line is just ignored, but any line with something in it
    // must be fully complete before saving
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
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }
    const { subtotal, vatTotal, total } = calculateTotals()
    const invoiceNumber = invoiceNumberInput.trim()
    if (!invoiceNumber) { setError('Invoice number is required'); setSaving(false); return }
    const linesPayload = (invoiceId: string) => validLines.map((l, i) => {
      const { net, vatAmount } = lineAmounts(l)
      return {
        invoice_id: invoiceId,
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        income_account_id: l.income_account_id || null,
        vat_rate_id: l.vat_rate_id || null,
        project_id: l.project_id || null,
        vat_amount: vatAmount,
        line_total: net,
        sort_order: i,
      }
    })
    if (editingInvoiceId) {
      const { data: before } = await supabase.from('sales_invoices').select('*, sales_invoice_lines(*)').eq('id', editingInvoiceId).single()
      const { error: updateError } = await supabase
        .from('sales_invoices')
        .update({
          contact_id: contactId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal,
          vat_total: vatTotal,
          total,
          notes: notes || null,
        })
        .eq('id', editingInvoiceId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
      await supabase.from('sales_invoice_lines').delete().eq('invoice_id', editingInvoiceId)
      const { error: linesError } = await supabase.from('sales_invoice_lines').insert(linesPayload(editingInvoiceId))
      if (linesError) { setError(linesError.message); setSaving(false); return }
      const { data: after } = await supabase.from('sales_invoices').select('*, sales_invoice_lines(*)').eq('id', editingInvoiceId).single()
      await logAudit({
        entityId: editingInvoiceId,
        action: 'updated',
        oldData: before,
        newData: after,
        description: `Edited draft invoice "${invoiceNumber}" — now £${total.toFixed(2)} total`,
      })

      const approvalError = await runApprovalStep(editingInvoiceId, approveAfter)
      if (approvalError) {
        setError(`Saved as draft, but: ${approvalError}`)
        setSaving(false)
        fetchData()
        return
      }

      setCreating(false)
      resetForm()
      fetchData()
      setSaving(false)
      return
    }
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        contact_id: contactId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: 'draft',
        subtotal,
        vat_total: vatTotal,
        total,
        notes: notes || null,
        created_by: user!.id,
        replaces_invoice_id: replacesInvoiceId,
      })
      .select()
      .single()
    if (invoiceError) { setError(invoiceError.message); setSaving(false); return }
    const { error: linesError } = await supabase.from('sales_invoice_lines').insert(linesPayload(invoice.id))
    if (linesError) { setError(linesError.message); setSaving(false); return }
    await logAudit({
      entityId: invoice.id,
      action: 'created',
      newData: invoice,
      description: `Created draft invoice "${invoiceNumber}" for £${total.toFixed(2)}`,
    })

    const approvalError = await runApprovalStep(invoice.id, approveAfter)
    if (approvalError) {
      setError(`Saved as draft, but: ${approvalError}`)
      setSaving(false)
      fetchData()
      return
    }

    setCreating(false)
    resetForm()
    fetchData()
    setSaving(false)
  }
  async function handlePost(invoiceId: string) {
    setPostingId(invoiceId)
    setPostError((prev) => ({ ...prev, [invoiceId]: '' }))
    const { error: postErr } = await supabase.rpc('post_sales_invoice', { p_invoice_id: invoiceId })
    if (postErr) {
      setPostError((prev) => ({ ...prev, [invoiceId]: postErr.message }))
      setPostingId(null)
      return
    }
    setPostingId(null)
    fetchData()
  }

  async function handleApproveAndEmail(invoiceId: string) {
    setPostingId(invoiceId)
    setPostError((prev) => ({ ...prev, [invoiceId]: '' }))
    const { error: postErr } = await supabase.rpc('post_sales_invoice', { p_invoice_id: invoiceId })
    if (postErr) {
      setPostError((prev) => ({ ...prev, [invoiceId]: postErr.message }))
      setPostingId(null)
      return
    }
    const res = await fetch('/api/sales-invoices/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
    const body = await res.json()
    if (!res.ok) {
      setPostError((prev) => ({ ...prev, [invoiceId]: body.error || 'Approved, but the email could not be sent' }))
      setPostingId(null)
      fetchData()
      return
    }
    setPostingId(null)
    fetchData()
  }

  function openQuickPay(inv: any) {
    setQuickPayError('')
    setQuickPayDate(new Date().toISOString().split('T')[0])
    setQuickPayMethod('bank_transfer')
    setQuickPayReference('')
    setQuickPayBankAccountId('')
    setQuickPayAmount((parseFloat(inv.total) - parseFloat(inv.amount_paid)).toFixed(2))
    setPayingInvoice(inv)
  }

  async function handleQuickPay() {
    if (!payingInvoice) return
    setQuickPaySaving(true)
    setQuickPayError('')

    const amt = parseFloat(quickPayAmount) || 0
    if (amt <= 0) { setQuickPayError('Enter a payment amount'); setQuickPaySaving(false); return }
    if (!quickPayBankAccountId) { setQuickPayError('Select a bank account'); setQuickPaySaving(false); return }

    const { error } = await supabase.rpc('record_sales_receipt', {
      p_client_id: clientId,
      p_contact_id: payingInvoice.contact_id,
      p_receipt_date: quickPayDate,
      p_payment_method: quickPayMethod,
      p_reference: quickPayReference || null,
      p_bank_account_id: quickPayBankAccountId,
      p_allocations: [{ invoice_id: payingInvoice.id, amount: amt }],
    })

    if (error) {
      setQuickPayError(error.message)
      setQuickPaySaving(false)
      return
    }

    setPayingInvoice(null)
    setQuickPaySaving(false)
    fetchData()
  }

  function openVoid(invoiceId: string) {
    setVoidReason('')
    setVoidError('')
    setVoidingId(invoiceId)
  }
  async function handleVoid() {
    if (!voidingId) return
    if (!voidReason.trim()) {
      setVoidError('A reason is required')
      return
    }
    setVoiding(true)
    setVoidError('')
    const { error: voidErr } = await supabase.rpc('void_sales_invoice', {
      p_invoice_id: voidingId,
      p_reason: voidReason.trim(),
    })
    if (voidErr) {
      setVoidError(voidErr.message)
      setVoiding(false)
      return
    }
    setVoidingId(null)
    setVoiding(false)
    fetchData()
  }
  const { subtotal, vatTotal, total } = calculateTotals()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading sales invoices...</p>
    </div>
  )
  if (contacts.length === 0 && !creating) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No customers available</p>
      <p className="text-gray-400 text-xs">Add a customer in Contacts first before creating invoices</p>
    </div>
  )
  return (
    <div className="space-y-6">
      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => { resetForm(); setCreating(true) }}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Invoice
          </button>
        </div>
      )}
      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
            {editingInvoiceId ? 'Edit Draft Invoice' : replacesInvoiceId ? 'Corrected Invoice' : 'New Sales Invoice'}
          </h3>
          <p className="text-xs text-gray-400 -mt-2">
            {replacesInvoiceId
              ? 'This will be linked as a correction to the voided invoice'
              : "Creating directly — this won't be linked to a Sales Order"}
          </p>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice number</label>
              <input type="text" value={invoiceNumberInput} onChange={(e) => setInvoiceNumberInput(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
              <select
                value={contactId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') { setShowAddCustomer(true); return }
                  handleContactChange(e.target.value)
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
                onCreated={(contact) => {
                  setContacts((prev) => [...prev, contact])
                  handleContactChange(contact.id)
                  setShowAddCustomer(false)
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice date</label>
              <DatePicker value={invoiceDate} onChange={setInvoiceDate} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
              <DatePicker value={dueDate} onChange={setDueDate} className="w-full" />
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
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      placeholder="Item or service"
                      className="col-span-4 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      className="col-span-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    />
                    <select
                      value={line.income_account_id}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') { setShowAddAccountForLine(index); return }
                        updateLine(index, 'income_account_id', e.target.value)
                        const account = accounts.find((a) => a.id === e.target.value)
                        if (account && !line.vat_rate_id) {
                          updateLine(index, 'vat_rate_id', account.default_vat_rate_id || '')
                        }
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
                      onCreated={(account) => {
                        setAccounts((prev) => [...prev, account])
                        updateLine(index, 'income_account_id', account.id)
                        setShowAddAccountForLine(null)
                      }}
                    />
                    <select
                      value={line.vat_rate_id}
                      onChange={(e) => updateLine(index, 'vat_rate_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">Select VAT rate...</option>
                      {relevantVatRates().map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                    </select>
                    <button
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="col-span-1 text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {lineErrors[index] && (
                    <p className="text-xs text-red-600 pl-1 mt-1 font-medium">⚠ {lineErrors[index]}</p>
                  )}
                  {(net > 0) && (
                    <p className="text-xs text-gray-400 pl-1 mt-0.5">
                      Net £{net.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = £{(net + vatAmount).toFixed(2)}
                    </p>
                  )}
                  {projects.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-gray-400">Project:</label>
                      <select
                        value={line.project_id || ''}
                        onChange={(e) => updateLine(index, 'project_id', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold"
                      >
                        <option value="">No project</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addLine} className="text-xs text-brand-dark font-medium hover:underline">
            + Add line
          </button>
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
            <ActionDropdown
              loading={saving}
              loadingLabel="Saving..."
              primary={{ key: 'save_draft', label: editingInvoiceId ? 'Save Changes' : 'Save as Draft', onClick: () => handleCreate('none') }}
              options={[
                { key: 'approve', label: 'Approve', onClick: () => handleCreate('approve') },
                { key: 'approve_email', label: 'Approve and Email', onClick: () => handleCreate('approve_and_email') },
              ]}
            />
            <button onClick={() => { setCreating(false); resetForm() }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
      {invoices.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No invoices yet</p>
          <p className="text-gray-400 text-xs">Create one directly, or convert an accepted Sales Order</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Invoice date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Due date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Paid</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <>
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">
                      <button
                        onClick={() => router.push(`/accounting/${clientId}/sales-invoices/${inv.id}`)}
                        className="text-brand-dark hover:underline font-semibold"
                      >
                        {inv.invoice_number}
                      </button>
                      {inv.replaces_invoice_id && <span className="block text-xs text-gray-400">corrects a voided invoice</span>}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{inv.contacts?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(inv.due_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(inv.total).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">£{parseFloat(inv.amount_paid).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[inv.status]}`}>
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                      {inv.status === 'void' && inv.voided_reason && (
                        <span className="block text-xs text-gray-400 mt-0.5">{inv.voided_reason}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                      {can.manageEngagements && inv.status === 'draft' && (
                        <button
                          onClick={() => openEditForm(inv)}
                          className="text-xs bg-gray-100 text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
                        >
                          Edit
                        </button>
                      )}
                      {can.manageEngagements && inv.status === 'draft' && (
                        <ActionDropdown
                          loading={postingId === inv.id}
                          loadingLabel="Approving..."
                          primary={{ key: 'approve', label: 'Approve', onClick: () => handlePost(inv.id) }}
                          options={[{ key: 'approve_email', label: 'Approve and Email', onClick: () => handleApproveAndEmail(inv.id) }]}
                        />
                      )}
                      {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(inv.status) && (
                        <button
                          onClick={() => openQuickPay(inv)}
                          title="Record a payment"
                          className="text-xs bg-green-50 text-green-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
                        >
                          💷 Pay
                        </button>
                      )}
                      {can.manageEngagements && ['awaiting_payment', 'partially_paid'].includes(inv.status) && parseFloat(inv.amount_paid) === 0 && (
                        <button
                          onClick={() => openVoid(inv.id)}
                          className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
                        >
                          Void
                        </button>
                      )}
                      {can.manageEngagements && inv.status === 'void' && (
                        <button
                          onClick={() => openCorrectedInvoice(inv)}
                          className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition"
                        >
                          Create corrected invoice
                        </button>
                      )}
                      {inv.journal_entry_id && !['draft', 'void'].includes(inv.status) && (
                        <span className="text-xs text-gray-400">Posted ✓</span>
                      )}
                    </td>
                  </tr>
                  {postError[inv.id] && (
                    <tr>
                      <td colSpan={8} className="px-6 py-3 bg-red-50">
                        <p className="text-red-600 text-xs">{postError[inv.id]}</p>
                        {postError[inv.id].includes('Control accounts') && (
                          <p className="text-red-500 text-xs mt-1">
                            Go to the Accounting → Settings tab and map all six control accounts before posting invoices.
                          </p>
                        )}
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
      <ConfirmModal
        isOpen={!!voidingId}
        title="Void this invoice?"
        message="This creates a reversing journal entry. The invoice record stays visible with its void reason, and can be corrected by creating a replacement."
        confirmLabel="Void invoice"
        cancelLabel="Cancel"
        confirming={voiding}
        danger
        requireInput
        inputLabel="Reason for voiding"
        inputValue={voidReason}
        onInputChange={setVoidReason}
        inputPlaceholder="e.g. Incorrect amount, wrong customer"
        inputError={voidError}
        onConfirm={handleVoid}
        onCancel={() => setVoidingId(null)}
      />

      {payingInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-brand-dark">
              Record payment — {payingInvoice.invoice_number}
            </h3>
            {quickPayError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{quickPayError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
              <input
                type="number"
                value={quickPayAmount}
                onChange={(e) => setQuickPayAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <DatePicker value={quickPayDate} onChange={setQuickPayDate} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
              <select
                value={quickPayMethod}
                onChange={(e) => setQuickPayMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bank Account</label>
              <select
                value={quickPayBankAccountId}
                onChange={(e) => setQuickPayBankAccountId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="">Select account...</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference (optional)</label>
              <input
                type="text"
                value={quickPayReference}
                onChange={(e) => setQuickPayReference(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleQuickPay}
                disabled={quickPaySaving}
                className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {quickPaySaving ? 'Recording...' : 'Record Payment'}
              </button>
              <button
                onClick={() => setPayingInvoice(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
