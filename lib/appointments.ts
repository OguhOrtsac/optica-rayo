import { createClient as createBrowserClient } from '@/utils/supabase/client'

/**
 * Appointments service — agenda de exámenes de la vista gratuitos.
 *
 * Data layer for the booking module (migration 20261109_appointments):
 *  - Public booking page: /agendar
 *  - Staff agenda:        /dashboard/appointments
 *  - Customer panel:      «Mis citas» in /dashboard/customer
 *
 * Honesty rule for this module: NO mock fallbacks. When the database is
 * configured, a failure is a real error and is thrown; the screens show
 * an error state instead of invented appointments. (The staff
 * notification for a new booking lives in the database trigger
 * `notify_new_appointment`: an anonymous guest cannot insert other
 * people's notifications under RLS, so the trigger is the only way the
 * avisos work for guests — same pattern as lens requests.)
 */

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled'
export type AppointmentCreator = 'customer' | 'admin' | 'guest'
export type AppointmentCanceller = 'customer' | 'admin'

export interface Appointment {
  id: string
  customer_id: string | null
  guest_name: string | null
  guest_phone: string | null
  /** 'YYYY-MM-DD' */
  scheduled_date: string
  /** 'HH:MM' (normalized; Postgres may return 'HH:MM:SS') */
  scheduled_time: string
  status: AppointmentStatus
  created_by: AppointmentCreator
  cancel_reason: string | null
  cancelled_by: AppointmentCanceller | null
  notes: string | null
  created_at: string
  updated_at: string
  /** Hydrated for staff/customer lists (not a table column). */
  customer_name?: string | null
  customer_phone?: string | null
}

export interface DaySlot {
  /** 'HH:MM' */
  time: string
  available: boolean
}

export interface AgendaSettings {
  /** 'HH:MM' */
  start: string
  /** 'HH:MM' */
  end: string
  slotMinutes: number
  /** 1 = lunes … 7 = domingo */
  openDays: number[]
}

const DEFAULT_AGENDA_SETTINGS: AgendaSettings = {
  start: '10:00',
  end: '19:00',
  slotMinutes: 30,
  openDays: [1, 2, 3, 4, 5, 6],
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder') && !key.includes('placeholder')
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('La agenda no está disponible en este momento. Inténtalo más tarde o contáctanos directamente.')
  }
  return createBrowserClient()
}

/** 'HH:MM:SS' -> 'HH:MM' */
function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

