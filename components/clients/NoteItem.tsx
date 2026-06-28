'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoteReply from '@/components/clients/NoteReply'

type Props = {
  note: any
  currentUserId: string
  clientId: string
  firmId: string
  replies: any[]
  onRefresh: () => void
}

export default function NoteItem({ note, currentUserId, clientId, firmId, replies, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const isAuthor = note.firm_users?.user_id === currentUserId

  async function handleSave() {
    setSaving(true)
    await supabase.from('notes').update({ content: editContent.trim() }).eq('id', note.id)
    setEditing(false)
    onRefresh()
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', note.id)
    onRefresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Main note */}
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-dark text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditContent(note.content) }}
              className="bg-gray-100 text-gray-600 text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-brand-dark leading-relaxed">{note.content}</p>
      )}

      {/* Note footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-dark flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {note.firm_users?.full_name?.[0] || 'U'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {note.firm_users?.full_name || 'Unknown'} · {new Date(note.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthor && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-brand-dark transition">Edit</button>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition">Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-4 space-y-3 pl-4 border-l-2 border-brand-gold/30">
          {replies.map((reply) => (
            <div key={reply.id} className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-brand-dark leading-relaxed">{reply.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center">
                  <span className="text-brand-dark text-xs font-semibold">
                    {reply.firm_users?.full_name?.[0] || 'U'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {reply.firm_users?.full_name || 'Unknown'} · {new Date(reply.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply button */}
      <div className="mt-4">
        <NoteReply
          noteId={note.id}
          clientId={clientId}
          firmId={firmId}
          currentUserId={currentUserId}
          onReplyAdded={onRefresh}
        />
      </div>
    </div>
  )
}
