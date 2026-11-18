'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  agendaDayNumber,
  getMonthAppointmentDays,
  parseLocalDate,
  toLocalDateISO,
  type AppointmentDayMarks,
} from '@/lib/appointments'

/**
 * Month calendar for picking the appointment day in the staff agenda
 * (owner's order 2026-11-18). It opens as a MODAL over the screen —
 * dark backdrop, centered card, closes on backdrop tap, on the X, on
 * Escape or by picking a day — instead of the old dropdown that
 * unfolded under the day strip.
 *
 * Days are painted by the state of their appointments (marks come from
 * getMonthAppointmentDays; cancelled appointments never mark):
 *  - light green  → the day has a CONFIRMED appointment
 *  - soft orange  → the day has a request PENDING confirmation
 *  - green + orange dot → both (something still waits for confirmation)
 * Past days and days the shop does not work keep their gray, disabled
 * treatment ABOVE the state colors. The selected day is solid brand
 * blue; today gets a brand outline when it carries no state color.
 */

interface AppointmentCalendarProps {
  /** 'YYYY-MM-DD' currently chosen in the form. */
  selectedISO: string
  /** 'YYYY-MM-DD' of today (local). */
  todayISO: string
  /** Worked days, agenda numbers 1 = lunes … 7 = domingo. */
  openDays: number[]
  onSelect: (iso: string) => void
  onClose: () => void
}

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function AppointmentCalendar({
  selectedISO,
  todayISO,
  openDays,
  onSelect,
  onClose,
}: AppointmentCalendarProps) {
  const [mounted, setMounted] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseLocalDate(selectedISO)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [marks, setMarks] = useState<Record<string, AppointmentDayMarks>>({})
  const marksCacheRef = useRef(new Map<string, Record<string, AppointmentDayMarks>>())

  useEffect(() => { setMounted(true) }, [])

  // Close on Escape and lock the page scroll while the modal is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  // Load the displayed month's appointment marks (cached per month so
  // flipping back and forth does not refetch). A failed load never
  // blocks the calendar: the days simply show without state colors.
  useEffect(() => {
    const key = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`
    const cached = marksCacheRef.current.get(key)
    if (cached) {
      setMarks(cached)
      return
    }
    let cancelled = false
    getMonthAppointmentDays(viewMonth.getFullYear(), viewMonth.getMonth())
      .then(loaded => {
        marksCacheRef.current.set(key, loaded)
        if (!cancelled) setMarks(loaded)
      })
      .catch(() => { if (!cancelled) setMarks({}) })
    return () => { cancelled = true }
  }, [viewMonth])

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const lead = (new Date(year, month, 1).getDay() + 6) % 7 // lunes-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const list: ({ iso: string; date: Date; open: boolean; past: boolean } | null)[] = []
    for (let i = 0; i < lead; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const iso = toLocalDateISO(date)
      list.push({ iso, date, open: openDays.includes(agendaDayNumber(date)), past: iso < todayISO })
    }
    return list
  }, [viewMonth, openDays, todayISO])

  const monthIndexOf = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const canPrevMonth = monthIndexOf(viewMonth) > monthIndexOf(new Date())
  const canNextMonth = monthIndexOf(viewMonth) < monthIndexOf(new Date()) + 3
  const shiftMonth = (delta: number) =>
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1526]/50 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir el día de la cita"
        className="anim-fade-up w-[350px] max-w-full bg-white rounded-3xl shadow-2xl p-4 sm:p-5"
      >
        {/* Month header */}
        <div className="flex items-center gap-1.5">
          <p className="flex-1 text-base font-extrabold text-[#00357f] capitalize truncate">
            {new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(viewMonth)}
          </p>
          <button
            type="button"
            disabled={!canPrevMonth}
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
            className="w-8 h-8 rounded-lg border border-[#cbd5e1] flex items-center justify-center hover:bg-[#f0f3ff] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-[#00357f]" />
          </button>
          <button
            type="button"
            disabled={!canNextMonth}
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
            className="w-8 h-8 rounded-lg border border-[#cbd5e1] flex items-center justify-center hover:bg-[#f0f3ff] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-[#00357f]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar calendario"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737784] hover:bg-[#f0f3ff] hover:text-[#111c2d] active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 mt-3">
          {WEEKDAY_HEADERS.map(d => (
            <span key={d} className="text-center text-[10px] font-black uppercase tracking-wider text-[#737784] py-1">
              {d}
            </span>
          ))}
          {cells.map((cell, i) => {
            if (cell === null) return <span key={`blank-${i}`} />
            const dayMarks = marks[cell.iso]
            const disabled = !cell.open || cell.past
            const isSelected = cell.iso === selectedISO
            const isToday = cell.iso === todayISO
            // Gray (past / not worked) wins over the state colors.
            let classes = 'text-[#111c2d] hover:bg-[#f0f3ff] cursor-pointer'
            if (disabled) {
              classes = 'text-[#737784]/40 cursor-not-allowed'
            } else if (isSelected) {
              classes = 'bg-[#00357f] text-white shadow-md shadow-[#00357f]/25 cursor-pointer'
            } else if (dayMarks?.confirmed) {
              classes = 'bg-[#dcfce7] text-[#15803d] font-extrabold hover:brightness-95 cursor-pointer'
            } else if (dayMarks?.pending) {
              classes = 'bg-[#ffedd5] text-[#9a3412] font-extrabold hover:brightness-95 cursor-pointer'
            } else if (isToday) {
              classes = 'border border-[#00357f] text-[#00357f] hover:bg-[#f0f3ff] cursor-pointer'
            }
            if (!disabled && !isSelected && isToday && (dayMarks?.confirmed || dayMarks?.pending)) {
              classes += ' ring-1 ring-inset ring-[#00357f]/60'
            }
            // Orange dot when the day ALSO waits for a confirmation:
            // on a green (confirmed) day, or on the selected day.
            const showPendingDot = !disabled && !!dayMarks?.pending && (!!dayMarks?.confirmed || isSelected)
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(cell.iso)}
                aria-label={`${cell.date.getDate()} de ${new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(cell.date)}${dayMarks?.confirmed ? ', con cita confirmada' : ''}${dayMarks?.pending ? ', con cita por confirmar' : ''}`}
                className={`relative h-10 rounded-xl text-sm font-bold transition-all active:scale-95 ${classes}`}
              >
                {cell.date.getDate()}
                {showPendingDot && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#f97316] ring-1 ring-white/70" />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3.5 pt-3 border-t border-[#f0f3ff]">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#434653]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Confirmada
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#434653]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> Por confirmar
          </span>
        </div>
        <p className="text-[10px] text-[#737784] font-semibold mt-2 leading-relaxed">
          Un punto naranja sobre un día verde avisa que ese día también hay una cita por confirmar.
          Los días en gris no se trabajan (según «Configurar horario») o ya pasaron.
        </p>
      </div>
    </div>,
    document.body
  )
}
