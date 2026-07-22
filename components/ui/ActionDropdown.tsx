'use client'

import { useState, useRef, useEffect } from 'react'

export interface ActionOption {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
}

export default function ActionDropdown({
  primary,
  options,
  loading,
  loadingLabel = 'Working...',
}: {
  primary: ActionOption
  options: ActionOption[]
  loading?: boolean
  loadingLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={primary.onClick}
        disabled={loading || primary.disabled}
        className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-l-lg text-sm hover:bg-opacity-90 transition disabled:opacity-50"
      >
        {loading ? loadingLabel : primary.label}
      </button>
      {options.length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={loading}
          className="bg-brand-dark text-white px-2 rounded-r-lg border-l border-white/20 hover:bg-opacity-90 transition disabled:opacity-50"
        >
          ▾
        </button>
      )}
      {open && options.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[190px] overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setOpen(false); opt.onClick() }}
              disabled={opt.disabled}
              className="block w-full text-left px-4 py-2 text-sm text-brand-dark hover:bg-gray-50 transition disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
