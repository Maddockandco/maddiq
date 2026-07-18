'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import AddContactModal from '@/components/accounting/AddContactModal'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function Projects({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { can } = useRole()

  const [projects, setProjects] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)

  const [name, setName] = useState('')
  const [customerContactId, setCustomerContactId] = useState('')
  const [quotedAmount, setQuotedAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [projectsRes, contactsRes] = await Promise.all([
      supabase.from('projects').select('*, contacts(name)').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('client_id', clientId).eq('is_customer', true).order('name'),
    ])
    if (projectsRes.data) {
      const withActuals = await Promise.all(
        projectsRes.data.map(async (p: any) => {
          const [incomeRes, costRes] = await Promise.all([
            supabase.from('sales_invoice_lines').select('line_total').eq('project_id', p.id),
            supabase.from('purchase_bill_lines').select('line_total').eq('project_id', p.id),
          ])
          const actualIncome = (incomeRes.data || []).reduce((sum: number, l: any) => sum + parseFloat(l.line_total), 0)
          const actualCost = (costRes.data || []).reduce((sum: number, l: any) => sum + parseFloat(l.line_total), 0)
          return { ...p, actualIncome, actualCost }
        })
      )
      setProjects(withActuals)
    }
    if (contactsRes.data) setContacts(contactsRes.data)
    setLoading(false)
  }

  function openNewForm() {
    setEditingId(null)
    setName('')
    setCustomerContactId('')
    setQuotedAmount('')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setError('')
    setCreating(true)
  }

  function openEditForm(p: any) {
    setEditingId(p.id)
    setName(p.name)
    setCustomerContactId(p.customer_contact_id || '')
    setQuotedAmount(p.quoted_amount != null ? String(p.quoted_amount) : '')
    setStartDate(p.start_date || '')
    setEndDate(p.end_date || '')
    setNotes(p.notes || '')
    setError('')
    setCreating(true)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id, id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      customer_contact_id: customerContactId || null,
      name: name.trim(),
      quoted_amount: quotedAmount ? parseFloat(quotedAmount) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes || null,
    }

    if (editingId) {
      const { error: updateError } = await supabase.from('projects').update(payload).eq('id', editingId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('projects').insert({ ...payload, status: 'active', created_by: user!.id })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    setCreating(false)
    setSaving(false)
    fetchAll()
  }

  async function handleStatusChange(projectId: string, newStatus: string) {
    await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    fetchAll()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Projects</h3>
        {can.manageEngagements && !creating && (
          <button onClick={openNewForm} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + New Project
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingId ? 'Edit Project' : 'New Project'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. 14 Oak Street Extension" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Customer (optional)</label>
              <button type="button" onClick={() => setShowAddCustomer(true)} className="text-xs text-brand-dark font-medium hover:underline">
                + New
              </button>
            </div>
            <select
              value={customerContactId}
              onChange={(e) => {
                if (e.target.value === '__add_new__') { setShowAddCustomer(true); return }
                setCustomerContactId(e.target.value)
              }}
              className={inputClass}
            >
              <option value="">No specific customer</option>
              <option value="__add_new__">+ Add new customer...</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <AddContactModal
              isOpen={showAddCustomer}
              clientId={clientId}
              type="customer"
              onCancel={() => setShowAddCustomer(false)}
              onCreated={(contact) => {
                setContacts((prev) => [...prev, contact])
                setCustomerContactId(contact.id)
                setShowAddCustomer(false)
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quoted Amount (£)</label>
              <input type="number" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} className={inputClass} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Project'}
            </button>
            <button onClick={() => setCreating(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No projects yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-dark">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Project</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Customer</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Quoted</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Actual Cost</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Variance</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => {
                  const variance = p.quoted_amount != null ? parseFloat(p.quoted_amount) - p.actualCost : null
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/accounting/${clientId}/projects/${p.id}`)}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-brand-light transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-brand-dark">{p.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{p.contacts?.name || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{p.quoted_amount != null ? `£${parseFloat(p.quoted_amount).toFixed(2)}` : '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">£{p.actualCost.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm font-medium">
                        {variance != null ? (
                          <span className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {variance >= 0 ? '+' : ''}£{variance.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        {can.manageEngagements ? (
                          <select
                            value={p.status}
                            onChange={(e) => handleStatusChange(p.id, e.target.value)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 ${STATUS_STYLES[p.status]}`}
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {can.manageEngagements && (
                          <button onClick={() => openEditForm(p)} className="text-xs text-brand-dark font-medium hover:underline">Edit</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
