'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TransactionAuditTrail from '@/components/accounting/TransactionAuditTrail'

export default function DividendDetail({ clientId, dividendId }: { clientId: string; dividendId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { can } = useRole()

  const [dividend, setDividend] = useState<any>(null)
  const [allocations, setAllocations] = useState<any[]>([])
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingVoucherId, setViewingVoucherId] = useState<string | null>(null)

  const [showMarkPaid, setShowMarkPaid] = useState(false)
  const [payingAllocationId, setPayingAllocationId] = useState<string | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState('')

  useEffect(() => { fetchData() }, [dividendId])

  async function fetchData() {
    setLoading(true)
    const [divRes, allocRes, clientRes, accRes] = await Promise.all([
      supabase.from('dividends').select('*').eq('id', dividendId).single(),
      supabase.from('dividend_allocations').select('*, shareholders(name, share_class)').eq('dividend_id', dividendId),
      supabase.from('clients').select('name').eq('id', clientId).single(),
      supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('client_id', clientId).eq('is_active', true).eq('account_type', 'bank').order('code'),
    ])
    setDividend(divRes.data)
    setAllocations(allocRes.data || [])
    setClientName(clientRes.data?.name || '')
    setAccounts(accRes.data || [])
    setLoading(false)
  }

  function openCancel() {
    setCancelReason('')
    setCancelError('')
    setShowCancel(true)
  }

  async function handleCancel() {
    setCancelling(true)
    setCancelError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setCancelError('Could not find your firm'); setCancelling(false); return }

    const { data: originalLines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit')
      .eq('journal_entry_id', dividend.declaration_journal_entry_id)

    const { data: reversalEntry, error: reversalError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: new Date().toISOString().split('T')[0],
        reference: 'DIVIDEND-REVERSAL',
        description: `Reversal — dividend cancelled: ${cancelReason || 'no reason given'}`,
        source: 'dividend',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (reversalError) { setCancelError(reversalError.message); setCancelling(false); return }

    const reversalLines = (originalLines || []).map((l: any, i: number) => ({
      journal_entry_id: reversalEntry.id,
      account_id: l.account_id,
      debit: parseFloat(l.credit) || 0,
      credit: parseFloat(l.debit) || 0,
      description: 'Dividend cancelled',
      sort_order: i,
    }))
    await supabase.from('journal_lines').insert(reversalLines)

    await supabase
      .from('dividends')
      .update({ status: 'cancelled', cancellation_reason: cancelReason || null, cancellation_journal_entry_id: reversalEntry.id })
      .eq('id', dividendId)

    const { error: auditError1 } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'dividend',
      p_entity_id: dividendId,
      p_action: 'cancelled',
      p_old_data: { status: 'declared' },
      p_new_data: { status: 'cancelled', reason: cancelReason || null },
      p_description: `Cancelled dividend of £${parseFloat(dividend.total_amount).toFixed(2)}${cancelReason ? ` — ${cancelReason}` : ''}`,
    })
    if (auditError1) console.error('Audit log failed:', auditError1.message)

    setShowCancel(false)
    setCancelling(false)
    fetchData()
  }

  function openMarkPaid() {
    setPaymentDate(new Date().toISOString().split('T')[0])
    setBankAccountId('')
    setMarkError('')
    setPayingAllocationId(null) // null = paying all remaining unpaid allocations at once
    setShowMarkPaid(true)
  }

  function openMarkAllocationPaid(allocationId: string) {
    setPaymentDate(new Date().toISOString().split('T')[0])
    setBankAccountId('')
    setMarkError('')
    setPayingAllocationId(allocationId)
    setShowMarkPaid(true)
  }

  async function handleMarkPaid() {
    if (!bankAccountId) { setMarkError('Select which bank account paid this'); return }
    setMarking(true)
    setMarkError('')

    const toPay = payingAllocationId
      ? allocations.filter((a) => a.id === payingAllocationId)
      : allocations.filter((a) => !a.paid_date)

    if (toPay.length === 0) { setMarkError('Nothing left to pay'); setMarking(false); return }

    const totalToPay = toPay.reduce((sum, a) => sum + parseFloat(a.amount), 0)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setMarkError('Could not find your firm'); setMarking(false); return }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: paymentDate,
        reference: 'DIVIDEND-PAID',
        description: payingAllocationId
          ? `Dividend paid — ${toPay[0].shareholders?.name} — £${totalToPay.toFixed(2)}`
          : `Dividend paid — £${totalToPay.toFixed(2)}`,
        source: 'dividend',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) { setMarkError(entryError.message); setMarking(false); return }

    const { data: declarationLines } = await supabase
      .from('journal_lines')
      .select('account_id, credit')
      .eq('journal_entry_id', dividend.declaration_journal_entry_id)
      .gt('credit', 0)

    const payableAccountId = declarationLines?.[0]?.account_id

    await supabase.from('journal_lines').insert([
      { journal_entry_id: entry.id, account_id: payableAccountId, debit: totalToPay, credit: 0, description: 'Dividend paid', sort_order: 0 },
      { journal_entry_id: entry.id, account_id: bankAccountId, debit: 0, credit: totalToPay, description: 'Dividend paid', sort_order: 1 },
    ])

    await supabase
      .from('dividend_allocations')
      .update({ paid_date: paymentDate, payment_journal_entry_id: entry.id })
      .in('id', toPay.map((a) => a.id))

    const { data: remaining } = await supabase.from('dividend_allocations').select('paid_date').eq('dividend_id', dividendId)
    const allPaid = (remaining || []).every((a) => a.paid_date)
    const nonePaid = (remaining || []).every((a) => !a.paid_date)
    const newStatus = allPaid ? 'paid' : nonePaid ? 'declared' : 'partially_paid'

    await supabase.from('dividends').update({ status: newStatus, payment_date: allPaid ? paymentDate : dividend.payment_date }).eq('id', dividendId)

    const { error: auditError2 } = await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'dividend',
      p_entity_id: dividendId,
      p_action: 'paid',
      p_old_data: { status: dividend.status },
      p_new_data: { status: newStatus, payment_date: paymentDate },
      p_description: payingAllocationId
        ? `Paid ${toPay[0].shareholders?.name} — £${totalToPay.toFixed(2)}`
        : `Marked dividend as paid — £${totalToPay.toFixed(2)}`,
    })
    if (auditError2) console.error('Audit log failed:', auditError2.message)

    setShowMarkPaid(false)
    setMarking(false)
    fetchData()
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading dividend...</p>
    </div>
  )

  if (!dividend) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Dividend not found</p>
    </div>
  )

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const voucherAllocation = allocations.find((a) => a.id === viewingVoucherId)

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/dividends`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to dividends
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Dividend Declared</p>
            <h1 className="text-2xl font-bold text-brand-dark">{new Date(dividend.declaration_date).toLocaleDateString('en-GB')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm px-3 py-1.5 rounded-full font-medium capitalize ${dividend.status === 'paid' ? 'bg-green-100 text-green-700' : dividend.status === 'cancelled' ? 'bg-red-100 text-red-600' : dividend.status === 'partially_paid' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {dividend.status.replace('_', ' ')}
            </span>
            <a
              href={`/api/dividends/${dividendId}/resolution-pdf`}
              className="text-xs bg-gray-100 text-brand-dark font-semibold px-3 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              📄 {dividend.declaration_type === 'written_resolution' ? 'Written Resolution' : 'Board Minutes'} (PDF)
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Amount</p>
            <p className="text-brand-dark font-semibold">£{parseFloat(dividend.total_amount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Per Share</p>
            <p className="text-brand-dark">£{parseFloat(dividend.per_share_amount).toFixed(4)}</p>
          </div>
          {dividend.payment_date && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Date</p>
              <p className="text-brand-dark">{new Date(dividend.payment_date).toLocaleDateString('en-GB')}</p>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Shareholder</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Voucher #</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Shares</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-brand-dark">{a.shareholders?.name}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono">{a.voucher_number}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{a.shares_held_at_declaration.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium text-brand-dark">£{parseFloat(a.amount).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {a.paid_date ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                          Paid {new Date(a.paid_date).toLocaleDateString('en-GB')}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                      {can.manageEngagements && !a.paid_date && ['declared', 'partially_paid'].includes(dividend.status) && (
                        <button onClick={() => openMarkAllocationPaid(a.id)} className="text-xs text-brand-dark font-medium hover:underline">
                          Mark Paid
                        </button>
                      )}
                      <button onClick={() => setViewingVoucherId(a.id)} className="text-xs text-brand-dark font-medium hover:underline">
                        View
                      </button>
                      <a href={`/api/dividends/${dividendId}/voucher-pdf/${a.id}`} className="text-xs text-brand-dark font-medium hover:underline">
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {dividend.notes && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-600">{dividend.notes}</p>
          </div>
        )}

        {dividend.status === 'cancelled' && (
          <div className="mb-4 bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-700 font-medium uppercase tracking-wider mb-1">Cancelled</p>
            <p className="text-sm text-red-600">{dividend.cancellation_reason || 'No reason given'}</p>
          </div>
        )}

        {can.manageEngagements && ['declared', 'partially_paid'].includes(dividend.status) && !showMarkPaid && !showCancel && (
          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button onClick={openMarkPaid} className="bg-brand-gold text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              Mark Remaining as Paid
            </button>
            {dividend.status === 'declared' && (
              <>
                <button onClick={() => router.push(`/accounting/${clientId}/dividends?edit=${dividendId}`)} className="bg-gray-100 text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                  Edit
                </button>
                <button onClick={openCancel} className="bg-red-50 text-red-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-red-100 transition">
                  Cancel Dividend
                </button>
              </>
            )}
          </div>
        )}

        {showCancel && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {cancelError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{cancelError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional, but recommended for the board record)</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className={inputClass} placeholder="e.g. Board decided to defer distribution" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancel} disabled={cancelling} className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
              <button onClick={() => setShowCancel(false)} className="bg-gray-100 text-gray-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                Keep Dividend
              </button>
            </div>
          </div>
        )}

        {showMarkPaid && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <p className="text-sm text-brand-dark">
              {payingAllocationId
                ? `Paying ${allocations.find((a) => a.id === payingAllocationId)?.shareholders?.name} — £${parseFloat(allocations.find((a) => a.id === payingAllocationId)?.amount || 0).toFixed(2)}`
                : `Paying all remaining unpaid shareholders — £${allocations.filter((a) => !a.paid_date).reduce((sum, a) => sum + parseFloat(a.amount), 0).toFixed(2)}`}
            </p>
            {markError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{markError}</div>}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Date</label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Paid from</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputClass}>
                  <option value="">Select bank account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <button
                onClick={handleMarkPaid}
                disabled={marking}
                className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {marking ? 'Recording...' : 'Confirm Payment'}
              </button>
              <button onClick={() => setShowMarkPaid(false)} className="bg-gray-100 text-gray-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {voucherAllocation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setViewingVoucherId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-center border-b border-gray-200 pb-4 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Dividend Voucher</p>
              <h2 className="text-lg font-bold text-brand-dark mt-1">{clientName}</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Voucher Number</span><span className="font-mono text-brand-dark">{voucherAllocation.voucher_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shareholder</span><span className="text-brand-dark">{voucherAllocation.shareholders?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Share Class</span><span className="text-brand-dark">{voucherAllocation.shareholders?.share_class}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shares Held</span><span className="text-brand-dark">{voucherAllocation.shares_held_at_declaration.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Declaration Date</span><span className="text-brand-dark">{new Date(dividend.declaration_date).toLocaleDateString('en-GB')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Rate Per Share</span><span className="text-brand-dark">£{parseFloat(dividend.per_share_amount).toFixed(4)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold"><span className="text-brand-dark">Dividend Amount</span><span className="text-brand-dark">£{parseFloat(voucherAllocation.amount).toFixed(2)}</span></div>
            </div>
            <div className="flex gap-3 mt-6">
              <a
                href={`/api/dividends/${dividendId}/voucher-pdf/${voucherAllocation.id}`}
                className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition text-center"
              >
                Download PDF
              </a>
              <button onClick={() => setViewingVoucherId(null)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionAuditTrail entityType="dividend" entityId={dividendId} />
    </div>
  )
}
