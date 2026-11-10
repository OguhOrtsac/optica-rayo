'use client'

import { useState } from 'react'
import { Activity, ChevronDown } from 'lucide-react'

export type RecentActivitySale = {
  id: string
  customer_name?: string | null
  seller_name?: string | null
  created_at: string
  total: number
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

// Fecha corta tipo «9 nov 26» para la columna compacta.
const formatShortDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

const formatLongDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Actividad reciente del panel: lista compacta, móvil-primero.
 * Columnas en orden: Cliente · Detalle corto · Monto · Fecha/Hora (al final,
 * a la derecha, fecha corta + hora). Al tocar una fila se expande con el
 * nombre completo, el detalle completo y la fecha/hora largas, para que a
 * 360px nada necesite scroll lateral.
 */
export default function RecentActivity({ sales }: { sales: RecentActivitySale[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const recent = sales.slice(0, 5)

  return (
    <div className="anim-stagger-item bg-white p-4 sm:p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left" style={{ '--enter-delay': '420ms' } as React.CSSProperties}>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-[#0899c9]/15 text-[#0899c9] flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5" />
        </span>
        <h3 className="text-base font-semibold text-[#111c2d]">Actividad reciente</h3>
        {recent.length > 0 && (
          <span className="ml-auto shrink-0 bg-[#dee8ff] text-[#00357f] text-xs font-bold px-2.5 py-1 rounded-full">
            {recent.length}
          </span>
        )}
      </div>

      {recent.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#737784] font-bold">Sin actividad registrada.</p>
      ) : (
        <ul className="divide-y divide-[#cbd5e1]/30">
          {recent.map(s => {
            const customerName = s.customer_name || 'Cliente'
            const sellerName = s.seller_name || 'Personal'
            const isOpen = expandedId === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-2 py-3 min-h-[48px] text-left cursor-pointer"
                >
                  {/* Cliente + detalle corto */}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-sm text-[#111c2d]">{customerName}</span>
                      <span className="shrink-0 inline-flex items-center px-1.5 py-px rounded-full bg-[#dee8ff] text-[#00357f] font-bold text-[9px] uppercase tracking-wide">
                        Venta
                      </span>
                    </span>
                    <span className="block truncate text-xs text-[#737784] font-medium mt-0.5">
                      Registrada por {sellerName}
                    </span>
                  </span>

                  {/* Monto + fecha/hora al final, a la derecha */}
                  <span className="shrink-0 flex items-center gap-1">
                    <span className="text-right">
                      <span className="inline-block bg-[#dee8ff]/70 text-[#00357f] font-black font-mono text-xs px-2 py-0.5 rounded-lg">
                        {formatPrice(s.total)}
                      </span>
                      <span className="block text-[10px] leading-tight text-[#737784] font-medium mt-0.5">
                        {formatShortDate(s.created_at)}
                        <span className="block">{formatTime(s.created_at)}</span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-[#737784] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {/* Fila expandida: todo lo que no cabe en la vista compacta */}
                {isOpen && (
                  <div className="mx-0 mb-2 rounded-xl bg-[#f0f3ff]/60 border border-[#cbd5e1]/40 px-3 py-2.5 text-[11px] space-y-1 animate-in fade-in duration-150">
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[9px] tracking-wider block">Cliente</span>
                      <span className="font-bold text-[#111c2d]">{customerName}</span>
                    </p>
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[9px] tracking-wider block">Detalle</span>
                      Venta registrada por {sellerName} · Orden #{s.id.slice(0, 6).toUpperCase()}
                    </p>
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[9px] tracking-wider block">Fecha y hora</span>
                      {formatLongDate(s.created_at)} · {formatTime(s.created_at)}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
