'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, RefreshCw, Scale } from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getCashUtility, type CashUtility } from '@/lib/services'
import PageHeader from '@/components/page-header'
import DateRangePicker from '@/components/date-range-picker'

// Utilidad (Finanzas): la utilidad de CAJA del dueño para un rango
// con calendario — ingresos (lo que entró) menos pagos (lo que
// salió), con los adeudos generados a la vista. Solo administrador;
// cifras de getCashUtility (base real) y un fallo se muestra como
// error, nunca como números inventados.

type Preset = 'hoy' | 'semana' | 'mes' | 'personalizado'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'personalizado', label: 'Personalizado' },
]

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
}

function presetRange(preset: Exclude<Preset, 'personalizado'>): { start: string; end: string } {
  const today = new Date()
  if (preset === 'hoy') {
    const iso = toISODate(today)
    return { start: iso, end: iso }
  }
  if (preset === 'semana') {
    const monday = addDays(today, -((today.getDay() + 6) % 7))
    return { start: toISODate(monday), end: toISODate(addDays(monday, 6)) }
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { start: toISODate(first), end: toISODate(last) }
}

function formatDayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function rangeLabel(start: string, end: string): string {
  const dayCount =
    Math.round((parseISODate(end).getTime() - parseISODate(start).getTime()) / 86400000) + 1
  const endFull = parseISODate(end).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `Del ${formatDayShort(start)} al ${endFull} · ${dayCount} ${dayCount === 1 ? 'día' : 'días'}`
}

export default function FinanzasUtilidadPage() {
  const [gateLoading, setGateLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)

  const [preset, setPreset] = useState<Preset>('mes')
  const initialRange = presetRange('mes')
  const [range, setRange] = useState<{ start: string; end: string }>(initialRange)
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  })

  const [utility, setUtility] = useState<CashUtility | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      setUtility(await getCashUtility(start, end))
    } catch (err: any) {
      console.error('Error loading cash utility:', err)
      setUtility(null)
      setLoadError(err?.message || 'No se pudo calcular la utilidad.')
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
        if (allowed) await load(initialRange.start, initialRange.end)
      } catch (err) {
        console.error('Error loading finanzas utilidad:', err)
      } finally {
        setGateLoading(false)
      }
    }
    init()
    // initialRange is computed once from the initial preset ('mes').
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const applyPreset = (next: Preset) => {
    setPreset(next)
    if (next !== 'personalizado') {
      const r = presetRange(next)
      setRange(r)
      void load(r.start, r.end)
    }
  }

  const handleCustomRange = (start: string, end: string) => {
    setCustomRange({ start, end })
    setRange({ start, end })
    void load(start, end)
  }

  const header = (
    <PageHeader
      title="Utilidad"
      mobileActions={
        <Link href="/dashboard/admin" aria-label="Volver al panel" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
      }
    >
      <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
        <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
          <Scale className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Utilidad</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Lo que entró a caja menos lo que se pagó, en el periodo que elijas.
          </p>
        </div>
      </div>
    </PageHeader>
  )

  if (gateLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando utilidad…</p>
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

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {/* Period presets */}
      <section aria-label="Periodo" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              aria-pressed={preset === p.id}
              className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-extrabold border transition-colors cursor-pointer ${
                preset === p.id
                  ? 'bg-[#00357f] text-white border-[#00357f]'
                  : 'bg-white text-[#00357f] border-[#cbd5e1] hover:bg-[#dee8ff]/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-sm font-bold text-[#111c2d]" role="status">
          {rangeLabel(range.start, range.end)}
        </p>

        {preset === 'personalizado' && (
          <div className="bg-white rounded-[20px] or-shadow-card p-4 max-w-md">
            <DateRangePicker
              start={customRange.start}
              end={customRange.end}
              onChange={handleCustomRange}
            />
          </div>
        )}
      </section>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Calculando la utilidad…</p>
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-[20px] p-6 space-y-3">
          <h2 className="text-base font-bold text-[#93000a]">No se pudo calcular la utilidad</h2>
          <p className="text-sm text-[#93000a]/80 leading-relaxed">{loadError}</p>
          <button
            onClick={() => void load(range.start, range.end)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      {!loading && !loadError && utility && (
        <section aria-label="Cifras del periodo" className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="bg-white rounded-[20px] or-shadow-card p-3.5 sm:p-4 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Ingresos</p>
            <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#00422b] mt-1 tabular-nums whitespace-nowrap">{money.format(utility.income)}</p>
            <p className="text-xs text-[#434653] font-semibold mt-1 tabular-nums">
              Pagos al vender {money.format(utility.incomeFromSales)} · Abonos recibidos {money.format(utility.incomeFromInstallments)}
            </p>
          </div>
          <div className="bg-white rounded-[20px] or-shadow-card p-3.5 sm:p-4 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Pagos</p>
            <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#ba1a1a] mt-1 tabular-nums whitespace-nowrap">{money.format(utility.payments)}</p>
            <p className="text-xs text-[#434653] font-semibold mt-1 tabular-nums">
              Gastos del día {money.format(utility.dailyExpensesTotal)} · Fijos prorrateados {money.format(utility.fixedProrated)} (de {money.format(utility.fixedMonthlyTotal)} al mes)
            </p>
          </div>
          <div className="bg-white rounded-[20px] or-shadow-card p-3.5 sm:p-4 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Adeudos generados</p>
            <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#92400e] mt-1 tabular-nums whitespace-nowrap">{money.format(utility.debtsGenerated)}</p>
            <p className="text-xs text-[#434653] font-semibold mt-1">
              Lo vendido en el periodo que quedó en pagos diferidos (saldo pendiente de esas ventas).
            </p>
          </div>
          <div
            className={`rounded-[20px] or-shadow-card p-3.5 sm:p-4 min-w-0 ${
              utility.utility >= 0 ? 'bg-[#e2f9ee]' : 'bg-[#ffdad6]'
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider ${utility.utility >= 0 ? 'text-[#00422b]' : 'text-[#ba1a1a]'}`}>
              Utilidad del periodo
            </p>
            <p className={`text-lg sm:text-xl md:text-2xl font-extrabold mt-1 tabular-nums whitespace-nowrap ${utility.utility >= 0 ? 'text-[#00422b]' : 'text-[#93000a]'}`}>
              {money.format(utility.utility)}
            </p>
            <p className={`text-xs font-semibold mt-1 ${utility.utility >= 0 ? 'text-[#00422b]/75' : 'text-[#93000a]/75'}`}>
              Ingresos menos pagos, con criterio de caja.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
