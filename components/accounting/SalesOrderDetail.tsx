'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import TransactionAuditTrail from '@/components/accounting/TransactionAuditTrail'

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

export default function SalesOrderDetail({ clientId, orderId }: { clientId: string; orderId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { can } = useRole()

  const [order, setOrder] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)

  const [showConvert, setShowConvert] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  useEffect(() => { fetchData() }, [orderId])

  async function fetchData() {
    setLoading(true)
    const { data: o } = await supabase
      .from('sales_orders')
      .select('*, contacts(name, email, phone, payment_terms_days)')
      .eq('id', orderId)
      .single()

    const { data: orderLines } = await supabase
      .from('sales_order_lines')
      .select('*, chart_of_accounts(code, name)')
      .eq('order_id', orderId)
      .order('sort_order')

    setOrder(o)
    setLines(orderLines || [])
    setLoading(false)
  }

  async function logAudit(params: { action: string; oldData?: any; newData?: any; description: string }) {
    const { error: logError } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'sales_order',
      p_entity_id: orderId,
      p_action: params.action,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_description: params.description,
    })
    if (logError) console.error('Audit log failed:', logError.message)
  }

  async function handleStatusChange(newStatus: string) {
    setSavingStatus(true)
    const oldStatus = order.status
    await supabase.from('sales_orders').update({ status: newStatus }).eq('id', orderId)
    await logAudit({
      action: 'updated',
      oldData: { status: oldStatus },
      newData: { status: newStatus },
      description: `Changed status of "${order.order_number}" from ${oldStatus} to ${newStatus}`,
    })
    setSavingStatus(false)
    fetchData()
  }

  function openConvert() {
    const todayStr = new Date().toISOString().split('T')[0]
    const terms = order.contacts?.payment_terms_days ?? 30
    setInvoiceDate(todayStr)
    setDueDate(addDays(todayStr, terms))
    setConvertError('')
    setShowConvert(true)
  }

  async function handleConvert() {
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

    await logAudit({
      action: 'converted_to_invoice',
      description: `Converted "${order.order_number}" to a sales invoice`,
    })

    setConverting(false)
    setShowConvert(false)
    fetchData()
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading order...</p>
    </div>
  )

  if (!order) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Order not found</p>
    </div>
  )

  const contact = order.contacts
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/sales-orders`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to sales orders
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Sales Order</p>
            <h1 className="text-2xl font-bold text-brand-dark font-mono">{order.order_number}</h1>
          </div>
          <div className="text-right">
            {can.manageEngagements && !['converted', 'cancelled'].includes(order.status) ? (
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={savingStatus}
                className={`text-sm px-3 py-1.5 rounded-full font-medium border-0 ${STATUS_STYLES[order.status]}`}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <span className={`text-sm px-3 py-1.5 rounded-full font-medium capitalize ${STATUS_STYLES[order.status]}`}>
                {order.status}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Customer</p>
            <p className="text-brand-dark font-medium">{contact?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Order Date</p>
            <p className="text-brand-dark">{new Date(order.order_date).toLocaleDateString('en-GB')}</p>
          </div>
          {order.expected_date && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Expected Date</p>
              <p className="text-brand-dark">{new Date(order.expected_date).toLocaleDateString('en-GB')}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
            <p className="text-brand-dark font-semibold">£{parseFloat(order.total).toFixed(2)}</p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Account</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Unit Price</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">VAT</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-brand-dark">{l.description}</td>
                    <td className="px-4 py-2 text-gray-500">{l.chart_of_accounts ? `${l.chart_of_accounts.code} — ${l.chart_of_accounts.name}` : '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{l.quantity}</td>
                    <td className="px-4 py-2 text-right text-gray-600">£{parseFloat(l.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">£{parseFloat(l.vat_amount).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium text-brand-dark">£{parseFloat(l.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-brand-dark">£{parseFloat(order.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="text-brand-dark">£{parseFloat(order.vat_total).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold border-t border-gray-100 pt-1"><span className="text-brand-dark">Total</span><span className="text-brand-dark">£{parseFloat(order.total).toFixed(2)}</span></div>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}

        {can.manageEngagements && order.status === 'accepted' && !showConvert && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button onClick={openConvert} className="bg-brand-gold text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              Convert to Invoice
            </button>
          </div>
        )}

        {order.status === 'converted' && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-400">✓ This order has been converted to a sales invoice</p>
          </div>
        )}

        {showConvert && (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            {convertError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{convertError}</div>}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice date</label>
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </div>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {converting ? 'Converting...' : 'Confirm conversion'}
              </button>
              <button onClick={() => setShowConvert(false)} className="bg-gray-100 text-gray-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionAuditTrail entityType="sales_order" entityId={orderId} />
    </div>
  )
}
