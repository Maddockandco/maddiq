'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

type LineDraft = {
  description: string
  quantity: string
  unit_price: string
  income_account_id: string
  vat_rate_id: string
}

const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unit_price: '', income_account_id: '', vat_rate_id: '' }

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  converted: 'bg-brand-gold/20 text-brand-dark',
  cancelled: 'bg-red-100 text-red-600',
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function SalesOrders({ clientId }: { clientId: string }) {
  const [orders, setOrders] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [vatRates, setVatRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [contactId, setContactId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const [ordersRes, contactsRes, accountsRes, vatRes] = await Promise.all([
      supabase.from('sales_orders').select('*, contacts(name, payment_terms_days)').eq('client_id', clientId).order('order_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_customer', true).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('client_id', clientId).eq('is_active', true).order('code'),
      supabase.from('vat_rates').select('*').eq('type', 'sales').order('rate', { ascending: true }),
    ])
    if (ordersRes.data) setOrders(ordersRes.data)
    if (contactsRes.data) setContacts(contactsRes.data)
    if (accountsRes.data) setAccounts(accountsRes.data.filter((a) => ['sales', 'revenue', 'other_income'].includes(a.account_type)))
    if (vatRes.data) setVatRates(vatRes.data)
    setLoading(false)
  }

  function addLine() {
    setLines([...lines, { ...EMPTY_LINE }])
  }

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
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
    setOrderDate(new Date().toISOString().split('T')[0])
    setExpectedDate('')
    setNotes('')
    setLines([{ ...EMPTY_LINE }])
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    if (!contactId) { setError('Select a customer'); setSaving(false); return }
    const validLines = lines.filter((l) => l.description && parseFloat(l.unit_price) > 0)
    if (validLines.length === 0) { setError('At least one line with a description and price is required'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { subtotal, vatTotal, total } = calculateTotals()

    const { count } = await supabase
      .from('sales_orders')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
    const orderNumber = `SO-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        contact_id: contactId,
        order_number: orderNumber,
        order_date: orderDate,
        expected_date: expectedDate || null,
        status: 'draft',
        subtotal,
        vat_total: vatTotal,
        total,
        notes: notes || null,
        created_by: user!.id,
      })
      .select()
      .single()

    if (orderError) { setError(orderError.message); setSaving(false); return }

    const linesToInsert = validLines.map((l, i) => {
      const { net, vatAmount } = lineAmounts(l)
      return {
        order_id: order.id,
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        income_account_id: l.income_account_id || null,
        vat_rate_id: l.vat_rate_id || null,
        vat_amount: vatAmount,
        line_total: net,
        sort_order: i,
      }
    })

    const { error: linesError } = await supabase.from('sales_order_lines').insert(linesToInsert)
    if (linesError) { setError(linesError.message); setSaving(false); return }

    setCreating(false)
    resetForm()
    fetchData()
    setSaving(false)
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    await supabase.from('sales_orders').update({ status: newStatus }).eq('id', orderId)
    setOrders(orders.map((o) => o.id === orderId ? { ...o, status: newStatus } : o))
  }

  function openConvert(order: any) {
    const today = new Date().toISOString().split('T')[0]
    const terms = order.contacts?.payment_terms_days ?? 30
    setInvoiceDate(today)
    setDueDate(addDays(today, terms))
    setConvertError('')
    setConvertingOrderId(order.id)
  }

  async function handleConvert(orderId: string) {
    setConverting(true)
    setConvertError('')

    const { error: convertErr } = await supabase.rpc('convert_sales_order_to_invoice', {
      p_order_id: orderId,
      p_invoice_date: invoiceDate,
      p_due_date: dueDate,
    })

    if (convertErr) {
      setConvertError(convertErr.message)
      setConverting(false)
      return
    }

    setConvertingOrderId(null)
    setConverting(false)
    fetchData()
  }

  const { subtotal, vatTotal, total } = calculateTotals()
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading sales orders...</p>
    </div>
  )

  if (contacts.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
      <p className="text-gray-500 text-sm mb-2">No customers available</p>
      <p className="text-gray-400 text-xs">Add a customer in Contacts first before creating sales orders</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Sales Order
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New Sales Order</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
                <option value="">Select customer</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Order date</label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected date</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputClass} />
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
                <div key={index}>
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
                      onChange={(e) => updateLine(index, 'income_account_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">Account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <select
                      value={line.vat_rate_id}
                      onChange={(e) => updateLine(index, 'vat_rate_id', e.target.value)}
                      className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                    >
                      <option value="">No VAT</option>
                      {vatRates.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                    </select>
                    <button
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="col-span-1 text-red-400 hover:text-red-600 text-xs disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {(net > 0) && (
                    <p className="text-xs text-gray-400 pl-1 mt-0.5">
                      Net £{net.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = £{(net + vatAmount).toFixed(2)}
                    </p>
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
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save as draft'}
            </button>
            <button onClick={() => { setCreating(false); resetForm() }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {orders.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No sales orders yet</p>
        </div>
      ) : !creating && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Order #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <>
                  <tr key={o.id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">{o.order_number}</td>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{o.contacts?.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(o.order_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(o.total).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      {can.manageEngagements && !['converted', 'cancelled'].includes(o.status) ? (
                        <select
                          value={o.status}
                          onChange={(e) => handleStatusChange(o.id, e.target.value)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 ${STATUS_STYLES[o.status]}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="accepted">Accepted</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[o.status]}`}>
                          {o.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {can.manageEngagements && o.status === 'accepted' && (
                        <button
                          onClick={() => openConvert(o)}
                          className="text-xs bg-brand-gold text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition"
                        >
                          Convert to Invoice
                        </button>
                      )}
                      {o.status === 'converted' && (
                        <span className="text-xs text-gray-400">Invoice created</span>
                      )}
                    </td>
                  </tr>
                  {convertingOrderId === o.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="flex items-end gap-4">
                          {convertError && <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{convertError}</div>}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice date</label>
                            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                          </div>
                          <button
                            onClick={() => handleConvert(o.id)}
                            disabled={converting}
                            className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
                          >
                            {converting ? 'Converting...' : 'Confirm conversion'}
                          </button>
                          <button
                            onClick={() => setConvertingOrderId(null)}
                            className="text-sm text-gray-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
