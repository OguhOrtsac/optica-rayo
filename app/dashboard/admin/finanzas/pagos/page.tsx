'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Lock,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import {
  ensureFixedPaymentNotifications,
  fixedPaymentState,
  getFixedExpenses,
  nextDueDate,
  registerFixedPayment,
  type FixedExpense,
  type FixedPaymentState,
} from '@/lib/expenses'

// Pagos fijos (Finanzas): renta, luz, agua… con su próxima fecha,
// su estado y el botón para registrar el pago (crea el gasto del
// día y sella la fecha). Solo administrador. Si la migración de
// vencimientos (20261118) aún no está aplicada en la base, la
// página lo dice con un aviso y muestra los fijos sin fechas en
// vez de romperse.

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

const PERIODICITY_LABEL: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const STATE_META: Record<FixedPaymentState, { label: string; chip: string }> = {
  al_corriente: { label: 'Al corriente', chip: 'bg-[#e2f9ee] text-[#00422b]' },
  por_vencer: { label: 'Por vencer', chip: 'bg-[#fef3c7] text-[#92400e]' },
  vencido: { label: 'Vencido', chip: 'bg-[#ffdad6] text-[#ba1a1a]' },
}

function formatDueLabel(due: Date): string {
  const today = new Date()
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((midnight(due) - midnight(today)) / 86_400_000)
  const friendly = due.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (days === 0) return `${friendly} · hoy`
  if (days === 1) return `${friendly} · mañana`
  if (days > 1) return `${friendly} · en ${days} días`
  if (days === -1) return `${friendly} · ayer`
  return `${friendly} · hace ${Math.abs(days)} días`
}

