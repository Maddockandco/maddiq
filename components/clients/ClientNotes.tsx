'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClientNotes({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchNotes()
  }, [clientId])

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('id, content, created_at, firm_users(full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    setError('')

    if (!content.trim()) {
      setError('Note cannot be empty')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) { setError('Could not find your firm'); setSaving(false); return }

    const { error: insertError } = await supabase
      .from('notes')
      .insert({
        client_id: clientId,
        firm_id: firmUser.firm_id,
        content: content.trim(),
        created_by: firmUser.id,
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      setContent('')
      fetchNotes()
    }
    setSaving(false)
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', noteId)
    setNotes(notes.filter(n => n.id !== noteId))
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading notes...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Add note */}
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

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">No notes yet — add one above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-brand-dark leading-relaxed flex-1">{note.content}</p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-red-400 hover:text-red-600 transition text-xs shrink-0"
                >
                  Delete
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                <div className="w-6 h-6 rounded-full bg-brand-dark flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {note.firm_users?.full_name?.[0] || 'U'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {note.firm_users?.full_name || 'Unknown'} · {new Date(note.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
