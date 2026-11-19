'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { registerCustomerAction } from '@/app/customers/actions'
import {
  agendaDayNumber,
  cancelAppointment,
  completeAppointment,
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
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { isAdminRole, normalizeRole, type AccessRole } from '@/lib/roles'
import PageHeader from '@/components/page-header'
import AppointmentCalendar from '@/components/appointment-calendar'

const STATUS_BADGES: Record<Appointment['status'], { label: string; classes: string }> = {
  pending: { label: 'Pendiente', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  // «Confirmada» is the SAME light green the booking calendar paints
  // (owner's order 2026-11-18): one green for confirmed everywhere.
  confirmed: { label: 'Confirmada', classes: 'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]' },
  // «Realizada» (owner's order, 2026-11-19): el verde de estado
  // cumplido del sistema de diseño (el de «Pagado»), distinto del
  // verde claro de «Confirmada» para que no se confundan.
  completed: { label: 'Realizada', classes: 'bg-[#e2f9ee] text-[#00422b] border-emerald-200' },
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

  // Rol de quien mira la Agenda (reglas del dueño, 2026-11-19):
  // «Realizada» solo la ve el ADMINISTRADOR (la función
  // completeAppointment además rechaza al resto de roles); «Realizar
  // examen» lo ven el administrador y el OPTOMETRISTA; el vendedor ve
  // y agenda, pero no cierra citas ni arranca el examen desde aquí.
  // En modo demo no hay sesión que resolver: el visor demo es el
  // personal administrador, como actúa el almacén demo de citas.
  const [viewerRole, setViewerRole] = useState<AccessRole | null>(null)
  const viewerIsAdmin = isAdminRole(viewerRole)
  const viewerCanStartExam = viewerIsAdmin || viewerRole === 'optometrist'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let resolved: AccessRole = 'guest'
      try {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          let roleValue: string | null = user.user_metadata?.role || null
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()
            if (profile?.role) roleValue = profile.role
          } catch {
            // keep the metadata fallback
          }
          resolved = normalizeRole(roleValue)
        } else if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          resolved = 'owner'
        }
      } catch {
        // stays 'guest': no action buttons beyond Confirmar/Cancelar
      }
      if (!cancelled) setViewerRole(resolved)
    })()
    return () => { cancelled = true }
  }, [])

  // Cancel inline form (reason is REQUIRED for staff: the customer reads it)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  // "Agendar para un cliente" form
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  // Customer dropdown visibility: it closes when the staff taps/clicks
  // OUTSIDE the picker without choosing anyone (owner's order).
  const [resultsOpen, setResultsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // After the trash button removes the selected customer, the search
  // effect must NOT reopen the results list on its own (owner's order
  // 2026-11-18): the picker stays closed until the user types in or
  // taps the search field again. «Cambiar» clears this flag instead:
  // changing the customer DOES deploy the list.
  const suppressAutoOpenRef = useRef(false)
  // The results list must NOT be open on page load (it covered the form):
  // it only auto-opens after the user taps or types in the field.
  const pickerInteractedRef = useRef(false)
  // Quick-add customer (same mini form and same creation path as the POS)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickError, setQuickError] = useState('')
  const [quickCreating, setQuickCreating] = useState(false)
  // Month calendar for picking the appointment day beyond the strip.
  // It is a MODAL now (components/appointment-calendar.tsx): it handles
  // its own backdrop/X/Escape closing, so it is not part of the
  // outside-click handler below.
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Time combo (dropdown list instead of the old button grid)
  const [timeOpen, setTimeOpen] = useState(false)
  const timeRef = useRef<HTMLDivElement>(null)
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
        if (!cancelled) {
          setCustomerResults(results)
          // Results are always cached, but the list only OPENS on its
          // own while the user is actively picking (see the trash /
          // «Cambiar» handlers and suppressAutoOpenRef).
          if (!suppressAutoOpenRef.current && pickerInteractedRef.current) setResultsOpen(true)
        }
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
      setTimeOpen(false)
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

  // Click/tap OUTSIDE closes the floating pieces (customer dropdown,
  // time combo) without touching the rest of the form. The month
  // calendar is a modal and closes itself (backdrop / X / Escape).
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setResultsOpen(false)
        setShowQuickAdd(false)
      }
      if (timeRef.current && !timeRef.current.contains(target)) setTimeOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Trash: the customer was picked by mistake — clear the selection
  // and keep the results list CLOSED. The empty search box stays shut
  // until the user types in it or taps it again (owner's order).
  const removeSelectedCustomer = () => {
    suppressAutoOpenRef.current = true
    setSelectedCustomer(null)
    setCustomerQuery('')
    setShowQuickAdd(false)
    setResultsOpen(false)
  }

  // «Cambiar»: clear the selection and DO deploy the results list, so
  // another customer can be picked right away.
  const changeSelectedCustomer = () => {
    suppressAutoOpenRef.current = false
    setSelectedCustomer(null)
    setCustomerQuery('')
    setShowQuickAdd(false)
    setResultsOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  // Username suggestion with the EXACT convention of /customers/new and
  // the POS (lowercase, accents stripped, first two words joined '_').
  const suggestUsername = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .split('_')
      .filter(Boolean)
      .slice(0, 2)
      .join('_')

  // Creates a customer through the SAME path as /customers/new and the
  // POS quick-add (registerCustomerAction: Auth account + profile role
  // 'customer' + customer_profile). No duplicated creation logic.
  const createCustomerViaOfficialPath = async (fullName: string, phone?: string, email?: string) => {
    const formData = new FormData()
    formData.set('fullName', fullName)
    formData.set('username', email?.trim() ? email.trim() : suggestUsername(fullName))
    if (phone?.trim()) formData.set('phone', phone.trim())
    return registerCustomerAction({ error: null, success: null, customerId: null }, formData)
  }

  const openQuickAdd = () => {
    setQuickName(customerQuery.trim())
    setQuickPhone('')
    setQuickEmail('')
    setQuickError('')
    setShowQuickAdd(true)
    setResultsOpen(true)
  }

  // Quick-add from the picker: create, select the new customer for the
  // appointment and close the panel. Errors stay inside the panel.
  const handleQuickCreateCustomer = async () => {
    const name = quickName.trim()
    if (!name) {
      setQuickError('Escribe el nombre del cliente.')
      return
    }
    setQuickCreating(true)
    setQuickError('')
    try {
      const result = await createCustomerViaOfficialPath(name, quickPhone, quickEmail)
      if (result.error || !result.customerId) {
        setQuickError(result.error || 'No se pudo crear el cliente.')
        return
      }
      const fresh = await searchCustomers(name)
      const created = fresh.find((c: any) => c.id === result.customerId)
      setSelectedCustomer(
        created ?? {
          id: result.customerId,
          full_name: name,
          email: quickEmail.trim() || `${suggestUsername(name)}@opticarayo.com`,
          role: 'customer',
          customer_profiles: { phone: quickPhone.trim() || null },
        }
      )
      setCustomerQuery('')
      setShowQuickAdd(false)
      setResultsOpen(false)
    } catch {
      setQuickError('No se pudo crear el cliente. Inténtalo de nuevo.')
    } finally {
      setQuickCreating(false)
    }
  }

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

  // «Realizada»: la cita se atendió. Es terminal — sale del conteo
  // «en pie» y ya no se puede cancelar. Si la base aún no tiene el
  // estatus (migración 20261119 pendiente), el error real se muestra.
  const handleComplete = async (appt: Appointment) => {
    setActingId(appt.id)
    try {
      const updated = await completeAppointment(appt.id)
      setAppointments(prev => prev.map(a => (a.id === appt.id ? { ...updated, customer_name: a.customer_name, customer_phone: a.customer_phone } : a)))
    } catch (e: any) {
      setDayError(e.message || 'No se pudo marcar la cita como realizada.')
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

  // «En pie» = vivas: ni canceladas ni realizadas (ambas son terminales).
  const liveCount = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'completed').length

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-4xl mx-auto pb-24 md:pb-8 text-left space-y-4 md:space-y-5">
      {/* Header: en móvil solo la etiqueta chiquita (PageHeader) */}
      <PageHeader title="Agenda de Exámenes">
        <header className="anim-fade-up">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7" /> Agenda de Exámenes
          </h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Citas del examen de la vista gratuito: confirma, cancela (con motivo) o agenda por un cliente.
          </p>
        </header>
      </PageHeader>

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
            <article key={appt.id} className={`bg-white border rounded-2xl shadow-sm p-4 ${appt.status === 'cancelled' || appt.status === 'completed' ? 'border-[#cbd5e1]/60 opacity-75' : 'border-[#cbd5e1]'}`}>
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

              {(appt.status === 'pending' || appt.status === 'confirmed') && (
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
                  {/* «Realizada»: solo el administrador (owner /
                      super_admin) la ve y la puede ejecutar. */}
                  {viewerIsAdmin && (
                    <button
                      onClick={() => handleComplete(appt)}
                      disabled={actingId === appt.id}
                      className="inline-flex items-center gap-1.5 bg-[#00357f] hover:bg-[#004aad] active:scale-[0.98] disabled:opacity-50 text-white text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" /> Realizada
                    </button>
                  )}
                  {/* «Realizar examen» (orden del dueño, 2026-11-19): solo
                      cuando la cita trae cliente vinculado; abre el flujo
                      de examen nuevo con ese cliente ya seleccionado.
                      Visible para administrador y optometrista. */}
                  {appt.customer_id && viewerCanStartExam && (
                    <Link
                      href={`/dashboard/exams/new?customer=${appt.customer_id}`}
                      className="inline-flex items-center gap-1.5 bg-[#0899c9] hover:bg-[#0787b3] active:scale-[0.98] text-white text-xs font-black px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4" /> Realizar examen
                    </Link>
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
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={changeSelectedCustomer}
                    className="text-xs font-black text-[#00357f] underline underline-offset-2 cursor-pointer"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectedCustomer}
                    aria-label="Quitar cliente"
                    title="Quitar cliente (si lo seleccionaste mal)"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/70 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              </div>
            ) : (
              <div className="relative mt-1" ref={pickerRef}>
                <Search className="w-4 h-4 text-[#737784] absolute left-3.5 top-[13px]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={customerQuery}
                  onChange={e => {
                    // Typing again re-arms the auto-open (it stays off
                    // only right after the trash button cleared a pick).
                    suppressAutoOpenRef.current = false
                    pickerInteractedRef.current = true
                    setCustomerQuery(e.target.value)
                  }}
                  onFocus={() => {
                    suppressAutoOpenRef.current = false
                    pickerInteractedRef.current = true
                    setResultsOpen(true)
                  }}
                  placeholder="Busca por nombre…"
                  className="w-full border border-[#cbd5e1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
                />
                {/* Quick-add entry: visible before any customer shows up */}
                <button
                  type="button"
                  onClick={openQuickAdd}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-[#00357f] hover:bg-[#dee8ff]/60 px-1.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Agregar cliente nuevo
                </button>

                {resultsOpen && (showQuickAdd || customerResults.length > 0) && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1.5 bg-white border border-[#cbd5e1] rounded-xl shadow-lg max-h-80 overflow-y-auto">
                    {showQuickAdd ? (
                      <div className="p-4 space-y-3 text-left">
                        <p className="text-sm font-bold text-[#00357f]">Agregar cliente nuevo</p>
                        <p className="text-[11px] text-[#737784] font-medium -mt-1.5">
                          Perfil básico, como en el punto de venta; lo demás se completa después en Clientes.
                        </p>
                        <div>
                          <label className="block text-[13px] font-semibold text-[#434653] mb-1">Nombre *</label>
                          <input
                            type="text"
                            value={quickName}
                            onChange={e => setQuickName(e.target.value)}
                            placeholder="Nombre completo del cliente"
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-semibold text-[#434653] mb-1">Teléfono (opcional)</label>
                          <input
                            type="tel"
                            value={quickPhone}
                            onChange={e => setQuickPhone(e.target.value)}
                            placeholder="Ej. (555) 123-4567"
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-semibold text-[#434653] mb-1">Correo (opcional)</label>
                          <input
                            type="email"
                            value={quickEmail}
                            onChange={e => setQuickEmail(e.target.value)}
                            placeholder="cliente@correo.com"
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                        </div>
                        {quickError && (
                          <p className="bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/25 rounded-xl px-3 py-2 text-[13px] font-semibold">
                            {quickError}
                          </p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleQuickCreateCustomer}
                            disabled={quickCreating}
                            className="flex-1 min-h-[44px] bg-[#00357f] hover:bg-[#00509e] text-white text-sm font-bold rounded-xl px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {quickCreating ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creando...
                              </>
                            ) : (
                              'Crear y seleccionar'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowQuickAdd(false); setQuickError('') }}
                            disabled={quickCreating}
                            className="min-h-[44px] bg-white border border-[#dee8ff] text-[#737784] text-sm font-bold rounded-xl px-4 hover:bg-[#dee8ff]/30 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ul>
                        <li>
                          <button
                            type="button"
                            onClick={openQuickAdd}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-[#f0f3ff] text-sm font-bold text-[#00357f] flex items-center gap-2 cursor-pointer border-b border-[#f0f3ff]"
                          >
                            <UserPlus className="w-4 h-4" /> Agregar cliente nuevo
                          </button>
                        </li>
                        {customerResults.map((c: any) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setSelectedCustomer(c); setResultsOpen(false); setShowQuickAdd(false) }}
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
            )}
          </div>

          {/* Day chips (compact) + month calendar modal */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Día</span>
              <button
                type="button"
                onClick={() => setCalendarOpen(v => !v)}
                aria-expanded={calendarOpen}
                className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#00357f] bg-[#dee8ff]/70 hover:bg-[#dee8ff] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer capitalize"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseLocalDate(formDate)).replace(/\./g, '')}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mt-1.5">
              {formDays.map(day => {
                const isSelected = day.iso === formDate
                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={!day.open}
                    onClick={() => setFormDate(day.iso)}
                    className={`rounded-lg border px-0.5 py-1.5 text-center transition-all ${
                      !day.open
                        ? 'border-[#cbd5e1]/40 bg-[#f0f3ff]/50 text-[#737784]/50 cursor-not-allowed'
                        : isSelected
                          ? 'border-[#00357f] bg-[#00357f] text-white shadow-md shadow-[#00357f]/25 active:scale-[0.97]'
                          : 'border-[#cbd5e1] bg-white hover:bg-[#f0f3ff] text-[#111c2d] active:scale-[0.97] cursor-pointer'
                    }`}
                  >
                    <span className={`block text-[8px] font-black uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-[#737784]'}`}>
                      {new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(day.date).replace('.', '')}
                    </span>
                    <span className="block text-sm font-black leading-tight">{day.date.getDate()}</span>
                    <span className={`block text-[8px] font-bold ${isSelected ? 'text-white/80' : 'text-[#737784]'}`}>
                      {day.open ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(day.date).replace('.', '') : 'Cerrado'}
                    </span>
                  </button>
                )
              })}
            </div>

            {calendarOpen && (
              <AppointmentCalendar
                selectedISO={formDate}
                todayISO={todayISO}
                openDays={openDays}
                onSelect={iso => { setFormDate(iso); setCalendarOpen(false) }}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </div>

          {/* Time combo: every slot of the day in one dropdown list;
              occupied ones are shown disabled, only free ones pick. */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#737784]">Hora</span>
            <div className="relative mt-1.5" ref={timeRef}>
              <button
                type="button"
                disabled={loadingFormSlots}
                onClick={() => setTimeOpen(v => !v)}
                aria-expanded={timeOpen}
                aria-haspopup="listbox"
                className="w-full flex items-center justify-between gap-2 border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#111c2d] bg-white hover:bg-[#f0f3ff] focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className={formTime ? '' : 'text-[#737784] font-medium'}>
                  {loadingFormSlots
                    ? 'Cargando horarios…'
                    : formTime
                      ? formatAppointmentTime(formTime)
                      : 'Elige una hora'}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#737784] transition-transform ${timeOpen ? 'rotate-180' : ''}`} />
              </button>
              {timeOpen && !loadingFormSlots && (
                <ul
                  role="listbox"
                  className="absolute z-20 left-0 right-0 top-full mt-1.5 bg-white border border-[#cbd5e1] rounded-xl shadow-xl max-h-64 overflow-y-auto py-1"
                >
                  {formSlots.length === 0 ? (
                    <li className="px-3.5 py-2.5 text-sm text-[#737784] font-medium">
                      Este día no se trabaja.
                    </li>
                  ) : (
                    formSlots.map(slot => {
                      const isSelected = slot.time === formTime
                      return (
                        <li key={slot.time}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={!slot.available}
                            onClick={() => { setFormTime(slot.time); setTimeOpen(false) }}
                            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors ${
                              !slot.available
                                ? 'text-[#737784]/60 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-[#dee8ff] text-[#00357f] font-extrabold cursor-pointer'
                                  : 'text-[#111c2d] font-semibold hover:bg-[#f0f3ff] cursor-pointer'
                            }`}
                          >
                            <span>{formatAppointmentTime(slot.time)}</span>
                            {!slot.available ? (
                              <span className="text-[9px] font-black uppercase tracking-wider text-[#ba1a1a] bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                Ocupada
                              </span>
                            ) : isSelected ? (
                              <Check className="w-4 h-4 text-[#00357f]" />
                            ) : null}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              )}
            </div>
            {!loadingFormSlots && formSlots.filter(s => s.available).length === 0 && (
              <p className="text-sm text-[#737784] font-medium mt-2">No quedan horarios libres este día.</p>
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
                ? 'text-[#15803d] bg-[#dcfce7]/60 border-[#bbf7d0]'
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
