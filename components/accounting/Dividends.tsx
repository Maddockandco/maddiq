'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function Dividends({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { can } = useRole()

  const [dividends, setDividends] = useState<any[]>([])
  const [shareholders, setShareholders] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [declaring, setDeclaring] = useState(false)
  const [declarationDate, setDeclarationDate] = useState(new Date().toISOString().split('T')[0])
  const [inputMode, setInputMode] = useState<'total' | 'per_share'>('total')
  const [totalAmount, setTotalAmount] = useState('')
  const [perShareAmount, setPerShareAmount] = useState('')
  const [dividendsPaidAccountId, setDividendsPaidAccountId] = useState('')
  const [dividendsPayableAccountId, setDividendsPayableAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [divRes, shRes, accRes] = await Promise.all([
      supabase.from('dividends').select('*').eq('client_id', clientId).order('declaration_date', { ascending: false }),
      supabase.from('shareholders').select('*').eq('client_id', clientId).eq('is_active', true).order('name'),
      supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('client_id', clientId).eq('is_active', true).order('code'),
    ])
    if (divRes.data) setDividends(divRes.data)
    if (shRes.data) setShareholders(shRes.data)
    if (accRes.data) {
      setAccounts(accRes.data)
      const paidDefault = accRes.data.find((a) => a.name === 'Dividends Paid')
      const payableDefault = accRes.data.find((a) => a.name === 'Dividends Payable')
      if (paidDefault) setDividendsPaidAccountId(paidDefault.id)
      if (payableDefault) setDividendsPayableAccountId(payableDefault.id)
    }
    setLoading(false)
  }

  const totalShares = shareholders.reduce((sum, s) => sum + s.shares_held, 0)

  function openDeclareForm() {
    setDeclarationDate(new Date().toISOString().split('T')[0])
    setInputMode('total')
    setTotalAmount('')
    setPerShareAmount('')
    setNotes('')
    setError('')
    setDeclaring(true)
  }

  function computedPerShare() {
    if (totalShares === 0) return 0
    if (inputMode === 'total') return (parseFloat(totalAmount) || 0) / totalShares
    return parseFloat(perShareAmount) || 0
  }

  function computedTotal() {
    if (inputMode === 'per_share') return (parseFloat(perShareAmount) || 0) * totalShares
    return parseFloat(totalAmount) || 0
  }

  function previewAllocations() {
    const perShare = computedPerShare()
    return shareholders.map((s) => ({
      shareholder: s,
      amount: Math.round(s.shares_held * perShare * 100) / 100,
    }))
  }

  function handleDeclareClick() {
    if (shareholders.length === 0) { setError('Add at least one active shareholder first'); return }
    if (computedTotal() <= 0) { setError('Enter a total amount or per-share rate greater than zero'); return }
    if (!dividendsPaidAccountId || !dividendsPayableAccountId) { setError('Select both posting accounts'); return }
    setShowConfirm(true)
  }

  async function handleDeclare() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const total = computedTotal()
    const perShare = computedPerShare()

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: declarationDate,
        reference: 'DIVIDEND',
        description: `Dividend declared — £${total.toFixed(2)} (£${perShare.toFixed(4)} per share)`,
        source: 'dividend',
        created_by: firmUser.id,
      })
      .select()
      .single()

    if (entryError) { setError(entryError.message); setSaving(false); setShowConfirm(false); return }

    await supabase.from('journal_lines').insert([
      { journal_entry_id: entry.id, account_id: dividendsPaidAccountId, debit: total, credit: 0, description: 'Dividend declared', sort_order: 0 },
      { journal_entry_id: entry.id, account_id: dividendsPayableAccountId, debit: 0, credit: total, description: 'Dividend declared', sort_order: 1 },
    ])

    const { data: dividend, error: dividendError } = await supabase
      .from('dividends')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        declaration_date: declarationDate,
        total_amount: total,
        per_share_amount: perShare,
        status: 'declared',
        notes: notes || null,
        declaration_journal_entry_id: entry.id,
        created_by: user!.id,
      })
      .select()
      .single()

    if (dividendError) { setError(dividendError.message); setSaving(false); setShowConfirm(false); return }

    const { count } = await supabase.from('dividends').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
    const allocations = previewAllocations().map((a, i) => ({
      dividend_id: dividend.id,
      shareholder_id: a.shareholder.id,
      shares_held_at_declaration: a.shareholder.shares_held,
      amount: a.amount,
      voucher_number: `DIV-${String(count || 1).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`,
    }))

    await supabase.from('dividend_allocations').insert(allocations)

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'dividend',
      p_entity_id: dividend.id,
      p_action: 'declared',
      p_new_data: dividend,
      p_description: `Declared dividend of £${total.toFixed(2)} across ${shareholders.length} shareholder(s)`,
    })

    setShowConfirm(false)
    setDeclaring(false)
    setSaving(false)
    fetchAll()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const equityAccounts = accounts.filter((a) => a.account_type === 'equity')
  const liabilityAccounts = accounts.filter((a) => a.account_type === 'current_liability')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Dividends</h3>
        {can.manageEngagements && !declaring && (
          <button onClick={openDeclareForm} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Declare Dividend
          </button>
        )}
      </div>

      {declaring && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Declare Dividend</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Declaration Date</label>
              <DatePicker value={declarationDate} onChange={setDeclarationDate} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Active Shares</label>
              <input type="text" value={totalShares.toLocaleString()} disabled className={`${inputClass} bg-gray-50`} />
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setInputMode('total')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${inputMode === 'total' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
              Enter total amount
            </button>
            <button onClick={() => setInputMode('per_share')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${inputMode === 'per_share' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
              Enter per-share rate
            </button>
          </div>

          {inputMode === 'total' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Dividend Amount (£)</label>
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Per-Share Amount (£)</label>
              <input type="number" step="0.0001" value={perShareAmount} onChange={(e) => setPerShareAmount(e.target.value)} className={inputClass} />
            </div>
          )}

          {computedTotal() > 0 && (
            <div className="bg-brand-light rounded-xl p-4">
              <p className="text-xs text-gray-500">Per share: £{computedPerShare().toFixed(4)}</p>
              <p className="text-xl font-bold text-brand-dark mt-1">Total: £{computedTotal().toFixed(2)}</p>
            </div>
          )}

          {shareholders.length > 0 && computedTotal() > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Shareholder</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Shares</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewAllocations().map((a) => (
                    <tr key={a.shareholder.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-brand-dark">{a.shareholder.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{a.shareholder.shares_held.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-medium text-brand-dark">£{a.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dividends Paid account (Dr)</label>
              <select value={dividendsPaidAccountId} onChange={(e) => setDividendsPaidAccountId(e.target.value)} className={inputClass}>
                <option value="">Select account</option>
                {equityAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dividends Payable account (Cr)</label>
              <select value={dividendsPayableAccountId} onChange={(e) => setDividendsPayableAccountId(e.target.value)} className={inputClass}>
                <option value="">Select account</option>
                {liabilityAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleDeclareClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              Declare Dividend
            </button>
            <button onClick={() => setDeclaring(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Declare this dividend?"
        message={`£${computedTotal().toFixed(2)} will be declared across ${shareholders.length} shareholder(s), posted as a real journal entry, and a voucher generated for each shareholder. This becomes part of the permanent ledger.`}
        confirmLabel="Declare Dividend"
        confirming={saving}
        onConfirm={handleDeclare}
        onCancel={() => setShowConfirm(false)}
      />

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : dividends.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No dividends declared yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Declaration Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Per Share</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/accounting/${clientId}/dividends/${d.id}`)}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-brand-light transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-6 py-3 text-sm text-brand-dark">{new Date(d.declaration_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(d.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">£{parseFloat(d.per_share_amount).toFixed(4)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${d.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
