'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react'
import {
  agendaDayNumber,
  createAppointment,
  formatAppointmentDate,
  formatAppointmentTime,
  getAgendaSettings,
  getDaySlots,
  getMyContactPrefill,
  toLocalDateISO,
  type AgendaSettings,
  type Appointment,
  type DaySlot,
} from '@/lib/appointments'
import { getAppSetting } from '@/lib/services'

interface DayOption {
  iso: string
  date: Date
  open: boolean
}

export default function AgendarPage() {
  const [settings, setSettings] = useState<AgendaSettings | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [slots, setSlots] = useState<DaySlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [booked, setBooked] = useState<Appointment | null>(null)

  // Next 14 days (today first). Closed days (e.g. Sunday) are disabled.
  const days = useMemo<DayOption[]>(() => {
    if (!settings) return []
    const result: DayOption[] = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      result.push({
        iso: toLocalDateISO(d),
        date: d,
        open: settings.openDays.includes(agendaDayNumber(d)),
      })
    }
    return result
  }, [settings])

  useEffect(() => {
    async function init() {
      const [agendaSettings, prefill, wa] = await Promise.all([
        getAgendaSettings(),
        getMyContactPrefill(),
        getAppSetting('business_whatsapp'),
      ])
      setSettings(agendaSettings)
      if (prefill) {
        setCustomerId(prefill.id)
        if (prefill.name) setName(prefill.name)
        if (prefill.phone) setPhone(prefill.phone)
      }
      setWhatsapp(wa && wa.replace(/\D/g, '').length >= 10 ? wa.replace(/\D/g, '') : null)
    }
    init()
  }, [])

  // Preselect the first open day.
  useEffect(() => {
    if (!selectedDate && days.length > 0) {
      const firstOpen = days.find(d => d.open)
      if (firstOpen) setSelectedDate(firstOpen.iso)
    }
  }, [days, selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    async function loadSlots() {
      setLoadingSlots(true)
      setSlotsError(null)
      setSelectedTime('')
      try {
        const daySlots = await getDaySlots(selectedDate)
        if (!cancelled) setSlots(daySlots)
      } catch (e: any) {
        if (!cancelled) {
          setSlots([])
          setSlotsError(e.message || 'No se pudieron cargar los horarios.')
        }
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }
    loadSlots()
    return () => { cancelled = true }
  }, [selectedDate])

  // Slots earlier than "now" are not bookable when the day is today.
  const visibleSlots = useMemo(() => {
    const todayISO = toLocalDateISO(new Date())
    if (selectedDate !== todayISO) return slots
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return slots.map(s => {
      const [h, m] = s.time.split(':').map(Number)
      return { ...s, available: s.available && h * 60 + m > nowMinutes }
    })
  }, [slots, selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!selectedDate || !selectedTime) {
      setFormError('Elige el día y la hora de tu cita.')
      return
    }
    if (name.trim().length < 3) {
      setFormError('Escribe tu nombre completo, por favor.')
      return
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setFormError('Escribe un teléfono válido para confirmar tu cita.')
      return
    }
    setSubmitting(true)
    try {
      const appointment = await createAppointment({
        date: selectedDate,
        time: selectedTime,
        name,
        phone,
        notes,
        customerId,
      })
      setBooked(appointment)
    } catch (err: any) {
      setFormError(err.message || 'No se pudo apartar la cita. Inténtalo de nuevo.')
      // The slot may have just been taken: refresh availability.
      try { setSlots(await getDaySlots(selectedDate)) } catch { /* keep form error */ }
    } finally {
      setSubmitting(false)
    }
  }

  const resetBooking = () => {
    setBooked(null)
    setSelectedTime('')
    setNotes('')
    setFormError(null)
    if (selectedDate) {
      getDaySlots(selectedDate).then(setSlots).catch(() => setSlots([]))
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-[#f9f9ff] to-[#eef4ff] text-[#111c2d] px-3 py-4 sm:p-5 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
      {/* Header */}
      <section className="anim-fade-up relative overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white px-4 py-5 shadow-sm sm:px-6 md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#00357f] md:via-[#00509e] md:to-[#00668a] md:px-8 md:py-9 md:shadow-lg md:shadow-[#00357f]/20 md:text-white">
        <div className="flex items-start gap-3.5">
          <span className="w-11 h-11 rounded-2xl bg-[#dee8ff] md:bg-white/15 flex items-center justify-center shrink-0">
            <Eye className="w-6 h-6 text-[#00357f] md:text-white" />
          </span>
          <div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-[#00357f] md:text-white">
              Agenda tu examen de la vista <span className="text-emerald-500 md:text-emerald-300">GRATIS</span>
            </h1>
            <p className="text-sm text-[#434653] md:text-white/85 font-medium mt-1 leading-relaxed">
              Elige el día y la hora que te queden mejor y aparta tu cita en Óptica Rayo.
              Tu cita queda <strong>pendiente de confirmación</strong>: te contactaremos para confirmarla.
            </p>
          </div>
        </div>
      </section>

      {booked ? (
        /* ---------- Success state ---------- */
        <section className="anim-fade-up mt-5 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-6 text-center space-y-4">
          <span className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </span>
          <div>
            <h2 className="text-lg font-black text-[#111c2d]">¡Tu cita quedó apartada!</h2>
            <p className="text-sm text-[#434653] font-medium mt-1">
              Estado: <span className="font-black text-amber-600">Pendiente de confirmación</span>
            </p>
          </div>
          <div className="bg-[#f0f3ff] border border-[#cbd5e1]/50 rounded-xl p-4 text-left space-y-1.5">
            <p className="text-sm font-bold text-[#00357f] capitalize">{formatAppointmentDate(booked.scheduled_date)}</p>
            <p className="text-sm text-[#434653] font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#00357f]" /> {formatAppointmentTime(booked.scheduled_time)}
            </p>
            <p className="text-sm text-[#434653] font-medium flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#00357f]" /> {booked.guest_name} · {booked.guest_phone}
            </p>
          </div>
          <p className="text-xs text-[#737784] font-medium leading-relaxed">
            Te contactaremos al teléfono que nos diste para confirmar. Si necesitas cambiarla,
            llámanos o aparta otra cita y avísanos.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={resetBooking}
              className="bg-[#00357f] hover:bg-[#004aad] active:scale-[0.98] text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all cursor-pointer"
            >
              Apartar otra cita
            </button>
            <Link
              href="/catalog"
              className="border border-[#cbd5e1] hover:bg-[#f0f3ff] active:scale-[0.98] text-[#00357f] font-bold py-2.5 px-5 rounded-xl text-sm transition-all text-center"
            >
              Ver el catálogo
            </Link>
          </div>
          {whatsapp && (
            <p className="text-xs text-[#737784] font-semibold pt-1">
              ¿Prefieres por teléfono?{' '}
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00357f] font-black underline underline-offset-2"
              >
                Llámanos o escríbenos por WhatsApp
              </a>
            </p>
          )}
        </section>
      ) : (
        /* ---------- Booking form ---------- */
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Day picker */}
          <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> 1. Elige el día
            </h2>
            {!settings ? (
              <p className="text-sm text-[#737784] font-medium mt-3">Cargando días disponibles…</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-3.5">
                {days.map(day => {
                  const isSelected = day.iso === selectedDate
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      disabled={!day.open}
                      onClick={() => setSelectedDate(day.iso)}
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
                        {day.open
                          ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(day.date).replace('.', '')
                          : 'Cerrado'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Time picker */}
          <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <Clock className="w-4 h-4" /> 2. Elige la hora
            </h2>
            {selectedDate && (
              <p className="text-xs text-[#737784] font-semibold mt-1.5 capitalize">
                {formatAppointmentDate(selectedDate)}
              </p>
            )}
            {loadingSlots ? (
              <p className="text-sm text-[#737784] font-medium mt-3">Cargando horarios…</p>
            ) : slotsError ? (
              <p className="text-sm text-[#ba1a1a] font-semibold mt-3">{slotsError}</p>
            ) : visibleSlots.length === 0 ? (
              <p className="text-sm text-[#737784] font-medium mt-3">
                Este día no hay horarios disponibles. Elige otro día, por favor.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3.5">
                {visibleSlots.map(slot => {
                  const isSelected = slot.time === selectedTime
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-all ${
                        !slot.available
                          ? 'border-[#cbd5e1]/40 bg-[#f0f3ff]/50 text-[#737784]/50 line-through cursor-not-allowed'
                          : isSelected
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
            {visibleSlots.length > 0 && (
              <p className="text-[11px] text-[#737784] font-medium mt-3">
                Los horarios tachados ya están apartados.
              </p>
            )}
          </section>

          {/* Contact form */}
          <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5 space-y-3.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <User className="w-4 h-4" /> 3. Tus datos
            </h2>
            {customerId && (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Estás apartando con tu cuenta de cliente: revisa que tu nombre y teléfono estén correctos.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Nombre completo</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. María López Hernández"
                  className="mt-1 w-full border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Teléfono (WhatsApp)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ej. 444 123 4567"
                  className="mt-1 w-full border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
                  autoComplete="tel"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej. Uso lentes desde hace 5 años, quiero revisión completa…"
                className="mt-1 w-full border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white resize-none"
              />
            </label>

            {formError && (
              <p className="text-sm text-[#ba1a1a] font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedTime}
              className="w-full bg-[#00357f] hover:bg-[#004aad] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 px-5 rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-[#00357f]/20"
            >
              {submitting ? 'Apartando…' : 'Apartar cita'}
            </button>

            {whatsapp && (
              <p className="text-xs text-[#737784] font-semibold text-center flex items-center justify-center gap-1.5 flex-wrap">
                <Phone className="w-3.5 h-3.5" />
                ¿Prefieres por teléfono?
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00357f] font-black underline underline-offset-2 inline-flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Llámanos o escríbenos
                </a>
              </p>
            )}
          </section>
        </form>
      )}
    </main>
  )
}
