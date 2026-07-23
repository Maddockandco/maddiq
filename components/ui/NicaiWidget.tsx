'use client'

import { useEffect, useRef, useState } from 'react'
import { INDUSTRY_LABELS } from '@/lib/industryDetection'
import { useNicaiChat } from '@/hooks/useNicaiChat'
import NicaiAvatar from '@/components/ui/NicaiAvatar'

export default function AiAdvisor({ clientId }: { clientId: string }) {
  const { industry, messages, sending, loading, error, startNewConversation, sendMessage } = useNicaiChat(clientId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    const text = input
    setInput('')
    const ok = await sendMessage(text)
    if (!ok) setInput(text)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-brand-dark px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <NicaiAvatar size={40} />
          <div>
            <p className="text-white/60 text-xs uppercase tracking-wider">Nicai</p>
            <h3 className="text-white text-lg font-semibold">
              {industry ? INDUSTRY_LABELS[industry] || 'General / Professional Services' : 'General / Professional Services'} advisor
            </h3>
          </div>
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
          placeholder="Ask Nicai about this client..."
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
