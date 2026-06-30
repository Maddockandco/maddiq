'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PLACEHOLDER_HELP = [
  { tag: '{client_name}', desc: "Client's name" },
  { tag: '{firm_name}', desc: 'Your firm name' },
  { tag: '{services}', desc: 'Active engagement services' },
  { tag: '{fee_summary}', desc: 'Fee breakdown from engagements' },
  { tag: '{date}', desc: "Today's date" },
]

export default function EngagementLetterTemplates() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) return

    const { data } = await supabase
      .from('engagement_letter_templates')
      .select('*')
      .eq('firm_id', firmUser.firm_id)
      .order('created_at', { ascending: false })

    if (data) setTemplates(data)
    setLoading(false)
  }

  function startAdd() {
    setAdding(true)
    setEditing(null)
    setName('')
    setIsDefault(false)
    setContent(`Dear {client_name},

Thank you for choosing {firm_name} to act on your behalf. This letter sets out the terms of our engagement.

SERVICES
We will provide the following services:
{services}

FEES
{fee_summary}

Our fees are payable monthly in advance unless otherwise agreed. We reserve the right to review fees annually.

CLIENT RESPONSIBILITIES
You agree to provide accurate and complete information in a timely manner, and to notify us promptly of any changes to your circumstances that may affect our services.

LIMITATION OF LIABILITY
Our liability is limited to the fees paid for the relevant service period, except where prohibited by law.

TERMINATION
Either party may terminate this engagement with 30 days' written notice.

By signing below, you confirm acceptance of these terms.

{firm_name}
{date}`)
  }

  function startEdit(t: any) {
    setEditing(t)
    setAdding(false)
    setName(t.name)
    setContent(t.content)
    setIsDefault(t.is_default)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    if (!name || !content) { setError('Name and content are required'); setSaving(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user!.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    if (editing) {
      const { error: updateError } = await supabase
        .from('engagement_letter_templates')
        .update({ name, content, is_default: isDefault, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase
        .from('engagement_letter_templates')
        .insert({
          firm_id: firmUser.firm_id,
          name, content,
          is_default: isDefault,
          created_by: firmUser.id,
        })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    setAdding(false)
    setEditing(null)
    fetchTemplates()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await supabase.from('engagement_letter_templates').delete().eq('id', id)
    fetchTemplates()
  }

  if (loading) return <div className="text-gray-500 text-sm">Loading templates...</div>

  if (adding || editing) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
          {editing ? 'Edit Template' : 'New Template'}
        </h3>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Template name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Accounting Engagement"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        <div className="bg-brand-light rounded-xl p-4">
          <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Available placeholders</p>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDER_HELP.map((p) => (
              <span key={p.tag} title={p.desc} className="text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-brand-dark font-mono">
                {p.tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Letter content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold font-mono leading-relaxed"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 accent-brand-dark"
          />
          <span className="text-sm font-medium text-brand-dark">Set as default template</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save template'}
          </button>
          <button onClick={() => { setAdding(false); setEditing(null) }}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={startAdd}
          className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No engagement letter templates yet</p>
        </div>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-brand-dark text-sm">{t.name}</p>
                {t.is_default && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-dark font-medium">Default</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Updated {new Date(t.updated_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(t)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-brand-dark hover:bg-gray-200 transition font-medium">
                Edit
              </button>
              <button onClick={() => handleDelete(t.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition font-medium">
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
