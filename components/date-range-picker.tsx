'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Date-range picker with a monthly calendar (Spanish, week starts Monday).
//
// Selection state lives INSIDE the component: the parent only hears about
// the range once it is complete (start + end), via onChange. While the
// user is mid-selection (only a start tapped), the partial state is kept
// locally and painted from there. The internal state is re-synced from
// props whenever they change from the outside (e.g. the reports page
// applies a preset), so presets and manual picking never fight.
// Dates travel as 'YYYY-MM-DD' strings and are parsed as LOCAL dates —
// never through `new Date(str)`, which would parse as UTC midnight and
// shift the day in this timezone.

interface DateRangePickerProps {
  start: string | null
  end: string | null
  onChange: (start: string, end: string) => void
}

function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function formatFriendly(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const todayISO = toISODate(new Date())

  const [selStart, setSelStart] = useState<string | null>(start)
  const [selEnd, setSelEnd] = useState<string | null>(end)

  const initialMonth = parseISODate(start ?? todayISO)
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth())

  // External changes (presets) replace the internal selection and jump
  // the visible month to the new start.
  useEffect(() => {
    setSelStart(start)
    setSelEnd(end)
    if (start) {
      const d = parseISODate(start)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [start, end])

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const handleDayTap = (iso: string) => {
    // No start yet, or a complete range already exists: this tap begins
    // a brand-new selection.
    if (!selStart || (selStart && selEnd)) {
      setSelStart(iso)
      setSelEnd(null)
      return
    }
    // Start chosen, waiting for the end.
    if (iso >= selStart) {
      setSelEnd(iso)
      onChange(selStart, iso)
    } else {
      // Tapped before the start: that day becomes the new start.
      setSelStart(iso)
      setSelEnd(null)
    }
  }

  // Calendar grid for the visible month: leading blanks so the 1st
  // lands under its weekday (Monday-first), then the days of the month.
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(viewYear, viewMonth, i + 1)),
    ),
  ]

  const monthLabel = firstOfMonth.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })

  let summary: string
  if (selStart && selEnd) {
    const dayCount =
      Math.round(
        (parseISODate(selEnd).getTime() - parseISODate(selStart).getTime()) / 86400000,
      ) + 1
    summary = `Del ${formatFriendly(selStart)} al ${formatFriendly(selEnd)} · ${dayCount} ${dayCount === 1 ? 'día' : 'días'}`
  } else if (selStart) {
    summary = 'Ahora toca el día final'
  } else {
    summary = 'Toca el día inicial'
  }

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Mes anterior"
          className="flex items-center justify-center w-11 h-11 rounded-full border border-[#cbd5e1] text-[#00357f] hover:bg-[#dee8ff]/50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-extrabold text-[#00357f] capitalize tracking-tight">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Mes siguiente"
          className="flex items-center justify-center w-11 h-11 rounded-full border border-[#cbd5e1] text-[#00357f] hover:bg-[#dee8ff]/50 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday header (Monday first) */}
      <div className="grid grid-cols-7 mb-1" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span
            key={i}
            className="h-8 flex items-center justify-center text-[11px] font-black uppercase tracking-wider text-[#737784]"
          >
            {d}
          </span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`blank-${i}`} />
          const isFuture = iso > todayISO
          const isToday = iso === todayISO
          const isEndpoint = iso === selStart || iso === selEnd
          const inRange =
            selStart !== null && selEnd !== null && iso > selStart && iso < selEnd

          let classes =
            'h-10 min-w-10 w-full flex items-center justify-center text-sm transition-colors '
          if (isEndpoint) {
            classes += 'bg-[#00357f] text-white font-extrabold rounded-full cursor-pointer'
          } else if (inRange) {
            classes += 'bg-[#dee8ff] text-[#00357f] font-bold rounded-none cursor-pointer'
          } else if (isFuture) {
            classes += 'text-[#c3cad6] rounded-full cursor-not-allowed'
          } else {
            classes += 'text-[#111c2d] font-semibold rounded-full hover:bg-[#f0f3ff] cursor-pointer'
          }
          if (isToday && !isEndpoint) {
            classes += ' ring-2 ring-inset ring-[#0899c9]'
          }

          return (
            <button
              key={iso}
              type="button"
              disabled={isFuture}
              onClick={() => handleDayTap(iso)}
              aria-label={formatFriendly(iso)}
              aria-pressed={isEndpoint}
              className={classes}
            >
              {parseISODate(iso).getDate()}
            </button>
          )
        })}
      </div>

      {/* Selection summary / guidance */}
      <p className="mt-3 text-xs font-bold text-[#434653] text-center" role="status">
        {summary}
      </p>
    </div>
  )
}
