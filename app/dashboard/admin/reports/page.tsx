'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getPeriodReport, type PeriodReport } from '@/lib/expenses'
import DateRangePicker from '@/components/date-range-picker'

// Reports are administrator territory (owner / super_admin), same gate
// as Promotions: period sales, daily expenses, prorated fixed expenses
// and profit. Figures come ONLY from getPeriodReport (real database
// reads); on error the page shows a real error card with a retry —
// never invented numbers.

type Preset = 'hoy' | 'semana' | 'mes' | 'personalizado'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'personalizado', label: 'Personalizado' },
]

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
    // Monday..Sunday of the current week (week starts Monday).
    const monday = addDays(today, -((today.getDay() + 6) % 7))
    return { start: toISODate(monday), end: toISODate(addDays(monday, 6)) }
  }
  // Este mes: 1st..last day of the current month.
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { start: toISODate(first), end: toISODate(last) }
}

function formatDayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function formatDayFull(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function rangeLabel(start: string, end: string): string {
  const dayCount =
    Math.round((parseISODate(end).getTime() - parseISODate(start).getTime()) / 86400000) + 1
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const endFull = parseISODate(end).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const startLabel = sameYear
    ? formatDayShort(start)
    : parseISODate(start).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
  return `Del ${startLabel} al ${endFull} · ${dayCount} ${dayCount === 1 ? 'día' : 'días'}`
}

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

export default function AdminReportsPage() {
  const [gateLoading, setGateLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)

  const [preset, setPreset] = useState<Preset>('mes')
  const initialRange = presetRange('mes')
  const [range, setRange] = useState<{ start: string; end: string }>(initialRange)
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  })

  const [report, setReport] = useState<PeriodReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(false)

  const loadReport = useCallback(async (start: string, end: string) => {
    setReportLoading(true)
    setReportError(false)
    try {
      setReport(await getPeriodReport(start, end))
    } catch (err) {
      console.error('Error loading period report:', err)
      setReport(null)
      setReportError(true)
    } finally {
      setReportLoading(false)
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
        setCanAccess(allowed)
        if (allowed) {
          // Default view on entry: Este mes.
          await loadReport(initialRange.start, initialRange.end)
        }
      } catch (err) {
        console.error('Error loading reports admin:', err)
      } finally {
        setGateLoading(false)
      }
    }
    init()
    // initialRange is computed once from the initial preset ('mes').
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReport])

  const applyPreset = (next: Preset) => {
    setPreset(next)
    if (next !== 'personalizado') {
      const r = presetRange(next)
      setRange(r)
      void loadReport(r.start, r.end)
    }
  }

  const handleCustomRange = (start: string, end: string) => {
    setCustomRange({ start, end })
    setRange({ start, end })
    void loadReport(start, end)
  }

  if (gateLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando reportes…</p>
        </div>
      </main>
    )
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
        <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <BarChart3 className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Reportes</h1>
          </div>
        </div>
        <div className="mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Los reportes los ve <strong>solo el administrador</strong> (dueño): ventas, gastos
              y utilidad del negocio. Si necesitas una cifra, pídela al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const maxCategoryTotal = report
    ? Math.max(0, ...report.expensesByCategory.map(c => c.total))
    : 0

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
        <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
          <BarChart3 className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Reportes</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Ventas, gastos y utilidad por periodo. Solo el administrador ve estas cifras.
          </p>
        </div>
      </div>

      {/* Period presets */}
      <section aria-label="Periodo del reporte" className="space-y-4">
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
          <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 max-w-md">
            <DateRangePicker
              start={customRange.start}
              end={customRange.end}
              onChange={handleCustomRange}
            />
          </div>
        )}
      </section>

      {/* Report body */}
      {reportLoading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Calculando el reporte…</p>
        </div>
      )}

      {!reportLoading && reportError && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-[#93000a]">No se pudo cargar el reporte</h2>
          <p className="text-sm text-[#93000a]/80 leading-relaxed">
            La lectura de ventas y gastos falló. No se muestra ninguna cifra hasta que la base responda.
          </p>
          <button
            onClick={() => void loadReport(range.start, range.end)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      {!reportLoading && !reportError && report && (
        <>
          {/* Figure cards */}
          <section aria-label="Cifras del periodo" className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Ventas del periodo</p>
              <p className="text-xl md:text-2xl font-extrabold text-[#111c2d] mt-1">{money.format(report.salesTotal)}</p>
              <p className="text-xs text-[#434653] font-semibold mt-0.5">
                {report.salesCount} {report.salesCount === 1 ? 'venta' : 'ventas'}
              </p>
            </div>
            <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Promedio por venta</p>
              <p className="text-xl md:text-2xl font-extrabold text-[#111c2d] mt-1">{money.format(report.avgTicket)}</p>
              <p className="text-xs text-[#434653] font-semibold mt-0.5">Ticket promedio del periodo</p>
            </div>
            <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Gastos del día</p>
              <p className="text-xl md:text-2xl font-extrabold text-[#ba1a1a] mt-1">{money.format(report.dailyExpensesTotal)}</p>
              <p className="text-xs text-[#434653] font-semibold mt-0.5">Compras y gastos registrados día a día</p>
            </div>
            <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Gastos fijos</p>
              <p className="text-xl md:text-2xl font-extrabold text-[#ba1a1a] mt-1">{money.format(report.fixedProrated)}</p>
              <p className="text-xs text-[#434653] font-semibold mt-0.5">
                de {money.format(report.fixedMonthlyTotal)} fijos al mes, prorrateo por días
              </p>
            </div>
            <div
              className={`col-span-2 border rounded-2xl shadow-sm p-5 ${
                report.profit >= 0
                  ? 'bg-[#e2f9ee] border-[#00422b]/20'
                  : 'bg-[#ffdad6] border-[#ba1a1a]/25'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-wider ${
                  report.profit >= 0 ? 'text-[#00422b]' : 'text-[#ba1a1a]'
                }`}
              >
                Utilidad del periodo
              </p>
              <p
                className={`text-2xl md:text-3xl font-extrabold mt-1 ${
                  report.profit >= 0 ? 'text-[#00422b]' : 'text-[#93000a]'
                }`}
              >
                {money.format(report.profit)}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${report.profit >= 0 ? 'text-[#00422b]/75' : 'text-[#93000a]/75'}`}>
                Ventas menos gastos del día y gastos fijos prorrateados.
              </p>
            </div>
          </section>

          {/* Sales by day */}
          <section aria-label="Ventas por día" className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
            <h2 className="px-5 pt-4 pb-2 text-xs font-black uppercase tracking-wider text-[#00357f]">Ventas por día</h2>
            {report.salesByDay.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[#737784] font-medium">Sin ventas en el periodo.</p>
            ) : (
              <ul className="divide-y divide-[#f0f3ff]">
                {report.salesByDay.map(day => (
                  <li key={day.date} className="flex items-center justify-between gap-3 px-5 py-3 min-h-[48px]">
                    <span className="text-sm font-bold text-[#111c2d] capitalize">{formatDayFull(day.date)}</span>
                    <span className="text-xs text-[#737784] font-semibold">
                      {day.count} {day.count === 1 ? 'venta' : 'ventas'}
                    </span>
                    <span className="text-sm font-extrabold text-[#111c2d]">{money.format(day.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Expenses by category */}
          <section aria-label="Gastos por categoría" className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Gastos por categoría</h2>
            {report.expensesByCategory.length === 0 ? (
              <p className="text-sm text-[#737784] font-medium">Sin gastos registrados en el periodo.</p>
            ) : (
              <ul className="space-y-3">
                {report.expensesByCategory.map(cat => (
                  <li key={cat.category}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#111c2d]">{cat.category}</span>
                      <span className="text-sm font-extrabold text-[#ba1a1a]">{money.format(cat.total)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-[#ffdad6]/50 overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-[#ba1a1a]/70"
                        style={{
                          width: `${maxCategoryTotal > 0 ? Math.max(4, (cat.total / maxCategoryTotal) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top products */}
          <section aria-label="Productos más vendidos del periodo" className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
            <h2 className="px-5 pt-4 pb-2 text-xs font-black uppercase tracking-wider text-[#00357f]">
              Productos más vendidos del periodo
            </h2>
            {report.topProducts.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[#737784] font-medium">
                Todavía no hay productos vendidos en este periodo.
              </p>
            ) : (
              <ul className="divide-y divide-[#f0f3ff]">
                {report.topProducts.map(product => (
                  <li key={product.name} className="flex items-center justify-between gap-3 px-5 py-3 min-h-[48px]">
                    <span className="text-sm font-bold text-[#111c2d]">{product.name}</span>
                    <span className="text-xs text-[#737784] font-semibold">
                      {product.units} {product.units === 1 ? 'unidad' : 'unidades'}
                    </span>
                    <span className="text-sm font-extrabold text-[#111c2d]">{money.format(product.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
