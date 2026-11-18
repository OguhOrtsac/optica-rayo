'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getPeriodReport, type PeriodReport } from '@/lib/expenses'
import DateRangePicker from '@/components/date-range-picker'
import PageHeader from '@/components/page-header'
import SalesLineChart from '@/components/sales-line-chart'

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

// --- Tarjeta minimizable (mismo patrón que Finanzas: cabecera-boton
// con chevron y aria-expanded; el contenido se monta solo si está
// abierta). Todas las tarjetas de Reportes se pueden minimizar. ---
function CollapsibleSection({
  title,
  open,
  onToggle,
  ariaLabel,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  ariaLabel?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 min-h-[48px] cursor-pointer text-left"
      >
        <span className="text-xs font-black uppercase tracking-wider text-[#00357f]">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-[#00357f] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && children}
    </section>
  )
}

// --- Ordenamiento de tablas (solo presentación: no toca cálculos ni
// totales). Primera pulsación en una columna = ascendente (menor a
// mayor / A a Z / fecha temprana a tardía); pulsar la MISMA columna
// otra vez invierte el sentido; pulsar otra columna ordena por ella
// desde ascendente. ---
type SortDir = 'asc' | 'desc'

interface SortState<K extends string> {
  key: K
  dir: SortDir
}

function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  return current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'asc' }
}

function sortedBy<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  value: (row: T, key: K) => string | number,
): T[] {
  const mul = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = value(a, sort.key)
    const vb = value(b, sort.key)
    const cmp =
      typeof va === 'string'
        ? va.localeCompare(String(vb), 'es')
        : Number(va) - Number(vb)
    return cmp * mul
  })
}

