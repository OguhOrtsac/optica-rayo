'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, Check, Copy, Lock, Save } from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import PageHeader from '@/components/page-header'
import {
  AGENDA_DAY_KEYS,
  AGENDA_DAY_LABELS,
  getAgendaSchedule,
  saveAgendaSchedule,
  type AgendaDayKey,
  type AgendaSchedule,
} from '@/lib/appointments'

// «Configurar horario» — días de atención y horarios (owner's order,
// 2026-11-18). The REAL opening-hours configuration of the shop:
// PER DAY, not one global schedule. Each of the 7 days has its own
// «Se trabaja» switch and its own open/close (a Saturday may close
// earlier than a Monday). Everything is stored as ONE structured
// setting (`agenda_schedule` in app_settings, see lib/appointments)
// and drives BOTH the staff agenda and the public /agendar page:
// a day that is not worked offers no slots; a worked day offers slots
// from its open to its close every slot_minutes.
//
// Administrator-only (owner / super_admin), same gate as Mensajes and
// Gastos: the seller sells; the owner sets the hours. The hand-typed
// «Horario» text of Datos de la óptica no longer exists — that field
// now shows the summary generated from this very configuration.

export default function HorarioPage() {
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<AgendaSchedule | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadError(null)
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setCanManage(false)
          return
        }

        // Authoritative role: the profiles row (same source the RLS
        // helper get_my_role() reads), with user_metadata as fallback.
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
        const role = normalizeRole(roleValue)
        const allowed = role === 'owner' || role === 'super_admin'
        setCanManage(allowed)
        if (allowed) {
          setSchedule(await getAgendaSchedule())
        }
      } catch (err: any) {
        console.error('Error loading agenda schedule:', err)
        setLoadError(err?.message || 'No se pudo cargar el horario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const updateDay = (key: AgendaDayKey, patch: Partial<AgendaSchedule['days'][AgendaDayKey]>) => {
    setSaved(false)
    setSaveError(null)
    setSchedule(prev =>
      prev ? { ...prev, days: { ...prev.days, [key]: { ...prev.days[key], ...patch } } } : prev
    )
  }

  const copyDayToAll = (key: AgendaDayKey) => {
    setSaved(false)
    setSaveError(null)
    setSchedule(prev => {
      if (!prev) return prev
      const source = prev.days[key]
      const days = Object.fromEntries(
        AGENDA_DAY_KEYS.map(k => [k, { ...source }])
      ) as AgendaSchedule['days']
      return { ...prev, days }
    })
  }

  const handleSave = async () => {
    if (!schedule) return
    // A worked day whose close is not after its open makes no sense and
    // would offer no slots; say so plainly instead of saving silence.
    for (const key of AGENDA_DAY_KEYS) {
      const day = schedule.days[key]
      if (day.enabled && day.close <= day.open) {
        setSaveError(`En ${AGENDA_DAY_LABELS[key]} la hora de cierre debe ser después de la de apertura.`)
        return
      }
    }
    if (!Number.isFinite(schedule.slotMinutes) || schedule.slotMinutes <= 0) {
      setSaveError('El intervalo entre citas debe ser un número de minutos mayor a cero.')
      return
    }
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      await saveAgendaSchedule(schedule)
      setSaved(true)
    } catch (err: any) {
      setSaveError(err?.message || 'No se pudo guardar el horario.')
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <PageHeader
      title="Configurar horario"
      mobileActions={
        <Link
          href="/dashboard/admin"
          aria-label="Volver al panel"
          className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
      }
    >
      <div className="flex items-center gap-2.5 border-b border-[#e7eeff] pb-3">
        <Link
          href="/dashboard/admin"
          aria-label="Volver al panel"
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
          <CalendarClock className="w-4.5 h-4.5" />
        </span>
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Configurar horario</h1>
          <p className="text-xs text-[#434653] font-medium">
            Días de atención y horarios: de aquí salen las horas de la agenda y de las citas en línea.
          </p>
        </div>
      </div>
    </PageHeader>
  )

  if (loading) {
    return (
      <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
        {header}
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando horario…</p>
        </div>
      </main>
    )
  }

  if (!canManage) {
    return (
      <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
        {header}
        <div className="mt-4 md:mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              El horario de atención lo configura <strong>solo el administrador</strong> (dueño).
              Si necesitas cambiar un horario, pídelo al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const inputClasses =
    'border border-[#cbd5e1] rounded-lg px-2.5 py-2 text-sm font-bold text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white disabled:opacity-40 disabled:bg-[#f0f3ff]'

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {loadError && (
        <p role="alert" className="mt-4 md:mt-6 text-sm text-[#ba1a1a] font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {loadError}
        </p>
      )}

      {schedule && (
        <div className="mt-4 md:mt-6 space-y-4">
          <section className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5 space-y-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f]">Días de atención</h2>
            <p className="text-xs text-[#737784] font-medium leading-relaxed">
              Cada día tiene su propio horario: enciende «Se trabaja» y ajusta apertura y cierre.
              Un día apagado no ofrece citas, ni en la agenda del personal ni en la página pública.
            </p>

            <ul className="divide-y divide-[#f0f3ff]">
              {AGENDA_DAY_KEYS.map(key => {
                const day = schedule.days[key]
                return (
                  <li key={key} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="w-24 shrink-0 text-sm font-extrabold text-[#111c2d]">
                      {AGENDA_DAY_LABELS[key]}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={day.enabled}
                      aria-label={`Se trabaja el ${AGENDA_DAY_LABELS[key]}`}
                      onClick={() => updateDay(key, { enabled: !day.enabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                        day.enabled ? 'bg-[#00357f]' : 'bg-[#cbd5e1]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          day.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-bold w-16 ${day.enabled ? 'text-[#00422b]' : 'text-[#737784]'}`}>
                      {day.enabled ? 'Se trabaja' : 'Cerrado'}
                    </span>
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">Apertura del {AGENDA_DAY_LABELS[key]}</span>
                      <input
                        type="time"
                        value={day.open}
                        disabled={!day.enabled}
                        onChange={e => updateDay(key, { open: e.target.value })}
                        className={inputClasses}
                      />
                    </label>
                    <span className="text-[#737784] font-bold" aria-hidden="true">–</span>
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">Cierre del {AGENDA_DAY_LABELS[key]}</span>
                      <input
                        type="time"
                        value={day.close}
                        disabled={!day.enabled}
                        onChange={e => updateDay(key, { close: e.target.value })}
                        className={inputClasses}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => copyDayToAll(key)}
                      title={`Copiar el horario del ${AGENDA_DAY_LABELS[key]} a todos los días`}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-[#00357f] hover:bg-[#dee8ff]/60 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar a todos
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f]">Intervalo entre citas</h2>
                <p className="text-xs text-[#737784] font-medium mt-1 leading-relaxed">
                  Cada cuántos minutos empieza una cita (ej. 30 = citas a las 10:00, 10:30, 11:00…).
                </p>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={schedule.slotMinutes}
                  onChange={e => {
                    setSaved(false)
                    setSaveError(null)
                    setSchedule({ ...schedule, slotMinutes: Number(e.target.value) })
                  }}
                  className={`${inputClasses} w-24 text-center`}
                />
                <span className="text-sm font-bold text-[#434653]">min</span>
              </label>
            </div>
          </section>

          {saveError && (
            <p role="alert" className="text-sm text-[#ba1a1a] font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {saveError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[#00357f] hover:bg-[#004aad] active:scale-[0.99] disabled:opacity-50 text-white font-black py-2.5 px-6 rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-[#00357f]/20"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Guardar horario
                </>
              )}
            </button>
            {saved && !saving && (
              <span role="status" className="flex items-center gap-1.5 text-xs font-bold text-[#00422b]">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
