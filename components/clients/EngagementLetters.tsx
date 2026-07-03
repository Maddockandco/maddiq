'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}

export default function EngagementLetters({ clientId }: { clientId: string }) {
  const [letters, setLetters] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [firm, setFirm] = useState<any>(null)
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [previewing, setPreviewing] = useState<any>(null)
  const [editedContent, setEditedContent] = useState('')
  const [viewingBranded, setViewingBranded] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [clientId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) return

    const lettersResult = await supabase
      .from('engagement_letters')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    const templatesResult = await supabase
      .from('engagement_letter_templates')
      .select('id, name, content, is_default')
      .eq('firm_id', firmUser.firm_id)
      .order('is_default', { ascending: false })

    const firmResult = await supabase
      .from('firms')
      .select('name, logo_url, brand_color, email, phone, address')
      .eq('id', firmUser.firm_id)
      .single()

    const clientResult = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    if (lettersResult.data) setLetters(lettersResult.data)
    if (templatesResult.data) {
      setTemplates(templatesResult.data)
      const def = templatesResult.data.find(t => t.is_default)
      if (def) {
        setSelectedTemplate(def.id)
      } else if (templatesResult.data.length > 0) {
        setSelectedTemplate(templatesResult.data[0].id)
      }
    }
    if (firmResult.data) setFirm(firmResult.data)
    if (clientResult.data) setClientName(clientResult.data.name)

    setLoading(false)
  }

  function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  async function buildLetterContent(templateContent: string) {
    const { data: { user } } = await supabase.auth.getUser()

    const firmUserResult = await supabase
      .from('firm_users')
      .select('firm_id, firms(name)')
      .eq('user_id', user!.id)
      .single()

    const clientResult = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    const engagementsResult = await supabase
      .from('engagements')
      .select('type, fee_amount, frequency')
      .eq('client_id', clientId)
      .eq('status', 'active')

    const firmName = (firmUserResult.data?.firms as any)?.name || 'Our Firm'
    const clientNameValue = clientResult.data?.name || 'Client'
    const engagements = engagementsResult.data

    let servicesList = '- Services as agreed'
    let feeSummary = 'Fees as agreed separately'

    if (engagements && engagements.length > 0) {
      servicesList = engagements.map((e) => '- ' + formatType(e.type)).join('\n')
      feeSummary = engagements.map((e) => {
        const fee = parseFloat(e.fee_amount).toFixed(2)
        const freq = e.frequency.replace(/_/g, ' ')
        return formatType(e.type) + ': £' + fee + ' (' + freq + ')'
      }).join('\n')
    }

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    let result = templateContent
    result = result.replaceAll('{client_name}', clientNameValue)
    result = result.replaceAll('{firm_name}', firmName)
    result = result.replaceAll('{services}', servicesList)
    result = result.replaceAll('{fee_summary}', feeSummary)
    result = result.replaceAll('{date}', today)

    return result
  }

  async function handleGenerate() {
    if (!selectedTemplate) return
    setSaving(true)
    setError('')

    const template = templates.find((t) => t.id === selectedTemplate)
    if (!template) {
      setSaving(false)
      return
    }

    const builtContent = await buildLetterContent(template.content)
    setPreviewing({ template_id: selectedTemplate, isNew: true })
    setEditedContent(builtContent)
    setCreating(false)
    setSaving(false)
  }

  async function handleSaveDraft() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const firmUserResult = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user!.id)
      .single()

    if (!firmUserResult.data) {
      setError('Could not find your firm')
      setSaving(false)
      return
    }

    const firmUser = firmUserResult.data

    if (previewing.isNew) {
      const insertResult = await supabase.from('engagement_letters').insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        template_id: previewing.template_id,
        content: editedContent,
        status: 'draft',
        created_by: firmUser.id,
      })
      if (insertResult.error) {
        setError(insertResult.error.message)
        setSaving(false)
        return
      }
    } else {
      const updateResult = await supabase
        .from('engagement_letters')
        .update({ content: editedContent, updated_at: new Date().toISOString() })
        .eq('id', previewing.id)
      if (updateResult.error) {
        setError(updateResult.error.message)
        setSaving(false)
        return
      }
    }

    setPreviewing(null)
    fetchData()
    setSaving(false)
  }

  async function handleSend(letterId: string) {
    if (!confirm('Send this engagement letter to the client portal for signing?')) return
    await supabase
      .from('engagement_letters')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', letterId)
    fetchData()
  }

  async function handleDelete(letterId: string) {
    if (!confirm('Delete this draft engagement letter? This cannot be undone.')) return
    setDeletingId(letterId)
    await supabase.from('engagement_letters').delete().eq('id', letterId)
    fetchData()
    setDeletingId(null)
  }

  function openEdit(letter: any) {
    setPreviewing(letter)
    setEditedContent(letter.content)
  }

  function openBrandedView(letter: any) {
    setViewingBranded(letter)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading engagement letters...</p>
      </div>
    )
  }

  const brandColor = firm?.brand_color || '#343b46'

  // Branded read-only view (sent / signed / expired letters)
  if (viewingBranded) {
    return (
      <div className="max-w-3xl space-y-4">
        <button
          onClick={() => setViewingBranded(null)}
          className="text-xs text-gray-400 hover:text-brand-dark transition"
        >
          ← Back to letters
        </button>

        <div className="rounded-2xl shadow-lg overflow-hidden border border-gray-200">
          <div className="p-10 text-white" style={{ backgroundColor: brandColor }}>
            <div className="flex items-center justify-between mb-16">
              {firm?.logo_url ? (
                <img src={firm.logo_url} alt={firm.name} className="h-16 max-w-[180px] object-contain" />
              ) : (
                <h2 className="text-2xl font-bold">{firm?.name}</h2>
              )}
              <p className="text-sm text-white/70">
                {new Date(viewingBranded.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <h1 className="text-4xl font-bold mb-2">Letter of Engagement</h1>
            <p className="text-lg text-white/80">{clientName}</p>
          </div>

          <div className="p-10 bg-white space-y-6">
            <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
              {viewingBranded.content}
            </div>

            {viewingBranded.signed_at && (
              <div className="rounded-xl p-5 bg-green-50 border border-green-200">
                <p className="text-sm font-semibold text-green-700">
                  ✅ Signed by {viewingBranded.signed_name}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {new Date(viewingBranded.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              {firm?.name && <p>{firm.name}</p>}
              {firm?.address && <p>{firm.address}</p>}
              {firm?.email && <p>{firm.email}</p>}
              {firm?.phone && <p>{firm.phone}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (previewing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">
          {previewing.isNew ? 'New Engagement Letter' : 'Edit Engagement Letter'}
        </h3>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={20}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold font-mono leading-relaxed"
        />
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as draft'}
          </button>
          <button
            onClick={() => setPreviewing(null)}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {can.manageEngagementLetters && !creating && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + New Engagement Letter
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Choose a template</h3>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates available. Create one in Settings first.</p>
          ) : (
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={saving || templates.length === 0}
              className="flex-1 bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Generating...' : 'Generate letter'}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {letters.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">No engagement letters yet</p>
          <p className="text-gray-400 text-xs">Generate one from a template to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <div key={letter.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-brand-dark">Engagement Letter</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${statusStyles[letter.status]}`}>
                      {letter.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(letter.created_at).toLocaleDateString('en-GB')}
                    {letter.sent_at ? ' · Sent ' + new Date(letter.sent_at).toLocaleDateString('en-GB') : ''}
                    {letter.signed_at ? ' · Signed ' + new Date(letter.signed_at).toLocaleDateString('en-GB') + ' by ' + letter.signed_name : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {letter.status === 'draft' && can.manageEngagementLetters && (
                    <>
                      <button
                        onClick={() => openEdit(letter)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-brand-dark hover:bg-gray-200 transition font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSend(letter.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-opacity-90 transition font-medium"
                      >
                        Send to client
                      </button>
                    </>
                  )}
                  {letter.status === 'draft' && can.deleteClient && (
                    <button
                      onClick={() => handleDelete(letter.id)}
                      disabled={deletingId === letter.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition font-medium disabled:opacity-50"
                    >
                      {deletingId === letter.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  {letter.status !== 'draft' && (
                    <button
                      onClick={() => openBrandedView(letter)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-brand-dark hover:bg-gray-200 transition font-medium"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
