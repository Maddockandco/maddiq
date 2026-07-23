'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LABELS } from '@/lib/industryDetection'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AiAdvisor({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadMostRecentConversation() }, [clientId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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

  async function handleSend() {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
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
      if (!res.ok) throw new Error(body.error || 'The advisor could not respond')

      setConversationId(body.conversationId)
      setIndustry(body.industry)
      setMessages((prev) => [...prev, { role: 'assistant', content: body.reply }])
    } catch (err: any) {
      setError(err.message)
      setMessages((prev) => prev.slice(0, -1))
      setInput(userMessage)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-brand-dark px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wider">AI Advisor</p>
          <h3 className="text-white text-lg font-semibold">
            {industry ? INDUSTRY_LABELS[industry] || 'General / Professional Services' : 'General / Professional Services'} advisor
          </h3>
        </div>
        <button onClick={startNewConversation} className="text-xs bg-white/10 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 pt-12">
            Ask about this client's VAT position, cashflow, dividends, or anything grounded in their actual data.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-dark text-white' : 'bg-gray-100 text-brand-dark'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 rounded-2xl px-4 py-2.5 text-sm">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-6 py-2">{error}</div>}

      <div className="border-t border-gray-100 p-4 flex gap-3 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask a question about this client..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
