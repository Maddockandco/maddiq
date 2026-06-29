'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showing, setShowing] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowing(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setShowing(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const searchResults: any[] = []

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, type, status')
        .ilike('name', `%${query}%`)
        .limit(5)

      if (clients) {
        clients.forEach(c => searchResults.push({
          id: c.id,
          title: c.name,
          subtitle: `${c.type} · ${c.status}`,
          href: `/clients/${c.id}`,
          icon: '👤',
          type: 'Client',
        }))
      }

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, clients(name)')
        .ilike('title', `%${query}%`)
        .limit(5)

      if (tasks) {
        tasks.forEach(t => searchResults.push({
          id: t.id,
          title: t.title,
          subtitle: (t.clients as any)?.name || 'Internal task',
          href: `/tasks/${t.id}`,
          icon: '✅',
          type: 'Task',
        }))
      }

      setResults(searchResults)
      setShowing(true)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  function handleSelect(href: string) {
    setQuery('')
    setShowing(false)
    router.push(href)
  }

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowing(true)}
          placeholder="Search clients, tasks..."
          className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-gold focus:bg-white/15 transition"
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showing && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}-${index}`}
              onClick={() => handleSelect(result.href)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-light transition-colors text-left border-b border-gray-50 last:border-0"
            >
              <span className="text-lg">{result.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-dark truncate">{result.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{result.subtitle}</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                {result.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {showing && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
          <p className="text-sm text-gray-500 text-center">No results found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
