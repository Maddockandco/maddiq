import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface NicaiMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useNicaiChat(clientId: string) {
  const supabase = createClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [messages, setMessages] = useState<NicaiMessage[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadMostRecentConversation() }, [clientId])

  async function loadMostRecentConversation() {
    setLoading(true)
    const { data: conv } = await supabase
      .from('ai_advisor_conversations')
      .select('id, industry')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (conv) {
      setConversationId(conv.id)
      setIndustry(conv.industry)
      const { data: msgs } = await supabase
        .from('ai_advisor_messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    setLoading(false)
  }

  function startNewConversation() {
    setConversationId(null)
    setMessages([])
    setError('')
  }

  async function sendMessage(input: string) {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setSending(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai-advisor/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ clientId, conversationId, message: userMessage }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Nicai could not respond')

      setConversationId(body.conversationId)
      setIndustry(body.industry)
      setMessages((prev) => [...prev, { role: 'assistant', content: body.reply }])
      return true
    } catch (err: any) {
      setError(err.message)
      setMessages((prev) => prev.slice(0, -1))
      return false
    } finally {
      setSending(false)
    }
  }

  return { conversationId, industry, messages, sending, loading, error, startNewConversation, sendMessage }
}