function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  padClass = 'px-3',
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (key: K) => void
  align?: 'left' | 'center' | 'right'
  padClass?: string
}) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className="p-0 font-black"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordenar por ${label}${active ? (sort.dir === 'asc' ? ' (ascendente)' : ' (descendente)') : ''}`}
        className={`flex w-full min-h-[44px] items-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider cursor-pointer ${padClass} ${justify} ${
          active ? 'text-[#00357f]' : 'text-[#737784] hover:text-[#00357f]'
        }`}
      >
        <span>{label}</span>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? '' : 'opacity-40'}`} aria-hidden="true" />
      </button>
    </th>
  )
}

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

  // Todas las tarjetas nacen expandidas; cada una se minimiza con su
  // chevron. «Cifras» agrupa las tarjetas de cifras (Ventas, Utilidad,
  // Gastos y Gastos fijos) y se minimiza como un solo bloque.
  const [openSections, setOpenSections] = useState({
    cifras: true,
    grafica: true,
    ventas: true,
    gastos: true,
    productos: true,
  })
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Orden activo de cada tabla (la vista inicial conserva el orden en
  // que el servicio entrega los datos).
  const [salesSort, setSalesSort] = useState<SortState<'date' | 'count' | 'total'>>({
    key: 'date',
    dir: 'asc',
  })
  const [expensesSort, setExpensesSort] = useState<SortState<'category' | 'total'>>({
    key: 'total',
    dir: 'desc',
  })
  const [productsSort, setProductsSort] = useState<SortState<'name' | 'units' | 'total'>>({
    key: 'total',
    dir: 'desc',
  })

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

  // Filas ordenadas según la columna activa de cada tabla. Es solo el
  // orden de presentación: los totales y cifras no se tocan.
  const sortedSalesByDay = useMemo(
    () =>
      report
        ? sortedBy(report.salesByDay, salesSort, (d, k) =>
            k === 'date' ? d.date : k === 'count' ? d.count : d.total,
          )
        : [],
    [report, salesSort],
  )
  const sortedExpenses = useMemo(
    () =>
      report
        ? sortedBy(report.expensesByCategory, expensesSort, (c, k) =>
            k === 'category' ? c.category : c.total,
          )
        : [],
    [report, expensesSort],
  )
  const sortedProducts = useMemo(
    () =>
      report
        ? sortedBy(report.topProducts, productsSort, (p, k) =>
            k === 'name' ? p.name : k === 'units' ? p.units : p.total,
          )
        : [],
    [report, productsSort],
  )

  // Las etiquetas de gastos dicen «del día» solo cuando el rango ES
  // hoy; cualquier otro rango (semana, mes o personalizado) es «del
  // periodo».
  const isTodayRange = range.start === range.end && range.start === toISODate(new Date())
  const dailyExpensesLabel = isTodayRange ? 'Gastos del día' : 'Gastos del periodo'
  const fixedExpensesLabel = isTodayRange ? 'Gastos fijos' : 'Gastos fijos del periodo'

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
        <PageHeader
          title="Reportes"
          mobileActions={
            <Link href="/dashboard/admin" aria-label="Volver al panel" className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
          }
        >
          <div className="flex items-center gap-2.5 border-b border-[#e7eeff] pb-3">
            <Link href="/dashboard/admin" aria-label="Volver al panel" className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
              <BarChart3 className="w-4.5 h-4.5" />
            </span>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Reportes</h1>
            </div>
          </div>
        </PageHeader>
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

      {/* Page Header — compacto a propósito (pedido del dueño): el
          título va en el tamaño más chico de título de página y la
          descripción en fuente menor, para que el encabezado ocupe
          poco espacio vertical y las cifras respiren. */}
      <PageHeader
        title="Reportes"
        mobileActions={
          <Link href="/dashboard/admin" aria-label="Volver al panel" className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
        }
      >
        <div className="flex items-center gap-2.5 border-b border-[#e7eeff] pb-3">
          <Link href="/dashboard/admin" aria-label="Volver al panel" className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <BarChart3 className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Reportes</h1>
            <p className="text-xs text-[#434653] font-medium leading-snug">
              Ventas, gastos y utilidad por periodo. Solo el administrador ve estas cifras.
            </p>
          </div>
        </div>
      </PageHeader>

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
          {/* Figure cards — minimizables como un solo bloque. Sin la
              tarjeta de «Promedio por venta» (fuera por pedido del
              dueño) y con la Utilidad ARRIBA, junto a Ventas, en el
              espacio que esa salida dejó. Las etiquetas de gastos
              dicen «del día» solo si el rango es hoy; si no, «del
              periodo». */}
          <CollapsibleSection
            title="Cifras del periodo"
            open={openSections.cifras}
            onToggle={() => toggleSection('cifras')}
          >
            <div className="grid grid-cols-2 gap-3 md:gap-4 px-4 pb-4">
              <div className="bg-[#f9f9ff] ring-1 ring-[#cbd5e1]/40 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Ventas del periodo</p>
                <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#111c2d] mt-1 tabular-nums whitespace-nowrap">{money.format(report.salesTotal)}</p>
                <p className="text-xs text-[#434653] font-semibold mt-0.5">
                  {report.salesCount} {report.salesCount === 1 ? 'venta' : 'ventas'}
                </p>
              </div>
              <div
                className={`ring-1 rounded-2xl p-4 ${
                  report.profit >= 0
                    ? 'bg-[#e2f9ee] ring-[#00422b]/15'
                    : 'bg-[#ffdad6] ring-[#ba1a1a]/20'
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
                  className={`text-lg sm:text-xl md:text-2xl font-extrabold mt-1 tabular-nums whitespace-nowrap ${
                    report.profit >= 0 ? 'text-[#00422b]' : 'text-[#93000a]'
                  }`}
                >
                  {money.format(report.profit)}
                </p>
                <p className={`text-xs font-semibold mt-0.5 ${report.profit >= 0 ? 'text-[#00422b]/75' : 'text-[#93000a]/75'}`}>
                  {isTodayRange
                    ? 'Ventas menos gastos del día y gastos fijos prorrateados.'
                    : 'Ventas menos gastos del periodo, con los fijos prorrateados.'}
                </p>
              </div>
              <div className="bg-[#f9f9ff] ring-1 ring-[#cbd5e1]/40 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">{dailyExpensesLabel}</p>
                <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#ba1a1a] mt-1 tabular-nums whitespace-nowrap">{money.format(report.dailyExpensesTotal)}</p>
                <p className="text-xs text-[#434653] font-semibold mt-0.5">Compras y gastos registrados día a día</p>
              </div>
              <div className="bg-[#f9f9ff] ring-1 ring-[#cbd5e1]/40 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">{fixedExpensesLabel}</p>
                <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#ba1a1a] mt-1 tabular-nums whitespace-nowrap">{money.format(report.fixedProrated)}</p>
                <p className="text-xs text-[#434653] font-semibold mt-0.5">
                  de {money.format(report.fixedMonthlyTotal)} fijos al mes, prorrateo por días
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Sales chart — puntos solo en los días con ventas */}
          <CollapsibleSection
            title="Gráfica de ventas"
            open={openSections.grafica}
            onToggle={() => toggleSection('grafica')}
          >
            <div className="px-4 pb-4">
              {report.salesByDay.length === 0 ? (
                <p className="text-sm text-[#737784] font-medium">
                  Sin ventas en el periodo. Cuando haya ventas, cada día con actividad aparecerá como un punto con su monto.
                </p>
              ) : (
                <>
                  <SalesLineChart days={report.salesByDay} />
                  <p className="text-[11px] text-[#737784] font-semibold mt-1">
                    Solo aparecen los días con ventas ({report.salesByDay.length}); la línea salta los días sin actividad en vez de bajar a cero.
                  </p>
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* Sales by day — tabla ordenable por columna */}
          <CollapsibleSection
            title="Ventas por día"
            open={openSections.ventas}
            onToggle={() => toggleSection('ventas')}
          >
            {report.salesByDay.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[#737784] font-medium">Sin ventas en el periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[320px]">
                  <thead>
                    <tr className="border-y border-[#f0f3ff]">
                      <SortHeader label="Fecha" sortKey="date" sort={salesSort} onSort={k => setSalesSort(s => nextSort(s, k))} padClass="pl-5 pr-3" />
                      <SortHeader label="Ventas" sortKey="count" sort={salesSort} onSort={k => setSalesSort(s => nextSort(s, k))} align="center" />
                      <SortHeader label="Total" sortKey="total" sort={salesSort} onSort={k => setSalesSort(s => nextSort(s, k))} align="right" padClass="pl-3 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f3ff]">
                    {sortedSalesByDay.map(day => (
                      <tr key={day.date}>
                        <td className="py-3 pl-5 pr-3 font-bold text-[#111c2d] capitalize leading-snug">{formatDayFull(day.date)}</td>
                        <td className="py-3 px-3 text-center text-xs text-[#737784] font-semibold whitespace-nowrap">
                          {day.count} {day.count === 1 ? 'venta' : 'ventas'}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right font-extrabold text-[#111c2d] tabular-nums whitespace-nowrap">{money.format(day.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Expenses by category — tabla ordenable por columna */}
          <CollapsibleSection
            title="Gastos por categoría"
            open={openSections.gastos}
            onToggle={() => toggleSection('gastos')}
            ariaLabel="Gastos por categoría"
          >
            {report.expensesByCategory.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[#737784] font-medium">Sin gastos registrados en el periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[300px]">
                  <thead>
                    <tr className="border-y border-[#f0f3ff]">
                      <SortHeader label="Categoría" sortKey="category" sort={expensesSort} onSort={k => setExpensesSort(s => nextSort(s, k))} padClass="pl-5 pr-3" />
                      <SortHeader label="Total" sortKey="total" sort={expensesSort} onSort={k => setExpensesSort(s => nextSort(s, k))} align="right" padClass="pl-3 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f3ff]">
                    {sortedExpenses.map(cat => (
                      <tr key={cat.category}>
                        <td className="py-3 pl-5 pr-3">
                          <span className="block font-bold text-[#111c2d] leading-snug">{cat.category}</span>
                          <span className="mt-1.5 block h-2 rounded-full bg-[#ffdad6]/50 overflow-hidden" aria-hidden="true">
                            <span
                              className="block h-full rounded-full bg-[#ba1a1a]/70"
                              style={{
                                width: `${maxCategoryTotal > 0 ? Math.max(4, (cat.total / maxCategoryTotal) * 100) : 0}%`,
                              }}
                            />
                          </span>
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right font-extrabold text-[#ba1a1a] tabular-nums whitespace-nowrap align-top">{money.format(cat.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Top products — tabla ordenable por columna */}
          <CollapsibleSection
            title="Productos más vendidos del periodo"
            open={openSections.productos}
            onToggle={() => toggleSection('productos')}
            ariaLabel="Productos más vendidos del periodo"
          >
            {report.topProducts.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[#737784] font-medium">
                Todavía no hay productos vendidos en este periodo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[320px]">
                  <thead>
                    <tr className="border-y border-[#f0f3ff]">
                      <SortHeader label="Producto" sortKey="name" sort={productsSort} onSort={k => setProductsSort(s => nextSort(s, k))} padClass="pl-5 pr-3" />
                      <SortHeader label="Unidades" sortKey="units" sort={productsSort} onSort={k => setProductsSort(s => nextSort(s, k))} align="center" />
                      <SortHeader label="Total" sortKey="total" sort={productsSort} onSort={k => setProductsSort(s => nextSort(s, k))} align="right" padClass="pl-3 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f3ff]">
                    {sortedProducts.map(product => (
                      <tr key={product.name}>
                        <td className="py-3 pl-5 pr-3 font-bold text-[#111c2d] leading-snug">{product.name}</td>
                        <td className="py-3 px-3 text-center text-xs text-[#737784] font-semibold whitespace-nowrap">
                          {product.units} {product.units === 1 ? 'unidad' : 'unidades'}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right font-extrabold text-[#111c2d] tabular-nums whitespace-nowrap">{money.format(product.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}
    </main>
  )
}