function timeToMinutes(value: string): number {
  const [h, m] = normalizeTime(value).split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Parses 'YYYY-MM-DD' as a LOCAL date (avoids the UTC day-shift bug). */
export function parseLocalDate(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Date -> 'YYYY-MM-DD' in local time. */
export function toLocalDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** JS getDay() (0=domingo) -> agenda day number (1=lunes … 7=domingo). */
export function agendaDayNumber(date: Date): number {
  const jsDay = date.getDay()
  return jsDay === 0 ? 7 : jsDay
}

/** 'lunes 10 de noviembre de 2026' */
export function formatAppointmentDate(dateISO: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseLocalDate(dateISO))
}

/** '10:30' -> '10:30 a. m.' */
export function formatAppointmentTime(time: string): string {
  const [hRaw, mRaw] = normalizeTime(time).split(':')
  const h = Number(hRaw)
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mRaw ?? '00'} ${suffix}`
}

function normalizeAppointment(row: any): Appointment {
  return {
    ...row,
    scheduled_time: normalizeTime(row.scheduled_time),
  } as Appointment
}

function friendlyInsertError(error: any): Error {
  // 23505 = unique_violation: the partial unique index caught a double
  // booking (two people racing for the same slot).
  if (error?.code === '23505') {
    return new Error('Ese horario acaba de ser apartado por otra persona. Elige otro horario, por favor.')
  }
  return new Error(error?.message || 'No se pudo registrar la cita.')
}

/**
 * Reads the agenda schedule (agenda_* keys in app_settings). When a key
 * is missing or unreadable, the owner's defaults apply (10:00–19:00,
 * 30-minute slots, lunes a sábado) — configuration defaults, not data.
 */
export async function getAgendaSettings(): Promise<AgendaSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_AGENDA_SETTINGS
  try {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['agenda_start', 'agenda_end', 'agenda_slot_minutes', 'agenda_open_days'])
    if (error || !data) return DEFAULT_AGENDA_SETTINGS

    const map = new Map<string, string>(data.map((r: any) => [r.key, r.value]))
    const slotMinutes = parseInt(map.get('agenda_slot_minutes') ?? '', 10)
    const openDays = (map.get('agenda_open_days') ?? '')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 7)

    return {
      start: map.get('agenda_start') || DEFAULT_AGENDA_SETTINGS.start,
      end: map.get('agenda_end') || DEFAULT_AGENDA_SETTINGS.end,
      slotMinutes: Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : DEFAULT_AGENDA_SETTINGS.slotMinutes,
      openDays: openDays.length > 0 ? openDays : DEFAULT_AGENDA_SETTINGS.openDays,
    }
  } catch {
    return DEFAULT_AGENDA_SETTINGS
  }
}

/**
 * Booked times ('HH:MM') for a day, via the get_booked_slots RPC — the
 * only occupancy data the public may see (no names or phones leak).
 */
export async function getBookedTimes(dateISO: string): Promise<string[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('get_booked_slots', { p_date: dateISO })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => normalizeTime(r.scheduled_time))
}

/**
 * All slots for a day with availability. A closed day (not in
 * agenda_open_days, e.g. Sunday) returns an empty array.
 */
export async function getDaySlots(dateISO: string): Promise<DaySlot[]> {
  const settings = await getAgendaSettings()
  const date = parseLocalDate(dateISO)
  if (!settings.openDays.includes(agendaDayNumber(date))) return []

  const booked = new Set(await getBookedTimes(dateISO))
  const start = timeToMinutes(settings.start)
  const end = timeToMinutes(settings.end)

  const slots: DaySlot[] = []
  for (let t = start; t + settings.slotMinutes <= end; t += settings.slotMinutes) {
    const time = minutesToTime(t)
    slots.push({ time, available: !booked.has(time) })
  }
  return slots
}

export interface CreateAppointmentInput {
  /** 'YYYY-MM-DD' */
  date: string
  /** 'HH:MM' */
  time: string
  name: string
  phone: string
  notes?: string
  /** Logged-in customer's profile id; omit/null for guests. */
  customerId?: string | null
}

/**
 * Creates a booking in 'pending' status (pendiente de confirmación).
 * Guests book with name + phone; a logged-in customer is linked via
 * customerId. The staff notification is inserted by the database
 * trigger `notify_new_appointment` («Nueva cita de examen: {nombre},
 * {fecha} {hora}» para cada miembro del staff).
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const supabase = requireSupabase()
  const row = {
    customer_id: input.customerId ?? null,
    guest_name: input.name.trim(),
    guest_phone: input.phone.trim(),
    scheduled_date: input.date,
    scheduled_time: input.time,
    status: 'pending',
    created_by: input.customerId ? 'customer' : 'guest',
    notes: input.notes?.trim() || null,
  }

  // A logged-in customer can read their own rows back, so the insert can
  // return the stored appointment.
  if (input.customerId) {
    const { data, error } = await supabase
      .from('appointments')
      .insert([row])
      .select('*')
      .single()
    if (error) throw friendlyInsertError(error)
    return normalizeAppointment(data)
  }

  // A guest has INSERT permission but NO select policy on appointments
  // (by design: nobody anonymous may read other people's bookings), so a
  // `.select()` read-back would be rejected by RLS even though the write
  // succeeded — verified live at integration. Insert minimal and answer
  // with the booking just made; the confirmation screen shows the input.
  const { error } = await supabase.from('appointments').insert([row])
  if (error) throw friendlyInsertError(error)
  return normalizeAppointment({
    id: '',
    ...row,
    cancel_reason: null,
    cancelled_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}

/**
 * Staff-side booking for a registered customer: it is the admin's own
 * reminder, so it is born 'confirmed'.
 */
export async function createAppointmentByAdmin(
  customerId: string,
  date: string,
  time: string,
  notes?: string
): Promise<Appointment> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .insert([{
      customer_id: customerId,
      scheduled_date: date,
      scheduled_time: time,
      status: 'confirmed',
      created_by: 'admin',
      notes: notes?.trim() || null,
    }])
    .select('*')
    .single()

  if (error) throw friendlyInsertError(error)
  return normalizeAppointment(data)
}

/** All appointments of one customer, most recent first. */
export async function listAppointmentsForCustomer(customerId: string): Promise<Appointment[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('customer_id', customerId)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeAppointment)
}

/**
 * The staff agenda for one day (including cancelled ones, so nothing
 * disappears without a trace), with customer name/phone hydrated.
 */
export async function listAppointmentsForDay(dateISO: string): Promise<Appointment[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('scheduled_date', dateISO)
    .order('scheduled_time', { ascending: true })

  if (error) throw new Error(error.message)
  const appointments: Appointment[] = (data ?? []).map(normalizeAppointment)

  const customerIds = [...new Set(appointments.map(a => a.customer_id).filter(Boolean))] as string[]
  if (customerIds.length === 0) return appointments

  const [{ data: profiles }, { data: customerProfiles }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', customerIds),
    supabase.from('customer_profiles').select('id, phone').in('id', customerIds),
  ])

  const nameById = new Map<string, string | null>((profiles ?? []).map((p: any) => [p.id, p.full_name]))
  const phoneById = new Map<string, string | null>((customerProfiles ?? []).map((p: any) => [p.id, p.phone]))

  return appointments.map(a => ({
    ...a,
    customer_name: a.customer_id ? (nameById.get(a.customer_id) ?? a.guest_name) : a.guest_name,
    customer_phone: a.customer_id ? (phoneById.get(a.customer_id) ?? a.guest_phone) : a.guest_phone,
  }))
}

/** Marks a booking as confirmed (staff). */
export async function confirmAppointment(id: string): Promise<Appointment> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return normalizeAppointment(data)
}

/**
 * Cancels a booking, storing the reason and who cancelled. The reason
 * is shown to the customer verbatim in their panel.
 */
export async function cancelAppointment(
  id: string,
  reason: string | null,
  actor: AppointmentCanceller
): Promise<Appointment> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancel_reason: reason?.trim() || null,
      cancelled_by: actor,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return normalizeAppointment(data)
}

/**
 * Contact prefill for the public booking page when a customer is
 * logged in: their profile id, name and phone (or null for guests).
 */
export async function getMyContactPrefill(): Promise<{ id: string; name: string; phone: string } | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = createBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: customerProfile }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('customer_profiles').select('phone').eq('id', user.id).maybeSingle(),
  ])

  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || '',
    phone: customerProfile?.phone || '',
  }
}
