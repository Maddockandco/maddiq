'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function ShareholderRegister({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [shareholders, setShareholders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [name, setName] = useState('')
  const [sharesHeld, setSharesHeld] = useState('')
  const [shareClass, setShareClass] = useState('Ordinary')

  useEffect(() => { fetchShareholders() }, [clientId])

  async function fetchShareholders() {
    const { data } = await supabase.from('shareholders').select('*').eq('client_id', clientId).order('name')
    if (data) setShareholders(data)
    setLoading(false)
  }

  function openNewForm() {
    setName('')
    setSharesHeld('')
    setShareClass('Ordinary')
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  function openEditForm(s: any) {
    setName(s.name)
    setSharesHeld(String(s.shares_held))
    setShareClass(s.share_class)
    setEditingId(s.id)
    setError('')
    setFormOpen(true)
  }

  function handleSaveClick() {
    if (!name.trim() || !sharesHeld || parseInt(sharesHeld) <= 0) {
      setError('A name and a positive number of shares are required')
      return
    }
    setShowConfirm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      name: name.trim(),
      shares_held: parseInt(sharesHeld),
      share_class: shareClass,
    }

    if (editingId) {
      const { error: updateError } = await supabase.from('shareholders').update(payload).eq('id', editingId)
      if (updateError) { setError(updateError.message); setSaving(false); setShowConfirm(false); return }
    } else {
      const { error: insertError } = await supabase.from('shareholders').insert(payload)
      if (insertError) { setError(insertError.message); setSaving(false); setShowConfirm(false); return }
    }

    setShowConfirm(false)
    setFormOpen(false)
    setSaving(false)
    fetchShareholders()
  }

  async function toggleActive(s: any) {
    await supabase.from('shareholders').update({ is_active: !s.is_active }).eq('id', s.id)
    fetchShareholders()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const totalShares = shareholders.filter((s) => s.is_active).reduce((sum, s) => sum + s.shares_held, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Shareholder Register</h3>
        {can.manageEngagements && (
          <button onClick={openNewForm} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Add Shareholder
          </button>
        )}
      </div>

      {!loading && shareholders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Active Shares</p>
          <p className="text-xl font-semibold text-brand-dark">{totalShares.toLocaleString()}</p>
        </div>
      )}

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingId ? 'Edit Shareholder' : 'New Shareholder'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Shares Held</label>
              <input type="number" value={sharesHeld} onChange={(e) => setSharesHeld(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Share Class</label>
              <input type="text" value={shareClass} onChange={(e) => setShareClass(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSaveClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              {editingId ? 'Save Changes' : 'Add Shareholder'}
            </button>
            <button onClick={() => setFormOpen(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title={editingId ? 'Save changes to this shareholder?' : 'Add this shareholder?'}
        message={`${name} — ${sharesHeld} ${shareClass} shares`}
        confirmLabel={editingId ? 'Save Changes' : 'Add Shareholder'}
        confirming={saving}
        onConfirm={handleSave}
        onCancel={() => setShowConfirm(false)}
      />

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : shareholders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No shareholders on record yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Shares Held</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Class</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">% Holding</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-3 text-sm font-medium text-brand-dark">{s.name}</td>
                    <td className="px-6 py-3 text-sm text-brand-dark">{s.shares_held.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{s.share_class}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{totalShares > 0 ? ((s.shares_held / totalShares) * 100).toFixed(1) : '0.0'}%</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {can.manageEngagements && (
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => openEditForm(s)} className="text-xs text-brand-dark font-medium hover:underline">Edit</button>
                          <button onClick={() => toggleActive(s)} className="text-xs text-gray-500 font-medium hover:underline">
                            {s.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
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
