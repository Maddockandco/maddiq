'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

function isoToDisplay(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

  // Reject dates that don't actually exist, e.g. 31/02/2026
  const check = new Date(iso + 'T00:00:00Z')
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null

  return iso
}

export default function DatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: {
  value: string
  onChange: (iso: string) => void
  className?: string
  placeholder?: string
}) {
  const [displayValue, setDisplayValue] = useState(isoToDisplay(value))
  const nativeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(isoToDisplay(value))
  }, [value])

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplayValue(e.target.value)
  }

  function handleBlur() {
    if (displayValue.trim() === '') {
      onChange('')
      return
    }
    const iso = displayToIso(displayValue)
    if (iso) {
      onChange(iso)
    } else {
      // Couldn't parse what was typed — revert to the last valid value
      setDisplayValue(isoToDisplay(value))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
  }

  function openCalendar() {
    const input = nativeInputRef.current
    if (!input) return
    if (typeof (input as any).showPicker === 'function') {
      (input as any).showPicker()
    } else {
      input.focus()
      input.click()
    }
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value
    if (iso) {
      onChange(iso)
      setDisplayValue(isoToDisplay(iso))
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
      />
      <button
        type="button"
        onClick={openCalendar}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-dark transition"
        aria-label="Open calendar"
      >
        <Calendar size={16} />
      </button>
      {/* Hidden native date input purely to power the calendar popup via showPicker() */}
      <input
        ref={nativeInputRef}
        type="date"
        value={value || ''}
        onChange={handleNativeChange}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
