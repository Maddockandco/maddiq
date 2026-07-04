'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

export default function SalesInvoices({ clientId }: { clientId: string }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchInvoices() }, [clientId])

  async function fetchInvoices() {
    const { data } = await supabase
      .from('sales_invoices')
      .select('*, contacts(name)')
      .eq('client_id', clientId)
      .order('invoice_date', { ascending: false })
    if (data) setInvoices(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading sales invoices...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 text-amber-700 text-sm rounded-xl px-4 py-3">
        Invoices are created by converting an accepted Sales Order. Posting to the ledger (turning a draft into a real journal entry) is coming next — for now this is a read-only view.
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No invoices yet</p>
          <p className="text-gray-400 text-xs">Convert an accepted Sales Order to create one</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
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
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">{inv.invoice_number}</td>
                  <td className="px-6 py-3 text-sm font-medium text-brand-dark">{inv.contacts?.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{new Date(inv.due_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-brand-dark">£{parseFloat(inv.total).toFixed(2)}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-500">£{parseFloat(inv.amount_paid).toFixed(2)}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[inv.status]}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
