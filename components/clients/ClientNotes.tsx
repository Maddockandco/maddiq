'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoteItem from '@/components/clients/NoteItem'
import { logActivity } from '@/lib/logActivity'

export default function ClientNotes({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [firmId, setFirmId] = useState('')
  const [clientName, setClientName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: firmUser } = await supabase
          .from('firm_users')
          .select('firm_id')
          .eq('user_id', user.id)
          .single()
        if (firmUser) setFirmId(firmUser.firm_id)
      }
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single()
      if (clientData) setClientName(clientData.name)
      fetchNotes()
    }
    init()
  }, [clientId])

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('id, content, created_at, parent_id, firm_users(full_name, user_id)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
    if (data) setNotes(data)
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    setError('')
    if (!content.trim()) { setError('Note cannot be empty'); setSaving(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }
    const { error: insertError } = await supabase.from('notes').insert({
      client_id: clientId,
      firm_id: firmUser.firm_id,
      content: content.trim(),
      created_by: firmUser.id,
      parent_id: null,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      const preview = content.trim().length > 50 ? content.trim().substring(0, 50) + '...' : content.trim()

      await logActivity({
        firmId: firmUser.firm_id,
        clientId: clientId,
        firmUserId: firmUser.id,
        actionType: 'note_added',
        title: preview,
        subtitle: clientName,
        href: '/clients/' + clientId,
        icon: '📝',
      })

      setContent('')
      fetchNotes()
    }
    setSaving(false)
  }

  const parentNotes = notes.filter(n => !n.parent_id)
  const replies = notes.filter(n => n.parent_id)

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading notes...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Add Note</h3>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Add a note about this client..."
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving...' : 'Add note'}
        </button>
      </div>

      {parentNotes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No notes yet — add one above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {parentNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              currentUserId={currentUser?.id || ''}
              clientId={clientId}
              firmId={firmId}
              replies={replies.filter(r => r.parent_id === note.id)}
              onRefresh={fetchNotes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
