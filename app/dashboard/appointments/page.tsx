'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  PlusCircle,
  Search,
  User,
  X,
} from 'lucide-react'
import {
  agendaDayNumber,
  cancelAppointment,
  confirmAppointment,
  createAppointmentByAdmin,
  formatAppointmentDate,
  formatAppointmentTime,
  getAgendaSettings,
  getDaySlots,
  listAppointmentsForDay,
  parseLocalDate,
  toLocalDateISO,
  type Appointment,
  type DaySlot,
} from '@/lib/appointments'
import { searchCustomers } from '@/lib/services'

const STATUS_BADGES: Record<Appointment['status'], { label: string; classes: string }> = {
  pending: { label: 'Pendiente', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confirmada', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelada', classes: 'bg-red-50 text-[#ba1a1a] border-red-200' },
}

const CREATOR_LABELS: Record<Appointment['created_by'], string> = {
  customer: 'Apartó el cliente',
  guest: 'Apartó un invitado',
  admin: 'Agendada por el staff',
}

export default function StaffAppointmentsPage() {
  const todayISO = toLocalDateISO(new Date())
  const [viewDate, setViewDate] = useState(todayISO)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingDay, setLoadingDay] = useState(true)
  const [dayError, setDayError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  // Cancel inline form (reason is REQUIRED for staff: the customer reads it)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  // "Agendar para un cliente" form
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [formDate, setFormDate] = useState(todayISO)
  const [formSlots, setFormSlots] = useState<DaySlot[]>([])
  const [loadingFormSlots, setLoadingFormSlots] = useState(false)
  const [formTime, setFormTime] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6])

  const loadDay = useCallback(async (dateISO: string) => {
    setLoadingDay(true)
    setDayError(null)
    setCancelTargetId(null)
    try {
      setAppointments(await listAppointmentsForDay(dateISO))
    } catch (e: any) {
      setAppointments([])
      setDayError(e.message || 'No se pudo cargar la agenda de este día.')
    } finally {
      setLoadingDay(false)
    }
  }, [])

  useEffect(() => { loadDay(viewDate) }, [viewDate, loadDay])

  useEffect(() => {
    getAgendaSettings().then(s => setOpenDays(s.openDays)).catch(() => {})
  }, [])

  // Customer search for the admin booking form (debounced lightly).
  useEffect(() => {
    if (selectedCustomer) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const results = await searchCustomers(customerQuery)
        if (!cancelled) setCustomerResults(results)
      } catch {
        if (!cancelled) setCustomerResults([])
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [customerQuery, selectedCustomer])

  // Free slots for the admin booking form.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingFormSlots(true)
      setFormTime('')
      try {
        const daySlots = await getDaySlots(formDate)
        if (!cancelled) setFormSlots(daySlots)
      } catch {
        if (!cancelled) setFormSlots([])
      } finally {
        if (!cancelled) setLoadingFormSlots(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [formDate])

  const formDays = useMemo(() => {
    const result: { iso: string; date: Date; open: boolean }[] = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      result.push({ iso: toLocalDateISO(d), date: d, open: openDays.includes(agendaDayNumber(d)) })
    }
    return result
  }, [openDays])

  const shiftViewDate = (delta: number) => {
    const d = parseLocalDate(viewDate)
    d.setDate(d.getDate() + delta)
    setViewDate(toLocalDateISO(d))
  }

  const handleConfirm = async (appt: Appointment) => {
    setActingId(appt.id)
    try {
      const updated = await confirmAppointment(appt.id)
      setAppointments(prev => prev.map(a => (a.id === appt.id ? { ...updated, customer_name: a.customer_name, customer_phone: a.customer_phone } : a)))
    } catch (e: any) {
      setDayError(e.message || 'No se pudo confirmar la cita.')
    } finally {
      setActingId(null)
    }
  }

  const handleCancel = async (appt: Appointment) => {
    if (!cancelReason.trim()) {
      setCancelError('Escribe el motivo: el cliente lo verá en su panel.')
      return
    }
    setActingId(appt.id)
    setCancelError(null)
    try {
      const updated = await cancelAppointment(appt.id, cancelReason, 'admin')
      setAppointments(prev => prev.map(a => (a.id === appt.id ? { ...updated, customer_name: a.customer_name, customer_phone: a.customer_phone } : a)))
      setCancelTargetId(null)
      setCancelReason('')
    } catch (e: any) {
      setCancelError(e.message || 'No se pudo cancelar la cita.')
    } finally {
      setActingId(null)
    }
  }

  const handleAdminBook = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormFeedback(null)
    if (!selectedCustomer) {
      setFormFeedback({ type: 'error', text: 'Selecciona al cliente de la lista.' })
      return
    }
    if (!formTime) {
      setFormFeedback({ type: 'error', text: 'Elige un horario libre.' })
      return
    }
    setFormSubmitting(true)
    try {
      await createAppointmentByAdmin(selectedCustomer.id, formDate, formTime, formNotes)
      setFormFeedback({
        type: 'success',
        text: `Cita confirmada para ${selectedCustomer.full_name}: ${formatAppointmentDate(formDate)} a las ${formatAppointmentTime(formTime)}.`,
      })
      setFormTime('')
      setFormNotes('')
      if (formDate === viewDate) loadDay(viewDate)
    } catch (err: any) {
      setFormFeedback({ type: 'error', text: err.message || 'No se pudo agendar la cita.' })
      try { setFormSlots(await getDaySlots(formDate)) } catch { /* keep feedback */ }
    } finally {
      setFormSubmitting(false)
    }
  }

  const liveCount = appointments.filter(a => a.status !== 'cancelled').length

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 max-w-4xl mx-auto pb-24 md:pb-8 text-left space-y-5">
      {/* Header */}
      <header className="anim-fade-up">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight flex items-center gap-2.5">
          <CalendarDays className="w-7 h-7" /> Agenda de Exámenes
        </h1>
        <p className="text-sm text-[#434653] mt-1 font-medium">
          Citas del examen de la vista gratuito: confirma, cancela (con motivo) o agenda por un cliente.
        </p>
      </header>

      {/* Day navigation */}
      <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => shiftViewDate(-1)}
          className="w-9 h-9 rounded-lg border border-[#cbd5e1] flex items-center justify-center hover:bg-[#f0f3ff] active:scale-95 transition-all cursor-pointer"
          aria-label="Día anterior"
        >
          <ChevronLeft className="w-5 h-5 text-[#00357f]" />
        </button>
        <input
          type="date"
          value={viewDate}
          onChange={e => e.target.value && setViewDate(e.target.value)}
          className="border border-[#cbd5e1] rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f]"
        />
        <button
          onClick={() => shiftViewDate(1)}
          className="w-9 h-9 rounded-lg border border-[#cbd5e1] flex items-center justify-center hover:bg-[#f0f3ff] active:scale-95 transition-all cursor-pointer"
          aria-label="Día siguiente"
        >
          <ChevronRight className="w-5 h-5 text-[#00357f]" />
        </button>
        {viewDate !== todayISO && (
          <button
            onClick={() => setViewDate(todayISO)}
            className="text-xs font-black text-[#00357f] bg-[#dee8ff]/70 hover:bg-[#dee8ff] px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Hoy
          </button>
        )}
        <p className="w-full sm:w-auto sm:ml-auto text-sm font-bold text-[#00357f] capitalize">
          {formatAppointmentDate(viewDate)}
          <span className="block sm:inline text-xs text-[#737784] font-semibold sm:ml-2 normal-case">
            {loadingDay ? 'Cargando…' : `${liveCount} cita(s) en pie`}
          </span>
        </p>
      </section>

      {/* Day agenda */}
      <section className="anim-fade-up space-y-3">
        {dayError && (
          <p className="text-sm text-[#ba1a1a] font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">{dayError}</p>
        )}
        {!loadingDay && !dayError && appointments.length === 0 && (
          <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-8 text-center">
            <CalendarDays className="w-8 h-8 text-[#737784] mx-auto" />
            <p className="text-sm text-[#737784] font-bold mt-2">No hay citas para este día.</p>
          </div>
        )}
        {appointments.map(appt => {
          const badge = STATUS_BADGES[appt.status]
          const displayName = appt.customer_name || appt.guest_name || 'Sin nombre'
          const displayPhone = appt.customer_phone || appt.guest_phone || ''
          const isCancelling = cancelTargetId === appt.id
          return (
            <article key={appt.id} className={`bg-white border rounded-2xl shadow-sm p-4 ${appt.status === 'cancelled' ? 'border-[#cbd5e1]/60 opacity-75' : 'border-[#cbd5e1]'}`}>
              <div className="flex items-start gap-3.5">
                <div className="text-center shrink-0 bg-[#f0f3ff] border border-[#cbd5e1]/50 rounded-xl px-3 py-2 min-w-[76px]">
                  <Clock className="w-4 h-4 text-[#00357f] mx-auto" />
                  <p className="text-sm font-black text-[#00357f] mt-0.5">{formatAppointmentTime(appt.scheduled_time)}</p>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-[#111c2d] text-sm truncate">{displayName}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </div>
                  {displayPhone && (
                    <a href={`tel:${displayPhone.replace(/\s/g, '')}`} className="text-xs text-[#434653] font-semibold flex items-center gap-1.5 hover:text-[#00357f]">
                      <Phone className="w-3.5 h-3.5 text-[#00357f]" /> {displayPhone}
                    </a>
                  )}
                  <p className="text-[11px] text-[#737784] font-semibold">{CREATOR_LABELS[appt.created_by]}</p>
                  {appt.notes && <p className="text-xs text-[#434653] font-medium">Nota: {appt.notes}</p>}
                  {appt.status === 'cancelled' && (
                    <p className="text-xs font-semibold text-[#ba1a1a] bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                      {appt.cancelled_by === 'customer' ? 'La canceló el cliente.' : 'Cancelada por la óptica.'}
                      {appt.cancel_reason && <> Motivo: {appt.cancel_reason}</>}
                    </p>
                  )}
                </div>
              </div>

              {appt.status !== 'cancelled' && (
                <div className="flex flex-wrap gap-2 mt-3.5 pt-3 border-t border-[#f0f3ff]">
                  {appt.status === 'pending' && (
                    <button
                      onClick={() => handleConfirm(appt)}
                      disabled={actingId === appt.id}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Confirmar
                    </button>
                  )}
                  {!isCancelling ? (
                    <button
                      onClick={() => { setCancelTargetId(appt.id); setCancelReason(''); setCancelError(null) }}
                      className="inline-flex items-center gap-1.5 border border-red-200 text-[#ba1a1a] hover:bg-red-50 active:scale-[0.98] text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                  ) : (
                    <div className="w-full space-y-2">
                      <label className="block">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">
                          Motivo de la cancelación (lo verá el cliente)
                        </span>
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder="Ej. Se nos llenó la agenda de ese día, ¿te reagendamos?"
                          className="mt-1 w-full border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/30 focus:border-[#ba1a1a] bg-white"
                          autoFocus
                        />
                      </label>
                      {cancelError && <p className="text-xs text-[#ba1a1a] font-semibold">{cancelError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancel(appt)}
                          disabled={actingId === appt.id}
                          className="bg-[#ba1a1a] hover:bg-[#a31515] active:scale-[0.98] disabled:opacity-50 text-white text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                        >
                          {actingId === appt.id ? 'Cancelando…' : 'Confirmar cancelación'}
                        </button>
                        <button
                          onClick={() => setCancelTargetId(null)}
                          className="border border-[#cbd5e1] text-[#434653] hover:bg-[#f0f3ff] text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                        >
                          Volver
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </section>

      {/* Book for a customer */}
      <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> Agendar para un cliente
        </h2>
        <p className="text-xs text-[#737784] font-medium -mt-2">
          Para apuntar la cita de quien te la pide por teléfono o en mostrador. Nace <strong>confirmada</strong>: es tu propio recordatorio.
        </p>

        <form onSubmit={handleAdminBook} className="space-y-4">
          {/* Customer picker */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Cliente</span>
            {selectedCustomer ? (
              <div className="mt-1 flex items-center justify-between gap-2 bg-[#f0f3ff] border border-[#cbd5e1]/60 rounded-xl px-3.5 py-2.5">
                <span className="text-sm font-bold text-[#111c2d] flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 text-[#00357f] shrink-0" />
                  <span className="truncate">{selectedCustomer.full_name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomer(null); setCustomerQuery('') }}
                  className="text-xs font-black text-[#00357f] underline underline-offset-2 cursor-pointer shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="w-4 h-4 text-[#737784] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="Busca por nombre…"
                  className="w-full border border-[#cbd5e1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
                />
                {customerResults.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1.5 bg-white border border-[#cbd5e1] rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {customerResults.map((c: any) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-[#f0f3ff] text-sm font-semibold text-[#111c2d] cursor-pointer"
                        >
                          {c.full_name}
                          <span className="block text-[11px] text-[#737784] font-medium">
                            {c.customer_profiles?.phone || c.email}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Day chips */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Día</span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-1.5">
              {formDays.map(day => {
                const isSelected = day.iso === formDate
                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={!day.open}
                    onClick={() => setFormDate(day.iso)}
                    className={`rounded-xl border px-1 py-2 text-center transition-all ${
                      !day.open
                        ? 'border-[#cbd5e1]/40 bg-[#f0f3ff]/50 text-[#737784]/50 cursor-not-allowed'
                        : isSelected
                          ? 'border-[#00357f] bg-[#00357f] text-white shadow-md shadow-[#00357f]/25 active:scale-[0.97]'
                          : 'border-[#cbd5e1] bg-white hover:bg-[#f0f3ff] text-[#111c2d] active:scale-[0.97] cursor-pointer'
                    }`}
                  >
                    <span className={`block text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-[#737784]'}`}>
                      {new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(day.date).replace('.', '')}
                    </span>
                    <span className="block text-base font-black leading-tight">{day.date.getDate()}</span>
                    <span className={`block text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-[#737784]'}`}>
                      {day.open ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(day.date).replace('.', '') : 'Cerrado'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Free slots */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Hora (solo libres)</span>
            {loadingFormSlots ? (
              <p className="text-sm text-[#737784] font-medium mt-2">Cargando horarios…</p>
            ) : formSlots.filter(s => s.available).length === 0 ? (
              <p className="text-sm text-[#737784] font-medium mt-2">No quedan horarios libres este día.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {formSlots.filter(s => s.available).map(slot => {
                  const isSelected = slot.time === formTime
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setFormTime(slot.time)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-[#00357f] bg-[#00357f] text-white shadow-md shadow-[#00357f]/25 active:scale-[0.97]'
                          : 'border-[#cbd5e1] bg-white hover:bg-[#f0f3ff] text-[#111c2d] active:scale-[0.97] cursor-pointer'
                      }`}
                    >
                      {formatAppointmentTime(slot.time)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Notas (opcional)</span>
            <input
              type="text"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="Ej. Me pidió la cita por teléfono"
              className="mt-1 w-full border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
            />
          </label>

          {formFeedback && (
            <p className={`text-sm font-semibold rounded-lg px-3 py-2 border ${
              formFeedback.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-[#ba1a1a] bg-red-50 border-red-200'
            }`}>
              {formFeedback.text}
            </p>
          )}

          <button
            type="submit"
            disabled={formSubmitting || !selectedCustomer || !formTime}
            className="w-full sm:w-auto bg-[#00357f] hover:bg-[#004aad] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2.5 px-6 rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-[#00357f]/20"
          >
            {formSubmitting ? 'Agendando…' : 'Agendar cita confirmada'}
          </button>
        </form>
      </section>
    </main>
  )
}
