'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getUkTaxYear } from '@/lib/ukTaxYear'

export default function Dividends({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can } = useRole()

  const [dividends, setDividends] = useState<any[]>([])
  const [shareholders, setShareholders] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [declaring, setDeclaring] = useState(false)
  const [declarationDate, setDeclarationDate] = useState(new Date().toISOString().split('T')[0])
  const [declarationType, setDeclarationType] = useState<'board_minutes' | 'written_resolution'>('board_minutes')
  const [distributionMode, setDistributionMode] = useState<'proportional' | 'per_class' | 'custom'>('proportional')
  const [inputMode, setInputMode] = useState<'total' | 'per_share'>('total')
  const [totalAmount, setTotalAmount] = useState('')
  const [perShareAmount, setPerShareAmount] = useState('')
  const [classRates, setClassRates] = useState<Record<string, string>>({})
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const [dividendsPaidAccountId, setDividendsPaidAccountId] = useState('')
  const [dividendsPayableAccountId, setDividendsPayableAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editingDividendId, setEditingDividendId] = useState<string | null>(null)
  const [cancellingDividend, setCancellingDividend] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

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

    const editDividendId = searchParams.get('edit')
    if (editDividendId && divRes.data) {
      const toEdit = divRes.data.find((d) => d.id === editDividendId)
      if (toEdit && toEdit.status === 'declared') openEditForm(toEdit)
    }
  }

  // Posts a mirrored reversing entry for a given journal entry - swaps every line's
  // debit/credit, so the ledger keeps a clean trail rather than mutating history
  async function reverseJournalEntry(originalEntryId: string, description: string, firmId: string, firmUserId: string) {
    const { data: originalLines } = await supabase.from('journal_lines').select('account_id, debit, credit').eq('journal_entry_id', originalEntryId)

    const { data: reversalEntry, error: reversalError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmId,
        client_id: clientId,
        entry_date: new Date().toISOString().split('T')[0],
        reference: 'DIVIDEND-REVERSAL',
        description,
        source: 'dividend',
        created_by: firmUserId,
      })
      .select()
      .single()

    if (reversalError || !reversalEntry) return null

    const reversalLines = (originalLines || []).map((l: any, i: number) => ({
      journal_entry_id: reversalEntry.id,
      account_id: l.account_id,
      debit: parseFloat(l.credit) || 0,
      credit: parseFloat(l.debit) || 0,
      description,
      sort_order: i,
    }))
    await supabase.from('journal_lines').insert(reversalLines)

    return reversalEntry.id
  }

  async function openEditForm(dividend: any) {
    setError('')
    const { data: existingAllocations } = await supabase
      .from('dividend_allocations')
      .select('*, shareholders(id, name, share_class, shares_held)')
      .eq('dividend_id', dividend.id)

    setEditingDividendId(dividend.id)
    setDeclarationDate(dividend.declaration_date)
    setDeclarationType(dividend.declaration_type || 'board_minutes')
    setDistributionMode(dividend.distribution_mode || 'proportional')
    setNotes(dividend.notes || '')
    setDividendsPaidAccountId('')
    setDividendsPayableAccountId('')

    if (dividend.distribution_mode === 'per_class' && dividend.class_rates) {
      setClassRates(dividend.class_rates)
    } else if (dividend.distribution_mode === 'custom') {
      const amounts: Record<string, string> = {}
      for (const a of existingAllocations || []) {
        if (a.shareholder_id) amounts[a.shareholder_id] = String(a.amount)
      }
      setCustomAmounts(amounts)
    } else {
      setInputMode('total')
      setTotalAmount(String(dividend.total_amount))
    }

    setDeclaring(true)
  }

  function openCancelForm(dividend: any) {
    setCancelReason('')
    setCancelError('')
    setCancellingDividend(dividend)
  }

  async function handleCancel() {
    setCancelling(true)
    setCancelError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setCancelError('Could not find your firm'); setCancelling(false); return }

    const reversalId = await reverseJournalEntry(
      cancellingDividend.declaration_journal_entry_id,
      `Reversal — dividend cancelled: ${cancelReason || 'no reason given'}`,
      firmUser.firm_id,
      firmUser.id
    )

    await supabase
      .from('dividends')
      .update({ status: 'cancelled', cancellation_reason: cancelReason || null, cancellation_journal_entry_id: reversalId })
      .eq('id', cancellingDividend.id)

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'dividend',
      p_entity_id: cancellingDividend.id,
      p_action: 'cancelled',
      p_description: `Cancelled dividend of £${parseFloat(cancellingDividend.total_amount).toFixed(2)}${cancelReason ? ` — ${cancelReason}` : ''}`,
    })

    setCancellingDividend(null)
    setCancelling(false)
    fetchAll()
  }

  const totalShares = shareholders.reduce((sum, s) => sum + s.shares_held, 0)

  const shareClasses = Array.from(new Set(shareholders.map((s) => s.share_class)))

  function openDeclareForm() {
    setEditingDividendId(null)
    setDeclarationDate(new Date().toISOString().split('T')[0])
    setDeclarationType('board_minutes')
    setDistributionMode('proportional')
    setInputMode('total')
    setTotalAmount('')
    setPerShareAmount('')
    setClassRates({})
    setCustomAmounts({})
    setNotes('')
    setError('')
    setDeclaring(true)
  }

  function computedPerShare() {
    if (distributionMode !== 'proportional' || totalShares === 0) return 0
    if (inputMode === 'total') return (parseFloat(totalAmount) || 0) / totalShares
    return parseFloat(perShareAmount) || 0
  }

  function previewAllocations() {
    if (distributionMode === 'proportional') {
      const perShare = computedPerShare()
      return shareholders.map((s) => ({
        shareholder: s,
        amount: Math.round(s.shares_held * perShare * 100) / 100,
      }))
    }
    if (distributionMode === 'per_class') {
      return shareholders.map((s) => {
        const rate = parseFloat(classRates[s.share_class] || '0') || 0
        return { shareholder: s, amount: Math.round(s.shares_held * rate * 100) / 100 }
      })
    }
    // custom - fully manual, disconnected from shareholding, for alphabet-share flexibility
    return shareholders.map((s) => ({
      shareholder: s,
      amount: Math.round((parseFloat(customAmounts[s.id] || '0') || 0) * 100) / 100,
    }))
  }

  function computedTotal() {
    if (distributionMode === 'proportional' && inputMode === 'per_share') return (parseFloat(perShareAmount) || 0) * totalShares
    if (distributionMode === 'proportional') return parseFloat(totalAmount) || 0
    return previewAllocations().reduce((sum, a) => sum + a.amount, 0)
  }

  function handleDeclareClick() {
    if (shareholders.length === 0) { setError('Add at least one active shareholder first'); return }
    if (computedTotal() <= 0) { setError('Enter amounts that total more than zero'); return }
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
    const modeLabel = distributionMode === 'proportional' ? `£${perShare.toFixed(4)} per share` : distributionMode === 'per_class' ? 'per-class rates' : 'custom per-shareholder amounts'

    if (editingDividendId) {
      const { data: before } = await supabase.from('dividends').select('*').eq('id', editingDividendId).single()

      await reverseJournalEntry(
        before.declaration_journal_entry_id,
        `Reversal — dividend edited (superseded by new figures)`,
        firmUser.firm_id,
        firmUser.id
      )

      const { data: newEntry, error: newEntryError } = await supabase
        .from('journal_entries')
        .insert({
          firm_id: firmUser.firm_id,
          client_id: clientId,
          entry_date: declarationDate,
          reference: 'DIVIDEND',
          description: `Dividend declared (edited) — £${total.toFixed(2)} (${modeLabel})`,
          source: 'dividend',
          created_by: firmUser.id,
        })
        .select()
        .single()

      if (newEntryError) { setError(newEntryError.message); setSaving(false); setShowConfirm(false); return }

      await supabase.from('journal_lines').insert([
        { journal_entry_id: newEntry.id, account_id: dividendsPaidAccountId, debit: total, credit: 0, description: 'Dividend declared (edited)', sort_order: 0 },
        { journal_entry_id: newEntry.id, account_id: dividendsPayableAccountId, debit: 0, credit: total, description: 'Dividend declared (edited)', sort_order: 1 },
      ])

      const { data: after } = await supabase
        .from('dividends')
        .update({
          declaration_date: declarationDate,
          total_amount: total,
          per_share_amount: perShare,
          notes: notes || null,
          declaration_journal_entry_id: newEntry.id,
          distribution_mode: distributionMode,
          declaration_type: declarationType,
          tax_year: getUkTaxYear(declarationDate),
          class_rates: distributionMode === 'per_class' ? classRates : null,
        })
        .eq('id', editingDividendId)
        .select()
        .single()

      await supabase.from('dividend_allocations').delete().eq('dividend_id', editingDividendId)
      const { count } = await supabase.from('dividends').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
      const newAllocations = previewAllocations().map((a, i) => ({
        dividend_id: editingDividendId,
        shareholder_id: a.shareholder.id,
        shares_held_at_declaration: a.shareholder.shares_held,
        amount: a.amount,
        voucher_number: `DIV-${String(count || 1).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`,
      }))
      await supabase.from('dividend_allocations').insert(newAllocations)

      await supabase.rpc('log_accounting_audit', {
        p_client_id: clientId,
        p_entity_type: 'dividend',
        p_entity_id: editingDividendId,
        p_action: 'updated',
        p_old_data: before,
        p_new_data: after,
        p_description: `Edited dividend — now £${total.toFixed(2)} (original entry reversed, new entry posted)`,
      })

      setShowConfirm(false)
      setDeclaring(false)
      setSaving(false)
      fetchAll()
      return
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        entry_date: declarationDate,
        reference: 'DIVIDEND',
        description: `Dividend declared — £${total.toFixed(2)} (${modeLabel})`,
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
        distribution_mode: distributionMode,
        declaration_type: declarationType,
        tax_year: getUkTaxYear(declarationDate),
        class_rates: distributionMode === 'per_class' ? classRates : null,
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
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingDividendId ? 'Edit Dividend' : 'Declare Dividend'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Declaration Date</label>
              <DatePicker value={declarationDate} onChange={setDeclarationDate} />
              <p className="text-xs text-gray-400 mt-1">Tax year: {getUkTaxYear(declarationDate)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Active Shares</label>
              <input type="text" value={totalShares.toLocaleString()} disabled className={`${inputClass} bg-gray-50`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Declared by</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button onClick={() => setDeclarationType('board_minutes')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${declarationType === 'board_minutes' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                Board Minutes (Interim)
              </button>
              <button onClick={() => setDeclarationType('written_resolution')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${declarationType === 'written_resolution' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                Written Resolution (Final)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Distribution</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button onClick={() => setDistributionMode('proportional')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${distributionMode === 'proportional' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                Proportional
              </button>
              <button onClick={() => setDistributionMode('per_class')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${distributionMode === 'per_class' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                Per Share Class
              </button>
              <button onClick={() => setDistributionMode('custom')} className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${distributionMode === 'custom' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
                Custom Amounts
              </button>
            </div>
            {distributionMode !== 'proportional' && (
              <p className="text-xs text-gray-400 mt-1">For alphabet/non-pro-rata shares — amounts don't have to match shareholding percentage</p>
            )}
          </div>

          {distributionMode === 'proportional' && (
            <>
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
            </>
          )}

          {distributionMode === 'per_class' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Rate per share, by class (£)</label>
              <div className="grid grid-cols-2 gap-3">
                {shareClasses.map((cls) => (
                  <div key={cls}>
                    <label className="block text-xs text-gray-400 mb-1">{cls}</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={classRates[cls] || ''}
                      onChange={(e) => setClassRates((prev) => ({ ...prev, [cls]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {distributionMode === 'custom' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Amount per shareholder (£)</label>
              {shareholders.map((s) => (
                <div key={s.id} className="grid grid-cols-2 gap-3 items-center">
                  <p className="text-sm text-brand-dark">{s.name} <span className="text-xs text-gray-400">({s.share_class})</span></p>
                  <input
                    type="number"
                    value={customAmounts[s.id] || ''}
                    onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
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
              {editingDividendId ? 'Save Changes' : 'Declare Dividend'}
            </button>
            <button onClick={() => setDeclaring(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title={editingDividendId ? 'Save changes to this dividend?' : 'Declare this dividend?'}
        message={editingDividendId
          ? `The original declaration entry will be reversed and a new one posted with the updated figures — £${computedTotal().toFixed(2)} across ${shareholders.length} shareholder(s). Vouchers will be regenerated.`
          : `£${computedTotal().toFixed(2)} will be declared across ${shareholders.length} shareholder(s), posted as a real journal entry, and a voucher generated for each shareholder. This becomes part of the permanent ledger.`}
        confirmLabel={editingDividendId ? 'Save Changes' : 'Declare Dividend'}
        confirming={saving}
        onConfirm={handleDeclare}
        onCancel={() => setShowConfirm(false)}
      />

      {cancellingDividend && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-brand-dark">Cancel this dividend?</h3>
            <p className="text-sm text-gray-500">
              £{parseFloat(cancellingDividend.total_amount).toFixed(2)} declared on {new Date(cancellingDividend.declaration_date).toLocaleDateString('en-GB')} — the original declaration entry will be reversed. Vouchers already issued will show as void.
            </p>
            {cancelError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{cancelError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional, but recommended for the board record)</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className={inputClass} placeholder="e.g. Board decided to defer distribution" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Dividend'}
              </button>
              <button onClick={() => setCancellingDividend(null)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                Keep Dividend
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Tax Year</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Total</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Per Share</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th></th>
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
                    <td className="px-6 py-3 text-sm text-gray-500">{d.tax_year || getUkTaxYear(d.declaration_date)}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(d.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">£{parseFloat(d.per_share_amount).toFixed(4)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${d.status === 'paid' ? 'bg-green-100 text-green-700' : d.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {can.manageEngagements && d.status === 'declared' && (
                        <>
                          <button onClick={() => openEditForm(d)} className="text-xs bg-gray-100 text-brand-dark font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
                            Edit
                          </button>
                          <button onClick={() => openCancelForm(d)} className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                            Cancel
                          </button>
                        </>
                      )}
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
