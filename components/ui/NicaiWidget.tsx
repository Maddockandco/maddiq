'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRY_LABELS } from '@/lib/industryDetection'
import { useNicaiChat } from '@/hooks/useNicaiChat'
import NicaiAvatar from '@/components/ui/NicaiAvatar'

const POSITION_KEY = 'nicai_widget_position'
const GREETED_KEY = 'nicai_greeted_this_session'
const BUTTON_SIZE = 56

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 16), max - 16)
}

export default function NicaiWidget({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [clientName, setClientName] = useState('')
  const [showGreeting, setShowGreeting] = useState(false)
  const { industry, messages, sending, loading, error, startNewConversation, sendMessage } = useNicaiChat(clientId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Position - bottom/right offsets from the viewport edge, draggable
  const [pos, setPos] = useState({ right: 24, bottom: 24 })
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startRight: number; startBottom: number }>({
    dragging: false, startX: 0, startY: 0, startRight: 24, startBottom: 24,
  })

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(POSITION_KEY) : null
    if (saved) {
      try { setPos(JSON.parse(saved)) } catch {}
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: firmUser } = await supabase.from('firm_users').select('full_name').eq('user_id', user.id).single()
      const name = (firmUser?.full_name || user.email || '').split(' ')[0]
      setFirstName(name)

      if (typeof window !== 'undefined' && !sessionStorage.getItem(GREETED_KEY)) {
        sessionStorage.setItem(GREETED_KEY, '1')
        setShowGreeting(true)
        setTimeout(() => setShowGreeting(false), 6000)
      }
    })
    supabase.from('clients').select('name').eq('id', clientId).single().then(({ data }) => {
      if (data) setClientName(data.name)
    })
  }, [clientId])

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  function handleDragStart(e: React.PointerEvent) {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startRight: pos.right, startBottom: pos.bottom }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const newRight = clamp(dragRef.current.startRight - dx, window.innerWidth - BUTTON_SIZE)
    const newBottom = clamp(dragRef.current.startBottom - dy, window.innerHeight - BUTTON_SIZE)
    setPos({ right: newRight, bottom: newBottom })
  }

  function handleDragEnd() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos))
  }

  function handleClick() {
    setOpen((o) => !o)
    setShowGreeting(false)
  }

  async function handleSend() {
    const text = input
    setInput('')
    const ok = await sendMessage(text)
    if (!ok) setInput(text)
  }

  const welcomeMessage = firstName
    ? `Hi ${firstName}! I'm Nicai, your ${industry ? (INDUSTRY_LABELS[industry] || 'General').toLowerCase() : ''} advisor for ${clientName || 'this client'}. What can I help with?`
    : ''

  return (
    <>
      {showGreeting && !open && (
        <div
          className="fixed bg-white border border-gray-200 shadow-lg rounded-2xl px-4 py-2.5 text-sm text-brand-dark z-50 max-w-[220px]"
          style={{ right: pos.right, bottom: pos.bottom + BUTTON_SIZE + 12 }}
        >
          Hi {firstName || 'there'}! 👋 I'm Nicai — tap if you need anything.
        </div>
      )}

      {open && (
        <div
          className="fixed w-96 h-[520px] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden z-50"
          style={{ right: pos.right, bottom: pos.bottom + BUTTON_SIZE + 12 }}
        >
          <div className="bg-brand-dark px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <NicaiAvatar size={30} />
              <div>
                <p className="text-white text-sm font-semibold leading-tight">Nicai</p>
                {!loading && (
                  <p className="text-white/50 text-[11px] leading-tight">
                    {industry ? INDUSTRY_LABELS[industry] || 'General' : 'General'} advisor
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={startNewConversation} className="text-white/70 hover:text-white text-[11px] font-medium">
                New
              </button>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-sm px-1">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : messages.length === 0 ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs bg-gray-100 text-brand-dark">
                  {welcomeMessage || 'Ask me anything about this client — VAT, cashflow, dividends, or a specific item on their invoices/bills.'}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-dark text-white' : 'bg-gray-100 text-brand-dark'}`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 rounded-2xl px-3 py-2 text-xs">Thinking...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-1.5">{error}</div>}

          <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask Nicai..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="bg-brand-dark text-white font-semibold px-3 py-2 rounded-lg text-xs hover:bg-opacity-90 transition disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onClick={handleClick}
        className="fixed rounded-full shadow-xl hover:scale-105 transition z-50 flex items-center justify-center bg-white cursor-grab active:cursor-grabbing"
        style={{ right: pos.right, bottom: pos.bottom, width: BUTTON_SIZE, height: BUTTON_SIZE }}
        title="Ask Nicai — drag to move"
      >
        <NicaiAvatar size={48} />
      </button>
    </>
  )
}
