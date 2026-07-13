'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  processing: 'bg-amber-100 text-amber-700',
  extracted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
  linked: 'bg-blue-100 text-blue-700',
}

export default function ReceiptCapture({ clientId }: { clientId: string }) {
  const supabase = createClient()

  const [extractions, setExtractions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [bankTransactions, setBankTransactions] = useState<any[]>([])

  // Review panel draft state, keyed by extraction id
  const [draftDirection, setDraftDirection] = useState<Record<string, 'purchase' | 'sale'>>({})
  const [draftContactId, setDraftContactId] = useState<Record<string, string>>({})
  const [draftNewContactName, setDraftNewContactName] = useState<Record<string, string>>({})
  const [draftDate, setDraftDate] = useState<Record<string, string>>({})
  const [draftDocNumber, setDraftDocNumber] = useState<Record<string, string>>({})
  const [draftLines, setDraftLines] = useState<Record<string, any[]>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveError, setSaveError] = useState<Record<string, string>>({})
  const [showAttachPicker, setShowAttachPicker] = useState<Record<string, boolean>>({})

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [extractionsRes, accountsRes, vatRes, contactsRes] = await Promise.all([
      supabase.from('document_extractions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('chart_of_accounts').select('id, code, name, account_type, parent_id, default_vat_rate_id').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('contacts').select('id, name, is_supplier, is_customer').eq('client_id', clientId).eq('is_active', true).order('name'),
    ])
    if (extractionsRes.data) setExtractions(extractionsRes.data)
    if (accountsRes.data) {
      const parentIds = new Set(accountsRes.data.map((a) => a.parent_id).filter(Boolean))
      setAllAccounts(accountsRes.data.filter((a) => !parentIds.has(a.id)))
    }
    if (vatRes.data) setVatRates(vatRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    setLoading(false)
  }

  function postableAccountsFor(category: 'expense' | 'income') {
    const expenseTypes = ['direct_costs', 'expense', 'overhead']
    const incomeTypes = ['sales', 'revenue', 'other_income']
    return allAccounts.filter((a) => (category === 'expense' ? expenseTypes.includes(a.account_type) : incomeTypes.includes(a.account_type)))
  }

  function relevantVatRates(category: 'expense' | 'income') {
    const universal = ['no_vat']
    const expenseOnly = ['reverse_charge_expense_20', 'reverse_charge_construction', 'vat_on_imports', 'ec_acquisitions_20', 'ec_acquisitions_zero']
    const incomeOnly = ['zero_ec_goods_income', 'zero_ec_services_income', 'oss_digital_services', 'toms_margin', 'flat_rate']
    if (category === 'expense') return vatRates.filter((r) => r.code.endsWith('_expense') || universal.includes(r.code) || expenseOnly.includes(r.code))
    return vatRates.filter((r) => r.code.endsWith('_income') || universal.includes(r.code) || incomeOnly.includes(r.code))
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setUploadError('Could not find your firm'); setUploading(false); return }

    const path = `${clientId}/receipts/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
    if (uploadErr) { setUploadError(uploadErr.message); setUploading(false); return }

    const { data: extraction, error: insertErr } = await supabase
      .from('document_extractions')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        file_path: path,
        file_name: file.name,
        uploaded_by: user!.id,
      })
      .select()
      .single()

    if (insertErr || !extraction) { setUploadError(insertErr?.message || 'Could not save the upload'); setUploading(false); return }

    setExtractions((prev) => [extraction, ...prev])
    setUploading(false)
    triggerExtraction(extraction.id)
  }

  async function triggerExtraction(extractionId: string) {
    setExtractions((prev) => prev.map((e) => (e.id === extractionId ? { ...e, status: 'processing' } : e)))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/receipts/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ extractionId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      fetchAll()
    } catch (err) {
      fetchAll()
    }
  }

  function openReview(extraction: any) {
    if (reviewingId === extraction.id) { setReviewingId(null); return }
    setReviewingId(extraction.id)
    const d = extraction.extracted_data
    if (!d) return

    setSaveError((prev) => ({ ...prev, [extraction.id]: '' }))
    const direction: 'purchase' | 'sale' = d.direction === 'sale' ? 'sale' : 'purchase'
    setDraftDirection((prev) => ({ ...prev, [extraction.id]: direction }))
    setDraftDate((prev) => ({ ...prev, [extraction.id]: d.document_date || new Date().toISOString().split('T')[0] }))
    setDraftDocNumber((prev) => ({ ...prev, [extraction.id]: d.document_number || '' }))

    const nameToMatch = (d.vendor_or_customer_name || '').toLowerCase()
    const relevantContacts = contacts.filter((c) => (direction === 'purchase' ? c.is_supplier : c.is_customer))
    const match = relevantContacts.find((c) => c.name.toLowerCase() === nameToMatch) ||
      relevantContacts.find((c) => c.name.toLowerCase().includes(nameToMatch) || nameToMatch.includes(c.name.toLowerCase()))
    setDraftContactId((prev) => ({ ...prev, [extraction.id]: match?.id || '' }))
    setDraftNewContactName((prev) => ({ ...prev, [extraction.id]: match ? '' : (d.vendor_or_customer_name || '') }))

    const category = direction === 'purchase' ? 'expense' : 'income'
    const defaultAccount = postableAccountsFor(category)[0]
    const lines = (d.line_items && d.line_items.length > 0 ? d.line_items : [{ description: d.vendor_or_customer_name || 'Item', quantity: 1, unit_price: d.total_amount || 0 }]).map((l: any) => ({
      description: l.description || '',
      quantity: String(l.quantity || 1),
      unit_price: String(l.unit_price || 0),
      accountId: defaultAccount?.id || '',
      vatRateId: defaultAccount?.default_vat_rate_id || '',
    }))
    setDraftLines((prev) => ({ ...prev, [extraction.id]: lines }))
  }

  function updateLine(extractionId: string, index: number, field: string, value: string) {
    setDraftLines((prev) => ({
      ...prev,
      [extractionId]: prev[extractionId].map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }))
  }

  function lineTotals(extractionId: string) {
    const lines = draftLines[extractionId] || []
    let subtotal = 0
    let vatTotal = 0
    lines.forEach((l) => {
      const net = (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0)
      const rate = vatRates.find((r) => r.id === l.vatRateId)
      const vat = rate ? net * (rate.rate / 100) : 0
      subtotal += net
      vatTotal += vat
    })
    return { subtotal, vatTotal, total: subtotal + vatTotal }
  }

  async function ensureContact(extraction: any, direction: 'purchase' | 'sale', firmId: string) {
    const existingId = draftContactId[extraction.id]
    if (existingId) return existingId

    const name = draftNewContactName[extraction.id]?.trim()
    if (!name) throw new Error('Enter a contact name')

    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        firm_id: firmId,
        client_id: clientId,
        name,
        is_supplier: direction === 'purchase',
        is_customer: direction === 'sale',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    setContacts((prev) => [...prev, newContact])
    return newContact.id
  }

  async function handleCreateBillOrInvoice(extraction: any) {
    const direction = draftDirection[extraction.id]
    setSaving((prev) => ({ ...prev, [extraction.id]: true }))
    setSaveError((prev) => ({ ...prev, [extraction.id]: '' }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
      if (!firmUser) throw new Error('Could not find your firm')

      const contactId = await ensureContact(extraction, direction, firmUser.firm_id)
      const { subtotal, vatTotal, total } = lineTotals(extraction.id)
      const lines = draftLines[extraction.id] || []

      if (lines.some((l) => !l.accountId)) {
        throw new Error('Select an account for every line item')
      }

      if (direction === 'purchase') {
        const { data: bill, error: billError } = await supabase
          .from('purchase_bills')
          .insert({
            firm_id: firmUser.firm_id,
            client_id: clientId,
            contact_id: contactId,
            bill_number: draftDocNumber[extraction.id] || null,
            bill_date: draftDate[extraction.id],
            due_date: draftDate[extraction.id],
            status: 'draft',
            subtotal,
            vat_total: vatTotal,
            total,
            notes: `Created from receipt capture: ${extraction.file_name}`,
            created_by: user!.id,
          })
          .select()
          .single()
        if (billError) throw new Error(billError.message)

        const linesToInsert = lines.map((l, i) => ({
          bill_id: bill.id,
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          expense_account_id: l.accountId,
          vat_rate_id: l.vatRateId || null,
          vat_amount: (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * ((vatRates.find((r) => r.id === l.vatRateId)?.rate || 0) / 100),
          line_total: (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0),
          sort_order: i,
        }))
        const { error: linesError } = await supabase.from('purchase_bill_lines').insert(linesToInsert)
        if (linesError) throw new Error(linesError.message)

        await supabase.from('document_extractions').update({ status: 'linked', linked_type: 'purchase_bill', linked_id: bill.id }).eq('id', extraction.id)
      } else {
        const { count } = await supabase.from('sales_invoices').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
        const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

        const { data: invoice, error: invoiceError } = await supabase
          .from('sales_invoices')
          .insert({
            firm_id: firmUser.firm_id,
            client_id: clientId,
            contact_id: contactId,
            invoice_number: invoiceNumber,
            invoice_date: draftDate[extraction.id],
            due_date: draftDate[extraction.id],
            status: 'draft',
            subtotal,
            vat_total: vatTotal,
            total,
            notes: `Created from receipt capture: ${extraction.file_name}`,
            created_by: user!.id,
          })
          .select()
          .single()
        if (invoiceError) throw new Error(invoiceError.message)

        const linesToInsert = lines.map((l, i) => ({
          invoice_id: invoice.id,
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          income_account_id: l.accountId,
          vat_rate_id: l.vatRateId || null,
          vat_amount: (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * ((vatRates.find((r) => r.id === l.vatRateId)?.rate || 0) / 100),
          line_total: (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0),
          sort_order: i,
        }))
        const { error: linesError } = await supabase.from('sales_invoice_lines').insert(linesToInsert)
        if (linesError) throw new Error(linesError.message)

        await supabase.from('document_extractions').update({ status: 'linked', linked_type: 'sales_invoice', linked_id: invoice.id }).eq('id', extraction.id)
      }

      setReviewingId(null)
      fetchAll()
    } catch (err: any) {
      setSaveError((prev) => ({ ...prev, [extraction.id]: err.message }))
    }
    setSaving((prev) => ({ ...prev, [extraction.id]: false }))
  }

  async function loadUnreconciledTransactions(extractionId: string) {
    const { data } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'unreconciled')
      .order('transaction_date', { ascending: false })
      .limit(30)
    if (data) setBankTransactions(data)
    setShowAttachPicker((prev) => ({ ...prev, [extractionId]: true }))
  }

  async function handleAttachToTransaction(extraction: any, transactionId: string) {
    setSaving((prev) => ({ ...prev, [extraction.id]: true }))
    const d = extraction.extracted_data
    const summary = `Receipt: ${d?.vendor_or_customer_name || ''} — £${d?.total_amount || ''} on ${d?.document_date || ''}`

    await supabase.from('bank_transactions').update({ notes: summary }).eq('id', transactionId)
    await supabase.from('document_extractions').update({ status: 'linked', linked_type: 'bank_transaction', linked_id: transactionId }).eq('id', extraction.id)

    setSaving((prev) => ({ ...prev, [extraction.id]: false }))
    setShowAttachPicker((prev) => ({ ...prev, [extraction.id]: false }))
    setReviewingId(null)
    fetchAll()
  }

  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Capture a Receipt or Invoice</h3>
        <label
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDraggingOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFileUpload(f)
          }}
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDraggingOver ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 hover:border-brand-gold'
          }`}
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
          <p className="text-sm text-gray-500">
            {uploading ? 'Uploading and extracting...' : isDraggingOver ? 'Drop it here' : 'Drag & drop a photo, scan, or PDF here — or click to browse'}
          </p>
        </label>
        {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : extractions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No documents captured yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {extractions.map((ext) => {
            const d = ext.extracted_data
            const isReviewing = reviewingId === ext.id
            const direction = draftDirection[ext.id] || 'purchase'
            const category = direction === 'purchase' ? 'expense' : 'income'
            const totals = lineTotals(ext.id)

            return (
              <div key={ext.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => ext.status === 'extracted' && openReview(ext)}
                  disabled={ext.status !== 'extracted'}
                  className="w-full flex items-center justify-between p-4 text-left disabled:cursor-default"
                >
                  <div>
                    <p className="text-sm font-medium text-brand-dark">{ext.file_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(ext.created_at).toLocaleString('en-GB')}
                      {d?.vendor_or_customer_name && ` · ${d.vendor_or_customer_name}`}
                      {d?.total_amount != null && ` · £${d.total_amount}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[ext.status]}`}>
                    {ext.status === 'linked' ? `Linked — ${ext.linked_type?.replace(/_/g, ' ')}` : ext.status}
                  </span>
                </button>

                {ext.status === 'failed' && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-red-600 mb-2">{ext.error_message}</p>
                    <button onClick={() => triggerExtraction(ext.id)} className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg">
                      Retry extraction
                    </button>
                  </div>
                )}

                {isReviewing && d && (
                  <div className="border-t border-gray-100 bg-brand-light/40 p-5 space-y-4">
                    {d.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.confidence === 'high' ? 'bg-green-100 text-green-700' : d.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {d.confidence} confidence
                      </span>
                    )}
                    {d.notes && <p className="text-xs text-gray-500 italic">"{d.notes}"</p>}

                    {saveError[ext.id] && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{saveError[ext.id]}</div>}

                    <div className="flex gap-1 bg-white rounded-lg p-1 w-fit border border-gray-200">
                      <button
                        onClick={() => setDraftDirection((prev) => ({ ...prev, [ext.id]: 'purchase' }))}
                        className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${direction === 'purchase' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
                      >
                        Purchase (money out)
                      </button>
                      <button
                        onClick={() => setDraftDirection((prev) => ({ ...prev, [ext.id]: 'sale' }))}
                        className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${direction === 'sale' ? 'bg-brand-dark text-white' : 'text-gray-500'}`}
                      >
                        Sale (money in)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{direction === 'purchase' ? 'Supplier' : 'Customer'}</label>
                        <select
                          value={draftContactId[ext.id] || ''}
                          onChange={(e) => setDraftContactId((prev) => ({ ...prev, [ext.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        >
                          <option value="">+ Create new: {draftNewContactName[ext.id] || '...'}</option>
                          {contacts.filter((c) => (direction === 'purchase' ? c.is_supplier : c.is_customer)).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {!draftContactId[ext.id] && (
                          <input
                            type="text"
                            value={draftNewContactName[ext.id] || ''}
                            onChange={(e) => setDraftNewContactName((prev) => ({ ...prev, [ext.id]: e.target.value }))}
                            className={`${inputClass} w-full bg-white mt-2`}
                            placeholder="New contact name"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                        <input
                          type="date"
                          value={draftDate[ext.id] || ''}
                          onChange={(e) => setDraftDate((prev) => ({ ...prev, [ext.id]: e.target.value }))}
                          className={`${inputClass} w-full bg-white`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-500">Line items</label>
                      {(draftLines[ext.id] || []).map((line, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(ext.id, i, 'description', e.target.value)}
                            className={`${inputClass} col-span-4 bg-white`}
                          />
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(ext.id, i, 'quantity', e.target.value)}
                            className={`${inputClass} col-span-1 bg-white`}
                          />
                          <input
                            type="number"
                            value={line.unit_price}
                            onChange={(e) => updateLine(ext.id, i, 'unit_price', e.target.value)}
                            className={`${inputClass} col-span-2 bg-white`}
                          />
                          <select
                            value={line.accountId}
                            onChange={(e) => updateLine(ext.id, i, 'accountId', e.target.value)}
                            className={`${inputClass} col-span-3 bg-white`}
                          >
                            <option value="">Account</option>
                            {postableAccountsFor(category).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                          </select>
                          <select
                            value={line.vatRateId}
                            onChange={(e) => updateLine(ext.id, i, 'vatRateId', e.target.value)}
                            className={`${inputClass} col-span-2 bg-white`}
                          >
                            <option value="">No VAT</option>
                            {relevantVatRates(category).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500">
                        Net: £{totals.subtotal.toFixed(2)} · VAT: £{totals.vatTotal.toFixed(2)} · Gross: £{totals.total.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleCreateBillOrInvoice(ext)}
                        disabled={saving[ext.id]}
                        className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                      >
                        {saving[ext.id] ? 'Creating...' : direction === 'purchase' ? 'Create Purchase Bill' : 'Create Sales Invoice'}
                      </button>
                      <button
                        onClick={() => loadUnreconciledTransactions(ext.id)}
                        className="bg-gray-100 text-brand-dark font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition"
                      >
                        Attach to Bank Transaction instead
                      </button>
                    </div>

                    {showAttachPicker[ext.id] && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                        {bankTransactions.length === 0 ? (
                          <p className="text-xs text-gray-400">No unreconciled bank transactions found</p>
                        ) : bankTransactions.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleAttachToTransaction(ext, t.id)}
                            className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-brand-light transition"
                          >
                            <span className="text-sm text-brand-dark">{t.description}</span>
                            <span className="text-sm text-gray-400">{new Date(t.transaction_date).toLocaleDateString('en-GB')} · £{Math.abs(t.amount).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