export default function FinanzasPagosPage() {
  const [gateLoading, setGateLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)
  const [fixedList, setFixedList] = useState<FixedExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const supabase = createBrowserClient()
      // Probe: the due columns arrive with migration 20261118.
      const probe = await supabase.from('fixed_expenses').select('due_day, last_paid_on').limit(1)
      const missing = !!probe.error
      setMigrationMissing(missing)
      setFixedList(await getFixedExpenses())
      if (!missing) {
        // Bell alerts for what is due (deduplicated per cycle).
        void ensureFixedPaymentNotifications().catch(err =>
          console.error('Fixed payment notifications failed:', err),
        )
      }
    } catch (err: any) {
      console.error('Error loading fixed payments:', err)
      setLoadError(err?.message || 'No se pudieron leer los pagos fijos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCanAccess(false)
          return
        }
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
        setCanAccess(allowed)
        if (allowed) await load()
      } catch (err) {
        console.error('Error loading finanzas pagos:', err)
      } finally {
        setGateLoading(false)
      }
    }
    init()
  }, [load])

  const handleRegisterPayment = async (fixed: FixedExpense) => {
    try {
      setBusyId(fixed.id)
      setFeedbackMsg(null)
      await registerFixedPayment(fixed.id)
      setFeedbackMsg({
        type: 'success',
        text: `Pago registrado: ${fixed.concept} por ${money.format(fixed.amount)}. Quedó en los gastos de hoy.`,
      })
      await load()
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'No se pudo registrar el pago.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const header = (
    <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
      <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
        <ArrowLeft className="w-4.5 h-4.5" />
      </Link>
      <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
        <BellRing className="w-5 h-5" />
      </span>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Pagos fijos</h1>
        <p className="text-sm text-[#434653] mt-1 font-medium">
          Renta, luz, agua y demás pagos que se repiten: cuándo tocan y registrarlos al pagar.
        </p>
      </div>
    </div>
  )

  if (gateLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando pagos fijos…</p>
        </div>
      </main>
    )
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
        {header}
        <div className="mt-6 bg-white rounded-[20px] or-shadow-card p-6 flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Las finanzas las ve <strong>solo el administrador</strong> (dueño). Si necesitas una cifra, pídela al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const today = new Date()

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {feedbackMsg && (
        <p
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-4 py-3 text-xs font-bold border ${
            feedbackMsg.type === 'error'
              ? 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/20'
              : 'bg-[#e2f9ee] text-[#00422b] border-[#00422b]/15'
          }`}
        >
          {feedbackMsg.text}
        </p>
      )}

      {migrationMissing && (
        <div role="alert" className="bg-[#fef3c7] border border-[#92400e]/25 rounded-[20px] p-5">
          <h2 className="text-sm font-bold text-[#92400e]">Falta una actualización de la base de datos</h2>
          <p className="text-sm text-[#92400e]/85 leading-relaxed mt-1">
            Los pagos fijos todavía no tienen fechas de vencimiento en la base (migración
            «20261118_fixed_expenses_due»). Mientras se aplica, aquí se muestran los pagos fijos
            sin próxima fecha ni avisos; en cuanto se aplique, esta pantalla mostrará cuándo
            toca cada pago y permitirá registrarlo.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Leyendo los pagos fijos…</p>
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-[20px] p-6 space-y-3">
          <h2 className="text-base font-bold text-[#93000a]">No se pudieron cargar los pagos fijos</h2>
          <p className="text-sm text-[#93000a]/80 leading-relaxed">{loadError}</p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#111c2d]">Pagos que se repiten</h2>
            <Link
              href="/dashboard/admin/expenses"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#cbd5e1] text-[#00357f] text-xs font-bold hover:bg-[#dee8ff]/40 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
              Editar en Gastos
            </Link>
          </div>

          {fixedList.length === 0 ? (
            <div className="bg-white rounded-[20px] or-shadow-card p-8 text-center space-y-3">
              <BellRing className="w-8 h-8 text-[#0899c9] mx-auto" />
              <p className="text-sm font-bold text-[#111c2d]">Sin pagos fijos registrados</p>
              <p className="text-xs text-[#434653] font-medium">
                Registra la renta, la luz o el agua en Gastos → Fijos y aquí verás cuándo toca cada pago.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] or-shadow-card overflow-hidden divide-y divide-[#f0f3ff]">
              {fixedList.map(fixed => {
                const state = fixedPaymentState(fixed, today)
                const meta = STATE_META[state]
                const due = nextDueDate(fixed, today)
                return (
                  <div key={fixed.id} className={`px-5 py-4 ${fixed.is_active ? '' : 'opacity-60'}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <p className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#111c2d]">{fixed.concept}</span>
                          {!fixed.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#f0f3ff] text-[#737784]">
                              Pausado
                            </span>
                          ) : !migrationMissing ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.chip}`}>
                              {meta.label}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-[#434653] font-medium mt-0.5">
                          {PERIODICITY_LABEL[fixed.periodicity] ?? fixed.periodicity}
                          {fixed.last_paid_on && (
                            <> · Último pago: {parseLabelDate(fixed.last_paid_on)}</>
                          )}
                        </p>
                        {!migrationMissing && fixed.is_active && (
                          <p className="text-xs text-[#737784] font-semibold mt-0.5 capitalize">
                            Próximo pago: {formatDueLabel(due)}
                          </p>
                        )}
                      </div>
                      <p className="text-base font-extrabold text-[#111c2d] tabular-nums shrink-0">{money.format(fixed.amount)}</p>
                    </div>
                    {fixed.is_active && !migrationMissing && (
                      <button
                        onClick={() => void handleRegisterPayment(fixed)}
                        disabled={busyId === fixed.id}
                        className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#00422b] hover:bg-[#00331f] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {busyId === fixed.id ? 'Registrando…' : 'Registrar pago'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[11px] text-[#737784] font-semibold px-1">
            Al registrar un pago se crea el gasto de hoy por el mismo monto y la fecha queda sellada;
            los avisos llegan a la campanita cuando un pago está por vencer (3 días antes) o vencido.
            Los montos y días de pago se editan en Gastos → Fijos.
          </p>
        </>
      )}
    </main>
  )
}

function parseLabelDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
