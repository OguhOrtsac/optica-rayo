'use client'

import { useState } from 'react'
import { orderCodeFromSaleId } from '@/lib/ticket'
import {
  Activity,
  Cake,
  ChevronDown,
  MessageSquare,
  Receipt,
  Stethoscope,
  UserPlus,
} from 'lucide-react'

export type RecentActivitySale = {
  id: string
  customer_name?: string | null
  seller_name?: string | null
  created_at: string
  total: number
}

export type RecentActivityExam = {
  id: string
  customer_name?: string | null
  created_at: string
}

export type RecentActivityCustomer = {
  id: string
  full_name?: string | null
  created_at?: string | null
}

export type RecentActivityEvent = {
  id: string
  type: string
  customer_name?: string | null
  description: string
  created_at: string
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

type FeedKind = 'sale' | 'exam' | 'customer' | 'reminder' | 'birthday'

type FeedItem = {
  key: string
  kind: FeedKind
  title: string
  detail: string
  expandDetail: string
  created_at: string
  amount?: number
}

// Color por tipo de actividad (la misma idea de color por tipo del
// menú): venta verde, examen cian, cliente azul, recordatorio naranja,
// cumpleaños rosa.
const KIND_STYLES: Record<FeedKind, { chip: string; label: string; Icon: typeof Receipt }> = {
  sale: { chip: 'bg-[#e2f9ee] text-[#00422b]', label: 'Venta', Icon: Receipt },
  exam: { chip: 'bg-[#e6f7fb] text-[#0899c9]', label: 'Examen', Icon: Stethoscope },
  customer: { chip: 'bg-[#dee8ff] text-[#00357f]', label: 'Cliente nuevo', Icon: UserPlus },
  reminder: { chip: 'bg-[#fef3c7] text-[#92400e]', label: 'Recordatorio', Icon: MessageSquare },
  birthday: { chip: 'bg-[#fce7f3] text-[#be185d]', label: 'Cumpleaños', Icon: Cake },
}

const timeOf = (iso: string) => {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Actividad reciente del panel: TODA la actividad de la óptica, no
 * solo ventas (decisión del dueño, 2026-11-18). Mezcla ventas (de
 * `sales`), exámenes nuevos (de `clinical_exams`), clientes nuevos
 * (de `profiles`) y los envíos registrados en `activity_events`
 * (recordatorios y felicitaciones, que se asientan al tocar su botón
 * de WhatsApp), ordenados por fecha, más reciente primero.
 *
 * Lista compacta, móvil-primero: nombre + chip de tipo con su color,
 * detalle corto y fecha/hora a la derecha (las ventas además su
 * monto); al tocar una fila se expande con el detalle completo.
 * La letra del CONTENIDO va un escalón más chica que las demás
 * secciones (orden del dueño); la tarjeta y su barra de encabezado
 * de 44px quedan idénticas a las de Recordatorios/Solicitudes/
 * Cumpleaños.
 */
export default function RecentActivity({
  sales,
  exams = [],
  customers = [],
  events = [],
}: {
  sales: RecentActivitySale[]
  exams?: RecentActivityExam[]
  customers?: RecentActivityCustomer[]
  events?: RecentActivityEvent[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Tarjeta minimizable del panel: nace minimizada, igual que las demás
  // secciones (corrección del dueño, 2026-11-18).
  const [open, setOpen] = useState(false)

  const items: FeedItem[] = [
    ...sales.map((s): FeedItem => {
      const customerName = s.customer_name || 'Cliente'
      const sellerName = s.seller_name || 'Personal'
      return {
        key: `sale-${s.id}`,
        kind: 'sale',
        title: customerName,
        detail: `Registrada por ${sellerName}`,
        expandDetail: `Venta registrada por ${sellerName} · Orden #${orderCodeFromSaleId(s.id)}`,
        created_at: s.created_at,
        amount: s.total,
      }
    }),
    ...exams.map((e): FeedItem => {
      const customerName = e.customer_name || 'Cliente'
      return {
        key: `exam-${e.id}`,
        kind: 'exam',
        title: customerName,
        detail: 'Examen realizado',
        expandDetail: `Examen realizado a ${customerName}`,
        created_at: e.created_at,
      }
    }),
    ...customers
      .filter(c => !!c.created_at && timeOf(c.created_at as string) > 0)
      .map((c): FeedItem => {
        const name = c.full_name || 'Cliente'
        return {
          key: `customer-${c.id}`,
          kind: 'customer',
          title: name,
          detail: 'Se dio de alta como cliente',
          expandDetail: `Cliente nuevo: ${name}`,
          created_at: c.created_at as string,
        }
      }),
    ...events.map((ev): FeedItem => {
      const isBirthday = ev.type === 'birthday_greeting'
      const customerName = ev.customer_name || 'Cliente'
      return {
        key: `event-${ev.id}`,
        kind: isBirthday ? 'birthday' : 'reminder',
        title: customerName,
        detail: isBirthday ? 'Felicitación enviada por WhatsApp' : 'Recordatorio enviado por WhatsApp',
        expandDetail: ev.description,
        created_at: ev.created_at,
      }
    }),
  ]
    .sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at))
    .slice(0, 15)

  return (
    <div className="anim-stagger-item bg-white p-4 rounded-[20px] or-shadow-card text-left" style={{ '--enter-delay': '300ms' } as React.CSSProperties}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full h-[44px] flex items-center gap-2.5 cursor-pointer text-left"
      >
        <span className="w-8 h-8 rounded-lg bg-[#0899c9]/15 text-[#0899c9] flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4" />
        </span>
        <h3 className="flex-1 min-w-0 truncate whitespace-nowrap text-sm font-semibold text-[#111c2d]">Actividad reciente</h3>
        {items.length > 0 && (
          <span className="shrink-0 whitespace-nowrap bg-[#dee8ff] text-[#00357f] text-[10px] font-bold px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (items.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-[#737784] font-bold">Sin actividad registrada.</p>
      ) : (
        <ul className="divide-y divide-[#cbd5e1]/30">
          {items.map(item => {
            const { chip, label, Icon } = KIND_STYLES[item.kind]
            const isOpen = expandedId === item.key
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : item.key)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-2 py-3 min-h-[48px] text-left cursor-pointer"
                >
                  {/* Cliente + detalle corto */}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[13px] text-[#111c2d]">{item.title}</span>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-full font-bold text-[8px] uppercase tracking-wide ${chip}`}>
                        <Icon className="w-3 h-3" />
                        {label}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-[#737784] font-medium mt-0.5">
                      {item.detail}
                    </span>
                  </span>

                  {/* Monto (solo ventas) + fecha/hora al final, a la derecha */}
                  <span className="shrink-0 flex items-center gap-1">
                    <span className="text-right">
                      {typeof item.amount === 'number' && (
                        <span className="inline-block bg-[#dee8ff]/70 text-[#00357f] font-black font-mono text-[11px] px-2 py-0.5 rounded-lg">
                          {formatPrice(item.amount)}
                        </span>
                      )}
                      <span className="block text-[9px] leading-tight text-[#737784] font-medium mt-0.5">
                        {formatShortDate(item.created_at)}
                        <span className="block">{formatTime(item.created_at)}</span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-[#737784] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {/* Fila expandida: todo lo que no cabe en la vista compacta */}
                {isOpen && (
                  <div className="mx-0 mb-2 rounded-xl bg-[#f0f3ff]/60 border border-[#cbd5e1]/40 px-3 py-2.5 text-[10px] space-y-1 animate-in fade-in duration-150">
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[8px] tracking-wider block">Cliente</span>
                      <span className="font-bold text-[#111c2d]">{item.title}</span>
                    </p>
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[8px] tracking-wider block">Detalle</span>
                      {item.expandDetail}
                    </p>
                    <p className="text-[#434653]">
                      <span className="font-bold text-[#737784] uppercase text-[8px] tracking-wider block">Fecha y hora</span>
                      {formatLongDate(item.created_at)} · {formatTime(item.created_at)}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}
