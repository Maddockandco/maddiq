'use client'


import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

const TYPE_STYLES: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  income: 'bg-green-100 text-green-700',
  expense: 'bg-amber-100 text-amber-700',
}

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Bank Current Account', account_type: 'asset' },
  { code: '1100', name: 'Trade Debtors', account_type: 'asset' },
  { code: '2000', name: 'Trade Creditors', account_type: 'liability' },
  { code: '2100', name: 'VAT Control Account', account_type: 'liability' },
  { code: '3000', name: 'Capital Introduced', account_type: 'equity' },
  { code: '4000', name: 'Sales', account_type: 'income' },
  { code: '5000', name: 'Cost of Sales', account_type: 'expense' },
  { code: '6000', name: 'General Expenses', account_type: 'expense' },
]

export default function ChartOfAccounts({ clientId }: { clientId: string }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState('expense')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchAccounts() }, [clientId])

  async function fetchAccounts() {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('client_id', clientId)
      .order('code', { ascending: true })
    if (data) setAccounts(data)
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    setError('')
    if (!code || !name) { setError('Code and name are required'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { error: insertError } = await supabase.from('chart_of_accounts').insert({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      code,
      name,
      account_type: accountType,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setCode('')
      setName('')
      setAccountType('expense')
      setAdding(false)
      fetchAccounts()
    }
    setSaving(false)
  }

  async function handleSeedDefaults() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const rows = DEFAULT_ACCOUNTS.map((a) => ({
      firm_id: firmUser.firm_id,
      client_id: clientId,
      code: a.code,
      name: a.name,
      account_type: a.account_type,
    }))

    const { error: insertError } = await supabase.from('chart_of_accounts').insert(rows)
    if (insertError) {
      setError(insertError.message)
    } else {
      fetchAccounts()
    }
    setSaving(false)
  }

  async function handleToggleActive(accountId: string, isActive: boolean) {
    await supabase
      .from('chart_of_accounts')
      .update({ is_active: !isActive })
      .eq('id', accountId)
    setAccounts(accounts.map(a => a.id === accountId ? { ...a, is_active: !isActive } : a))
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading chart of accounts...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {can.manageEngagements && (
        <div className="flex justify-end gap-3">
          {accounts.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="bg-gray-100 text-brand-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add standard accounts'}
            </button>
          )}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
            >
              + New Account
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="4000" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Add account'}
            </button>
            <button onClick={() => setAdding(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No accounts set up yet</p>
          <p className="text-gray-400 text-xs">Add standard accounts to get started, or build your own from scratch</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Code</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${!a.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">{a.code}</td>
                  <td className="px-6 py-3 text-sm font-medium text-brand-dark">{a.name}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${TYPE_STYLES[a.account_type]}`}>
                      {a.account_type}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {can.manageEngagements ? (
                      <button
                        onClick={() => handleToggleActive(a.id, a.is_active)}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition ${
                          a.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {a.is_active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
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
