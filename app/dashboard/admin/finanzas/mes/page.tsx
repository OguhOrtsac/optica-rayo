'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getMonthSales, type MonthSalesDetail } from '@/lib/services'
import PageHeader from '@/components/page-header'

// Ventas del mes (Finanzas): gráfica de línea con punto SOLO en los
// días con ventas (los días sin actividad no existen en la gráfica,
// la línea salta al siguiente día con ventas), las cifras del mes
// con las definiciones del dueño y la tabla completa de ventas en
// una tarjeta minimizable. Solo administrador; cifras de la base
// real vía getMonthSales — un fallo se muestra como error.

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

const moneyCompact = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const STATUS_META: Record<string, { label: string; chip: string }> = {
  Cotizacion: { label: 'Cotización', chip: 'bg-[#dee8ff] text-[#00357f]' },
  Anticipo_Pagado: { label: 'Anticipo', chip: 'bg-[#fef3c7] text-[#92400e]' },
  En_Taller: { label: 'En taller', chip: 'bg-[#fef3c7] text-[#92400e]' },
  Listo_Entrega: { label: 'Listo para entrega', chip: 'bg-[#dee8ff] text-[#00357f]' },
  Entregado: { label: 'Entregado', chip: 'bg-[#e2f9ee] text-[#00422b]' },
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function formatDayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatDayFull(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// --- Gráfica de línea (SVG propio, sin librerías) ---
function MonthChart({ days }: { days: MonthSalesDetail['days'] }) {
  const W = 720
  const H = 280
  const PAD_X = 44
  const TOP = 40
  const BOTTOM = 36
  const max = Math.max(0, ...days.map(d => d.total))

  const xFor = (i: number) =>
    days.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (days.length - 1)
  const yFor = (total: number) =>
    max > 0 ? TOP + (1 - total / max) * (H - TOP - BOTTOM) : (TOP + H - BOTTOM) / 2

  const points = days.map((d, i) => ({ ...d, x: xFor(i), y: yFor(d.total) }))
  const line = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Gráfica de ventas por día: ${days.map(d => `${formatDayShort(d.date)} ${moneyCompact.format(d.total)}`).join(', ')}`}
    >
      {/* Eje base */}
      <line x1={PAD_X - 16} x2={W - PAD_X + 16} y1={H - BOTTOM} y2={H - BOTTOM} stroke="#cbd5e1" strokeWidth="1.5" />
      {points.length > 1 && (
        <polyline points={line} fill="none" stroke="#00357f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => {
        const anchor = days.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
        // En pantallas chicas la gráfica se escala y las etiquetas de monto
        // de puntos vecinos se amontonan: con varios puntos se alterna la
        // altura de la etiqueta (una arriba, la siguiente más arriba) y se
        // le da un halo blanco para que se lea aunque se acerque a otra.
        const wantedLift = points.length > 3 && i % 2 === 1 ? 32 : 15
        // El punto más alto vive en el borde superior: su etiqueta no
        // puede subir más allá del lienzo.
        const labelLift = p.y - wantedLift < 16 ? 15 : wantedLift
        return (
          <g key={p.date}>
            <text
              x={p.x}
              y={p.y - labelLift}
              textAnchor={anchor}
              fontSize="14"
              fontWeight="800"
              fill="#00357f"
              stroke="#ffffff"
              strokeWidth="3.5"
              style={{ paintOrder: 'stroke' }}
            >
              {moneyCompact.format(p.total)}
            </text>
            <circle cx={p.x} cy={p.y} r="6" fill="#0899c9" stroke="#ffffff" strokeWidth="2.5" />
            <text x={p.x} y={H - BOTTOM + 24} textAnchor={anchor} fontSize="12.5" fontWeight="600" fill="#737784">
              {formatDayShort(p.date)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function FinanzasMesPage() {
  const now = new Date()
  const [gateLoading, setGateLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [detail, setDetail] = useState<MonthSalesDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(true)

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setLoadError(null)
    try {
      setDetail(await getMonthSales(y, m))
    } catch (err: any) {
      console.error('Error loading month sales:', err)
      setDetail(null)
      setLoadError(err?.message || 'No se pudieron leer las ventas del mes.')
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
        if (allowed) {
          const n = new Date()
          await load(n.getFullYear(), n.getMonth() + 1)
        }
      } catch (err) {
        console.error('Error loading finanzas mes:', err)
      } finally {
        setGateLoading(false)
      }
    }
    init()
  }, [load])

  const moveMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
    void load(next.getFullYear(), next.getMonth() + 1)
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })

  const header = (
    <PageHeader
      title="Ventas del mes"
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
          <CalendarRange className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Ventas del mes</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">Cómo va el mes, día por día, y cuánto entró a caja.</p>
        </div>
      </div>
    </PageHeader>
  )

  if (gateLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando ventas del mes…</p>
        </div>
      </main>
    )
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
        {header}
        <div className="mt-4 md:mt-6 bg-white rounded-[20px] or-shadow-card p-6 flex items-start gap-4">
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
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 space-y-4 md:space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Mes anterior"
          className="flex items-center justify-center w-11 h-11 rounded-full border border-[#cbd5e1] bg-white text-[#00357f] hover:bg-[#dee8ff]/50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-base font-extrabold text-[#00357f] capitalize tracking-tight">{monthLabel}</p>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Mes siguiente"
          className="flex items-center justify-center w-11 h-11 rounded-full border border-[#cbd5e1] bg-white text-[#00357f] hover:bg-[#dee8ff]/50 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Leyendo las ventas del mes…</p>
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-[20px] p-6 space-y-3">
          <h2 className="text-base font-bold text-[#93000a]">No se pudieron cargar las ventas del mes</h2>
          <p className="text-sm text-[#93000a]/80 leading-relaxed">{loadError}</p>
          <button
            onClick={() => void load(year, month)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      {!loading && !loadError && detail && (
        <>
          {/* Gráfica: solo días con ventas */}
          <section aria-label="Gráfica de ventas por día" className="bg-white rounded-[20px] or-shadow-card p-3.5 sm:p-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Ventas por día</h2>
            {detail.days.length === 0 ? (
              <p className="text-sm text-[#434653] font-medium mt-3">
                Sin ventas en este mes. Cuando haya ventas, cada día con actividad aparecerá como un punto con su monto; los días sin ventas no se dibujan.
              </p>
            ) : (
              <div className="mt-2">
                <MonthChart days={detail.days} />
                <p className="text-[11px] text-[#737784] font-semibold mt-1">
                  Solo aparecen los días con ventas ({detail.days.length}); la línea salta los días sin actividad en vez de bajar a cero.
                </p>
              </div>
            )}
          </section>

          {/* Cifras del mes */}
          <section aria-label="Cifras del mes" className="bg-white rounded-[20px] or-shadow-card p-3.5 sm:p-5 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Cifras del mes</h2>
            <dl className="divide-y divide-[#f0f3ff]">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm font-bold text-[#111c2d]">Venta total del mes</dt>
                <dd className="text-base font-extrabold text-[#111c2d] tabular-nums">{money.format(detail.salesTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm font-semibold text-[#434653]">Cobrado de las ventas del mes</dt>
                <dd className="text-sm font-extrabold text-[#00422b] tabular-nums">{money.format(detail.collectedFromMonthSales)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm font-semibold text-[#434653]">Adeudo de este mes</dt>
                <dd className="text-sm font-extrabold text-[#92400e] tabular-nums">{money.format(detail.monthDebt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm font-semibold text-[#434653]">
                  Abonos de meses anteriores cobrados este mes
                  <span className="block text-[11px] text-[#737784] font-semibold">Extra: no son ventas de este mes, pero sí entraron a caja</span>
                </dt>
                <dd className="text-sm font-extrabold text-[#00422b] tabular-nums">{money.format(detail.priorMonthsCollected)}</dd>
              </div>
            </dl>
            <div className="bg-[#dee8ff]/50 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-[#00357f]">Total que entró a caja en el mes</p>
              <p className="text-xl font-extrabold text-[#00357f] tabular-nums">{money.format(detail.cashTotal)}</p>
              <p className="w-full text-[11px] text-[#434653] font-semibold tabular-nums">
                Cobrado de ventas del mes {money.format(detail.collectedFromMonthSales)} + abonos recibidos en el mes {money.format(detail.monthInstallmentsTotal)}
              </p>
            </div>
          </section>

          {/* Tabla de ventas (minimizable) */}
          <section aria-label="Todas las ventas del mes" className="bg-white rounded-[20px] or-shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => setTableOpen(open => !open)}
              aria-expanded={tableOpen}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] cursor-pointer text-left"
            >
              <span className="text-xs font-black uppercase tracking-wider text-[#00357f]">
                Tabla de todas las ventas · {detail.sales.length}
              </span>
              <ChevronDown className={`w-5 h-5 text-[#00357f] transition-transform duration-200 ${tableOpen ? 'rotate-180' : ''}`} />
            </button>
            {tableOpen && (
              detail.sales.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-[#737784] font-medium">Sin ventas en este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-y border-[#f0f3ff] text-[10px] font-black uppercase tracking-wider text-[#737784]">
                        <th className="py-2.5 px-5">Fecha</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Pagado</th>
                        <th className="py-2.5 px-3 text-right">Pendiente</th>
                        <th className="py-2.5 px-5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f3ff]">
                      {detail.sales.map(sale => {
                        const meta = STATUS_META[sale.status] ?? STATUS_META.Cotizacion
                        return (
                          <tr key={sale.id} className="align-top">
                            <td className="py-3 px-5 whitespace-nowrap">
                              <span className="block font-bold text-[#111c2d] capitalize">{formatDayFull(sale.date_label)}</span>
                              <span className="block text-[11px] text-[#737784] font-semibold tabular-nums">{sale.time_label}</span>
                            </td>
                            <td className="py-3 px-3 font-bold text-[#111c2d]">{sale.customer_name}</td>
                            <td className="py-3 px-3 text-xs text-[#434653] font-medium">{sale.description}</td>
                            <td className="py-3 px-3 text-right font-extrabold text-[#111c2d] tabular-nums">{money.format(sale.total)}</td>
                            <td className="py-3 px-3 text-right font-semibold text-[#00422b] tabular-nums">{money.format(sale.paid_amount)}</td>
                            <td className="py-3 px-3 text-right font-semibold text-[#92400e] tabular-nums">{money.format(sale.pending_balance)}</td>
                            <td className="py-3 px-5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${meta.chip}`}>
                                {meta.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        </>
      )}
    </main>
  )
}
