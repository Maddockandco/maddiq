'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DatePicker from '@/components/ui/DatePicker'
import { GripVertical } from 'lucide-react'

export default function AccountingDashboardPage({ params }: { params: { clientId: string } }) {
  const [accountCount, setAccountCount] = useState(0)
  const [entryCount, setEntryCount] = useState(0)
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [widgetOrder, setWidgetOrder] = useState<string[]>([])
  const [editingBankId, setEditingBankId] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState('')
  const [editDate, setEditDate] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchSummary() }, [params.clientId])

  async function fetchSummary() {
    const accountsResult = await supabase
      .from('chart_of_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId)

    const entriesResult = await supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId)

    const recentResult = await supabase
      .from('journal_entries')
      .select('id, entry_date, description, reference, source')
      .eq('client_id', params.clientId)
      .order('entry_date', { ascending: false })
      .limit(5)

    const bankAccountsResult = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, statement_balance, statement_balance_date')
      .eq('client_id', params.clientId)
      .eq('is_active', true)
      .eq('account_type', 'bank')
      .order('code')

    let bankData = bankAccountsResult.data || []

    if (bankData.length > 0) {
      const bankIds = bankData.map((a) => a.id)

      const { data: journalLines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, journal_entries!inner(client_id)')
        .eq('journal_entries.client_id', params.clientId)
        .in('account_id', bankIds)

      const balances: Record<string, number> = {}
      ;(journalLines || []).forEach((l: any) => {
        balances[l.account_id] = (balances[l.account_id] || 0) + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0)
      })

      const { data: unreconciled } = await supabase
        .from('bank_transactions')
        .select('bank_account_id')
        .eq('client_id', params.clientId)
        .eq('status', 'unreconciled')
        .in('bank_account_id', bankIds)

      const unreconciledCounts: Record<string, number> = {}
      ;(unreconciled || []).forEach((t: any) => {
        unreconciledCounts[t.bank_account_id] = (unreconciledCounts[t.bank_account_id] || 0) + 1
      })

      bankData = bankData.map((a) => ({
        ...a,
        maddiqBalance: balances[a.id] || 0,
        unreconciledCount: unreconciledCounts[a.id] || 0,
      }))
    }

    const layoutResult = await supabase
      .from('dashboard_widget_layout')
      .select('widget_order')
      .eq('client_id', params.clientId)
      .maybeSingle()

    setAccountCount(accountsResult.count || 0)
    setEntryCount(entriesResult.count || 0)
    if (recentResult.data) setRecentEntries(recentResult.data)
    setBankAccounts(bankData)

    const defaultOrder = ['summary-cards', ...bankData.map((a) => `bank-${a.id}`), 'recent-entries']
    const savedOrder: string[] = layoutResult.data?.widget_order || []
    const merged = [
      ...savedOrder.filter((id) => defaultOrder.includes(id)),
      ...defaultOrder.filter((id) => !savedOrder.includes(id)),
    ]
    setWidgetOrder(merged)

    setLoading(false)
  }

  async function saveWidgetOrder(newOrder: string[]) {
    setWidgetOrder(newOrder)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) return

    await supabase
      .from('dashboard_widget_layout')
      .upsert({
        client_id: params.clientId,
        firm_id: firmUser.firm_id,
        widget_order: newOrder,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })
  }

  function handleDragStart(id: string) {
    setDraggedId(id)
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (!draggedId || draggedId === overId) return
    const currentIndex = widgetOrder.indexOf(draggedId)
    const overIndex = widgetOrder.indexOf(overId)
    if (currentIndex === -1 || overIndex === -1) return
    const newOrder = [...widgetOrder]
    newOrder.splice(currentIndex, 1)
    newOrder.splice(overIndex, 0, draggedId)
    setWidgetOrder(newOrder)
  }

  function handleDragEnd() {
    if (draggedId) saveWidgetOrder(widgetOrder)
    setDraggedId(null)
  }

  function openEditBalance(bank: any) {
    setEditingBankId(bank.id)
    setEditBalance(bank.statement_balance != null ? String(bank.statement_balance) : '')
    setEditDate(bank.statement_balance_date || new Date().toISOString().split('T')[0])
  }

  async function saveStatementBalance(bankId: string) {
    await supabase
      .from('chart_of_accounts')
      .update({
        statement_balance: parseFloat(editBalance) || 0,
        statement_balance_date: editDate,
      })
      .eq('id', bankId)

    setEditingBankId(null)
    fetchSummary()
  }

  // Widgets spanning the full row (2 columns on md+) vs half-width (bank cards)
  function widgetSpanClass(id: string) {
    if (id.startsWith('bank-')) return 'col-span-1'
    return 'col-span-1 md:col-span-2'
  }

  const cards = [
    { label: 'Accounts set up', value: accountCount, path: '/chart-of-accounts', colour: 'bg-brand-dark', textColour: 'text-white' },
    { label: 'Journal entries posted', value: entryCount, path: '/journal-entries', colour: 'bg-brand-gold', textColour: 'text-brand-dark' },
  ]

  function renderWidget(id: string) {
    if (id === 'summary-cards') {
      return (
        <div className="grid grid-cols-2 gap-4">
          {cards.map((card) => (
            <button
              key={card.label}
              onClick={() => router.push(`/accounting/${params.clientId}${card.path}`)}
              className={`${card.colour} rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${card.textColour} opacity-60`}>
                {card.label}
              </p>
              <p className={`text-3xl font-bold mt-1.5 ${card.textColour}`}>
                {card.value}
              </p>
            </button>
          ))}
        </div>
      )
    }

    if (id === 'recent-entries') {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-brand-dark uppercase tracking-wider">Recent Journal Entries</h3>
            <button
              onClick={() => router.push(`/accounting/${params.clientId}/journal-entries`)}
              className="text-xs text-brand-dark font-medium hover:underline"
            >
              View all →
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm mb-3">No journal entries posted yet</p>
              <button
                onClick={() => router.push(`/accounting/${params.clientId}/journal-entries`)}
                className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-xl text-xs hover:bg-opacity-90 transition"
              >
                Post first entry
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-medium text-brand-dark">
                      {entry.description || 'Journal entry'}
                      {entry.reference && <span className="text-gray-400 font-normal ml-2">({entry.reference})</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.source}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.entry_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (id.startsWith('bank-')) {
      const bankId = id.replace('bank-', '')
      const bank = bankAccounts.find((b) => b.id === bankId)
      if (!bank) return null

      const statementBalance = bank.statement_balance ?? 0
      const difference = statementBalance - bank.maddiqBalance

      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-brand-dark truncate">{bank.code} — {bank.name}</p>
            {editingBankId !== bank.id && (
              <button onClick={() => openEditBalance(bank)} className="text-xs text-brand-dark font-medium hover:underline flex-shrink-0 ml-2">
                Edit
              </button>
            )}
          </div>

          {editingBankId === bank.id ? (
            <div className="space-y-3 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Balance (£)</label>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">As at</label>
                  <DatePicker value={editDate} onChange={setEditDate} className="w-full" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveStatementBalance(bank.id)} className="bg-brand-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition">
                  Save
                </button>
                <button onClick={() => setEditingBankId(null)} className="text-xs text-gray-500 hover:underline px-1">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 mb-3">
              <div>
                <p className="text-xl font-bold text-brand-dark">£{statementBalance.toFixed(2)}</p>
                <p className="text-xs text-brand-dark/60">
                  Statement {bank.statement_balance_date && `(${new Date(bank.statement_balance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`}
                </p>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <p className="text-xl font-bold text-brand-dark">£{bank.maddiqBalance.toFixed(2)}</p>
                <p className="text-xs text-brand-dark/60">In Maddiq</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-gray-500">Difference</p>
              <p className={`text-sm font-semibold ${Math.abs(difference) < 0.01 ? 'text-green-700' : 'text-amber-600'}`}>
                £{Math.abs(difference).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => router.push(`/accounting/${params.clientId}/bank-transactions`)}
              className="bg-brand-gold text-brand-dark text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition whitespace-nowrap"
            >
              {bank.unreconciledCount > 0 ? `Reconcile ${bank.unreconciledCount}` : 'View transactions'}
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {accountCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-amber-700 mb-1">Get started</p>
          <p className="text-sm text-amber-600 mb-4">Set up a Chart of Accounts before posting journal entries.</p>
          <button
            onClick={() => router.push(`/accounting/${params.clientId}/chart-of-accounts`)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            Set up Chart of Accounts
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">Drag the handles to rearrange widgets — your layout is saved automatically.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgetOrder.map((id) => (
          <div
            key={id}
            draggable
            onDragStart={() => handleDragStart(id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDragEnd={handleDragEnd}
            className={`relative group ${widgetSpanClass(id)} ${draggedId === id ? 'opacity-40' : ''}`}
          >
            <div className="absolute -left-6 top-4 opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 z-10">
              <GripVertical size={18} />
            </div>
            {renderWidget(id)}
          </div>
        ))}
      </div>
    </div>
  )
}
