'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NoteReply({ noteId, clientId, firmId, currentUserId, onReplyAdded }: { noteId: string; clientId: string; firmId: string; currentUserId: string; onReplyAdded: () => void }) {
  const [showing, setShowing] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleReply() {
    setSaving(true)
    if (!content.trim()) { setSaving(false); return }
    const { data: firmUser } = await supabase.from('firm_users').select('id').eq('user_id', currentUserId).single()
    await supabase.from('notes').insert({ client_id: clientId, firm_id: firmId, content: content.trim(), created_by: firmUser?.id, parent_id: noteId })
    setContent('')
    setShowing(false)
    onReplyAdded()
    setSaving(false)
  }

  if (!showing) return (
    <button onClick={() => setShowing(true)} className="text-xs text-brand-gold hover:text-brand-dark transition font-medium">↩ Reply</button>
  )

  return (
    <div className="mt-3 space-y-2">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Write a reply..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none" />
      <div className="flex gap-2">
        <button onClick={handleReply} disabled={saving} className="bg-brand-dark text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50">
          {saving ? 'Posting...' : 'Post reply'}
        </button>
        <button onClick={() => { setShowing(false); setContent('') }} className="bg-gray-100 text-gray-600 text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-200 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}
