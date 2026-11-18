'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Lock, RefreshCw, ShoppingBag } from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getDaySalesDetail, type DaySalesDetail } from '@/lib/services'
import PageHeader from '@/components/page-header'

// Ventas de hoy (Finanzas): el detalle del día con la ecuación del
// dueño a la vista — cobrado + por cobrar = vendido. Solo el
// administrador (owner / super_admin); las cifras salen de
// getDaySalesDetail (base real) y un fallo se muestra como error,
// nunca como números inventados.

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

const STATUS_META: Record<string, { label: string; chip: string }> = {
  Cotizacion: { label: 'Cotización', chip: 'bg-[#dee8ff] text-[#00357f]' },
  Anticipo_Pagado: { label: 'Anticipo', chip: 'bg-[#fef3c7] text-[#92400e]' },
  En_Taller: { label: 'En taller', chip: 'bg-[#fef3c7] text-[#92400e]' },
  Listo_Entrega: { label: 'Listo para entrega', chip: 'bg-[#dee8ff] text-[#00357f]' },
  Entregado: { label: 'Entregado', chip: 'bg-[#e2f9ee] text-[#00422b]' },
}

export default function FinanzasHoyPage() {
  const [gateLoading, setGateLoading] = useState(true)
  const [canAccess, setCanAccess] = useState(false)
  const [detail, setDetail] = useState<DaySalesDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const todayISO = toISODate(new Date())
  const todayLabel = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDetail(await getDaySalesDetail(toISODate(new Date())))
    } catch (err: any) {
      console.error('Error loading day sales detail:', err)
      setDetail(null)
      setLoadError(err?.message || 'No se pudieron leer las ventas de hoy.')
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
        console.error('Error loading finanzas hoy:', err)
      } finally {
        setGateLoading(false)
      }
    }
    init()
  }, [load])

  const header = (
    <PageHeader
      title="Ventas de hoy"
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
          <CalendarDays className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Ventas de hoy</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium capitalize">{todayLabel}</p>
        </div>
      </div>
    </PageHeader>
  )

  if (gateLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando ventas de hoy…</p>
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

      {loading && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Leyendo las ventas de hoy…</p>
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-[20px] p-6 space-y-3">
          <h2 className="text-base font-bold text-[#93000a]">No se pudieron cargar las ventas de hoy</h2>
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

      {!loading && !loadError && detail && (
        <>
          {/* La ecuación del día. En móvil cada cifra va en fila de ancho
              completo (etiqueta y nota a la izquierda, monto a la derecha)
              para que ningún monto se corte; en sm+ vuelven las 3 columnas. */}
          <section aria-label="Cifras de hoy" className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-[20px] or-shadow-card p-4 grid grid-cols-[1fr_auto] items-center gap-x-3 sm:flex sm:flex-col sm:items-stretch">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Cobrado hoy</p>
                <p className="row-span-2 text-xl md:text-2xl font-extrabold text-[#00422b] sm:mt-1 tabular-nums whitespace-nowrap">{money.format(detail.collectedTotal)}</p>
                <p className="text-[11px] text-[#434653] font-semibold mt-0.5">Entró a caja por las ventas de hoy</p>
              </div>
              <div className="bg-white rounded-[20px] or-shadow-card p-4 grid grid-cols-[1fr_auto] items-center gap-x-3 sm:flex sm:flex-col sm:items-stretch">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Por cobrar hoy</p>
                <p className="row-span-2 text-xl md:text-2xl font-extrabold text-[#92400e] sm:mt-1 tabular-nums whitespace-nowrap">{money.format(detail.pendingTotal)}</p>
                <p className="text-[11px] text-[#434653] font-semibold mt-0.5">Quedó en pagos diferidos</p>
              </div>
              <div className="bg-white rounded-[20px] or-shadow-card p-4 grid grid-cols-[1fr_auto] items-center gap-x-3 sm:flex sm:flex-col sm:items-stretch">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Vendido hoy</p>
                <p className="row-span-2 text-xl md:text-2xl font-extrabold text-[#00357f] sm:mt-1 tabular-nums whitespace-nowrap">{money.format(detail.soldTotal)}</p>
                <p className="text-[11px] text-[#434653] font-semibold mt-0.5">{detail.sales.length} {detail.sales.length === 1 ? 'venta' : 'ventas'} de hoy</p>
              </div>
            </div>
            <p className="text-center text-[13px] sm:text-sm leading-relaxed font-bold text-[#00357f] bg-[#dee8ff]/50 rounded-full px-4 py-2 tabular-nums" role="status">
              {money.format(detail.collectedTotal)} cobrado + {money.format(detail.pendingTotal)} por cobrar = {money.format(detail.soldTotal)} vendido
            </p>
          </section>

          {/* Ventas del día, tipo actividad */}
          <section aria-label="Ventas de hoy" className="bg-white rounded-[20px] or-shadow-card overflow-hidden">
            <h2 className="px-5 pt-4 pb-2 text-xs font-black uppercase tracking-wider text-[#00357f]">
              Ventas de hoy · {todayISO}
            </h2>
            {detail.sales.length === 0 ? (
              <div className="px-5 pb-6 pt-2 text-center space-y-2">
                <ShoppingBag className="w-8 h-8 text-[#0899c9] mx-auto" />
                <p className="text-sm font-bold text-[#111c2d]">Hoy todavía no hay ventas</p>
                <p className="text-xs text-[#434653] font-medium">
                  Cuando se registre la primera venta del día aparecerá aquí, con lo cobrado y lo que quedó por cobrar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f0f3ff]">
                {detail.sales.map(sale => {
                  const meta = STATUS_META[sale.status] ?? STATUS_META.Cotizacion
                  return (
                    <li key={sale.id} className="px-5 py-3.5 min-h-[48px] flex items-start gap-3">
                      <span className="text-xs font-extrabold text-[#737784] tabular-nums pt-0.5 shrink-0 w-14">{sale.time_label}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#111c2d]">{sale.customer_name}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </span>
                        <span className="block text-xs text-[#434653] font-medium mt-0.5">{sale.description}</span>
                        <span className="block text-[11px] text-[#737784] font-semibold mt-1 tabular-nums">
                          Pagado {money.format(sale.paid_amount)} · Pendiente {money.format(sale.pending_balance)}
                        </span>
                      </span>
                      <span className="text-sm md:text-base font-extrabold text-[#111c2d] tabular-nums shrink-0">{money.format(sale.total)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
