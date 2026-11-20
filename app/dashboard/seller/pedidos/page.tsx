'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getSales,
  updateSaleStatus,
  getSaleItemsForSales,
  getCustomerPhonesByIds,
  getCustomerInstallments,
  getMessageTemplate,
  getMessageSends,
  logMessageSend,
  type SaleItemLine,
  type MessageSendEntry,
} from '@/lib/services'
import PageHeader from '@/components/page-header'
import { Database } from '@/types/database.types'
import {
  ORDER_READY_TEMPLATE_KEY,
  buildOrderReadyMessage,
  buildOrderReadyDetail,
} from '@/lib/message-templates'
import { derivePlanSummary, type StoredInstallment } from '@/lib/payment-plan'
import { orderCodeFromSaleId } from '@/lib/ticket'
import { toWhatsAppNumber } from '@/lib/phone'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  MessageSquare,
  ShieldAlert,
  Undo2,
} from 'lucide-react'

type Sale = Database['public']['Tables']['sales']['Row']

type FlowStatus = 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado'

// El flujo del pedido (dictado del dueño, 2026-11-19): la tarjeta mueve
// el pedido UN paso adelante o uno atrás si hubo error; al llegar a
// Entregado el pedido sale de esta pantalla y entra al Historial.
const STATUS_FLOW: FlowStatus[] = [
  'Cotizacion',
  'Anticipo_Pagado',
  'En_Taller',
  'Listo_Entrega',
  'Entregado',
]

const STATUS_LABELS: Record<FlowStatus, string> = {
  Cotizacion: 'Cotización',
  Anticipo_Pagado: 'Anticipo',
  En_Taller: 'En taller',
  Listo_Entrega: 'Listo para entrega',
  Entregado: 'Entregado',
}

const STATUS_BADGE: Record<FlowStatus, string> = {
  Cotizacion: 'bg-[#dee8ff] text-[#00357f]',
  Anticipo_Pagado: 'bg-[#fef3c7] text-[#92400e]',
  En_Taller: 'bg-[#fef3c7] text-[#92400e]',
  Listo_Entrega: 'bg-[#dee8ff] text-[#00357f]',
  Entregado: 'bg-[#e2f9ee] text-[#00422b]',
}

interface PedidoSale extends Sale {
  customer_name?: string
  items?: SaleItemLine[]
  phone?: string | null
  installments?: StoredInstallment[]
}

type StatusFilter = 'Todos' | FlowStatus

// «Pedidos en proceso» (dictado del dueño, 2026-11-19): la pantalla
// hermana del Historial — aquí vive TODO lo que aún no se entrega
// (cotización, anticipo, taller, listo), con su estatus movible paso a
// paso y, cuando el pedido queda listo, el botón de WhatsApp «Avisar
// que está listo» con la plantilla editable de Mensajes. La ruta cuelga
// de /dashboard/seller: el proxy la protege con el mismo rol que el
// Historial (administrador y vendedor; ni cliente ni optometrista).
export default function PedidosEnProcesoPage() {
  const [sales, setSales] = useState<PedidoSale[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos')
  const [template, setTemplate] = useState('')
  const [sendsBySale, setSendsBySale] = useState<Map<string, MessageSendEntry>>(new Map())
  const [changingId, setChangingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const showFeedback = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(''), 4500)
    } else {
      setErrorMessage(message)
      setTimeout(() => setErrorMessage(''), 4500)
    }
  }

  const loadSales = async () => {
    try {
      const inProcess = (await getSales()).filter(s => s.status !== 'Entregado')
      const saleIds = inProcess.map(s => s.id)
      const customerIds = inProcess
        .map(s => s.customer_id)
        .filter((id): id is string => !!id)
      const [itemsMap, phonesMap, allInstallments, readyTemplate, sends] =
        await Promise.all([
          getSaleItemsForSales(saleIds),
          getCustomerPhonesByIds(customerIds),
          getCustomerInstallments(),
          getMessageTemplate(ORDER_READY_TEMPLATE_KEY),
          getMessageSends('order_ready', { limit: 200 }),
        ])

      const installmentsBySale = new Map<string, StoredInstallment[]>()
      for (const inst of allInstallments as any[]) {
        if (!inst?.sale_id) continue
        const arr = installmentsBySale.get(inst.sale_id) ?? []
        arr.push({
          installment_number: inst.installment_number ?? null,
          due_date: inst.due_date,
          amount: Number(inst.amount ?? 0),
          amount_paid: inst.amount_paid ?? null,
          status: inst.status ?? null,
        })
        installmentsBySale.set(inst.sale_id, arr)
      }

      // El sello pinta el aviso MÁS reciente por venta (la lectura ya
      // viene de más nuevo a más viejo: el primero que cae es el bueno).
      const latestBySale = new Map<string, MessageSendEntry>()
      for (const entry of sends) {
        if (entry.sale_id && !latestBySale.has(entry.sale_id)) {
          latestBySale.set(entry.sale_id, entry)
        }
      }
      setSendsBySale(latestBySale)
      setTemplate(readyTemplate)
      setSales(
        inProcess.map(s => ({
          ...s,
          items: itemsMap.get(s.id) ?? [],
          phone: s.customer_id ? phonesMap.get(s.customer_id) ?? null : null,
          installments: installmentsBySale.get(s.id) ?? [],
        }))
      )
    } catch (e) {
      console.error('Error loading pedidos en proceso:', e)
    }
  }

  useEffect(() => {
    async function initLoad() {
      setLoading(true)
      await loadSales()
      setLoading(false)
    }
    initLoad()
  }, [])

  // Pastillas: «Todos» + solo los estatus que sí tienen pedidos.
  const presentStatuses = useMemo(() => {
    const present = new Set(sales.map(s => s.status))
    return STATUS_FLOW.filter(st => st !== 'Entregado' && present.has(st))
  }, [sales])

  const filteredSales = useMemo(() => {
    if (statusFilter === 'Todos') return sales
    return sales.filter(s => s.status === statusFilter)
  }, [sales, statusFilter])

  const handleStatusStep = async (sale: PedidoSale, next: FlowStatus) => {
    setChangingId(sale.id)
    try {
      const success = await updateSaleStatus(sale.id, next)
      if (success) {
        showFeedback(
          'success',
          next === 'Entregado'
            ? 'Pedido entregado: salió de esta lista y ya está en el Historial de ventas.'
            : `Pedido movido a «${STATUS_LABELS[next]}».`
        )
        await loadSales()
      } else {
        showFeedback('error', 'No se pudo actualizar el estatus del pedido.')
      }
    } catch {
      showFeedback('error', 'Error al modificar el estatus del pedido.')
    } finally {
      setChangingId(null)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(price)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 space-y-4 md:space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      <PageHeader
        title="Pedidos en proceso"
        mobileActions={
          <Link href="/dashboard/seller" aria-label="Volver a Realizar Venta" className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
        }
      >
        <div className="flex items-center gap-2.5 border-b border-[#e7eeff] pb-3">
          <Link href="/dashboard/seller" aria-label="Volver a Realizar Venta" className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <ClipboardList className="w-4.5 h-4.5" />
          </span>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Pedidos en proceso</h1>
            <p className="text-xs text-[#434653] font-medium">Todo lo que aún no se entrega: en qué paso va cada pedido y el aviso de «listo» al cliente.</p>
          </div>
        </div>
      </PageHeader>

      {successMessage && (
        <div className="bg-[#e2f9ee] border border-[#00422b]/20 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[#00422b] shrink-0" />
          <p className="text-sm font-semibold text-[#00422b]">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/25 rounded-2xl p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
          <p className="text-sm font-semibold text-[#ba1a1a]">{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-sm text-[#737784] font-bold">Cargando pedidos...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filtros por estatus: solo los estatus con pedidos vivos. */}
          <div className="flex w-full gap-1 sm:gap-2" role="tablist" aria-label="Filtrar por estatus">
            {[{ id: 'Todos' as StatusFilter, label: 'Todos' },
              ...presentStatuses.map(st => ({ id: st as StatusFilter, label: STATUS_LABELS[st] })),
            ].map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex-1 min-w-0 whitespace-nowrap px-1 sm:px-3 py-2 text-[10px] min-[420px]:text-[11px] sm:text-xs font-semibold rounded-full border transition-all cursor-pointer min-h-[40px] flex items-center justify-center ${
                  statusFilter === tab.id
                    ? 'bg-[#00357f] border-[#00357f] text-white font-bold'
                    : 'bg-white border-[#dee8ff] text-[#737784] hover:bg-[#f9f9ff]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSales.length === 0 ? (
              <div className="col-span-full py-20 text-center text-sm text-[#737784] bg-white rounded-[20px] or-shadow-card font-semibold">
                No hay pedidos en proceso bajo este estatus.
              </div>
            ) : (
              filteredSales.map(sale => {
                const status = sale.status as FlowStatus
                const balance = sale.pending_balance ?? 0
                const paid = sale.paid_amount ?? 0
                const stepIndex = STATUS_FLOW.indexOf(status)
                const prevStatus = stepIndex > 0 ? STATUS_FLOW[stepIndex - 1] : null
                const nextStatus =
                  stepIndex >= 0 && stepIndex < STATUS_FLOW.length - 1
                    ? STATUS_FLOW[stepIndex + 1]
                    : null
                const productLines = (sale.items ?? []).filter(i => !i.is_complement)
                const orphanComplements = (sale.items ?? []).filter(
                  c =>
                    c.is_complement &&
                    !productLines.some(i => (i.product_name || '') === (c.complement_for || ''))
                )

                // «Avisar que está listo»: solo con el pedido en
                // Listo_Entrega. El mensaje sale de la plantilla
                // editable de Mensajes y el {detalle_pago} se compone
                // del estado real de ESTA venta (plan / saldo / pagado).
                const waNumber =
                  status === 'Listo_Entrega' ? toWhatsAppNumber(sale.phone) : null
                let waHref: string | null = null
                if (status === 'Listo_Entrega' && waNumber) {
                  const plan = derivePlanSummary(sale.installments ?? [])
                  const detail = buildOrderReadyDetail({
                    anticipo: paid,
                    saldo: balance,
                    plan: plan
                      ? {
                          installments: plan.pendingCount,
                          frequency: plan.frequency,
                          installmentAmount: plan.installmentAmount,
                          firstPaymentDate: plan.firstPendingDate,
                        }
                      : null,
                  })
                  const message = buildOrderReadyMessage(template, {
                    nombre: sale.customer_name || 'Cliente',
                    orden: orderCodeFromSaleId(sale.id),
                    anticipo: formatPrice(paid),
                    saldo: formatPrice(balance),
                    detalle_pago: detail,
                  })
                  waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
                }
                const lastSend = sendsBySale.get(sale.id)

                return (
                  <div
                    key={sale.id}
                    className="bg-white rounded-[20px] or-shadow-card p-5 flex flex-col justify-between gap-4 text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-xs text-[#737784] block font-semibold">
                            Orden #{orderCodeFromSaleId(sale.id)} · {formatDate(sale.created_at)}
                          </span>
                          {sale.customer_id ? (
                            <Link
                              href={`/customers/${sale.customer_id}`}
                              className="font-extrabold text-base text-[#111c2d] mt-0.5 leading-snug block hover:text-[#00357f] transition-colors"
                            >
                              {sale.customer_name || 'Cliente Externo'}
                            </Link>
                          ) : (
                            <h3 className="font-extrabold text-base text-[#111c2d] mt-0.5 leading-snug">
                              {sale.customer_name || 'Cliente Externo'}
                            </h3>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${STATUS_BADGE[status] ?? STATUS_BADGE.Cotizacion}`}
                        >
                          {STATUS_LABELS[status] ?? sale.status}
                        </span>
                      </div>

                      <div className="h-px bg-[#f0f3ff]" />

                      <div className="grid grid-cols-3 gap-2 text-sm text-center font-medium">
                        <div className="bg-[#f9f9ff] p-2.5 rounded-xl">
                          <span className="block text-[#737784] font-semibold text-[11px] mb-0.5">Total</span>
                          <span className="font-bold text-[#111c2d] tabular-nums">{formatPrice(sale.total)}</span>
                        </div>
                        <div className="bg-[#f9f9ff] p-2.5 rounded-xl">
                          <span className="block text-[#737784] font-semibold text-[11px] mb-0.5">Anticipo</span>
                          <span className="font-bold text-[#00422b] tabular-nums">{formatPrice(paid)}</span>
                        </div>
                        <div className="bg-[#f9f9ff] p-2.5 rounded-xl">
                          <span className="block text-[#737784] font-semibold text-[11px] mb-0.5">Saldo</span>
                          {balance > 0 ? (
                            <span className="font-bold tabular-nums text-[#ba1a1a]">{formatPrice(balance)}</span>
                          ) : (
                            <span className="inline-block bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[11px]">Pagado</span>
                          )}
                        </div>
                      </div>

                      {sale.items && sale.items.length > 0 && (
                        <div className="space-y-1.5 bg-[#f9f9ff] p-2.5 rounded-xl text-xs">
                          {productLines.map(line => (
                            <div key={line.id}>
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold text-[#111c2d]">
                                  {line.quantity} × {line.product_name || 'Producto'}
                                </span>
                                <span className="tabular-nums text-[#434653] shrink-0">
                                  {formatPrice(line.price * line.quantity)}
                                </span>
                              </div>
                              {(sale.items ?? [])
                                .filter(c => c.is_complement && (c.complement_for || '') === (line.product_name || ''))
                                .map(c => (
                                  <div key={c.id} className="flex justify-between items-center gap-2 pl-3 pt-0.5">
                                    <span className="text-[#434653] font-medium">
                                      Complemento: <strong className="text-[#111c2d]">{c.complement_name || 'Complemento'}</strong>
                                    </span>
                                    {c.price > 0 ? (
                                      <span className="tabular-nums text-[#434653] shrink-0">{formatPrice(c.price * c.quantity)}</span>
                                    ) : (
                                      <span className="bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0">Gratis</span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          ))}
                          {orphanComplements.map(c => (
                            <div key={c.id} className="flex justify-between items-center gap-2">
                              <span className="text-[#434653] font-medium">
                                Complemento: <strong className="text-[#111c2d]">{c.complement_name || 'Complemento'}</strong>
                              </span>
                              {c.price > 0 ? (
                                <span className="tabular-nums text-[#434653] shrink-0">{formatPrice(c.price * c.quantity)}</span>
                              ) : (
                                <span className="bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0">Gratis</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-[#f0f3ff]">
                      {/* Mover el pedido en el flujo: un paso adelante
                          (botón principal) o uno atrás si hubo error. */}
                      <div className="flex gap-2">
                        {prevStatus && (
                          <button
                            type="button"
                            disabled={changingId === sale.id}
                            onClick={() => handleStatusStep(sale, prevStatus)}
                            className="flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-xl border border-[#dee8ff] bg-white text-[#434653] text-xs font-bold hover:bg-[#f9f9ff] transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            {STATUS_LABELS[prevStatus]}
                          </button>
                        )}
                        {nextStatus && (
                          <button
                            type="button"
                            disabled={changingId === sale.id}
                            onClick={() => handleStatusStep(sale, nextStatus)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-[#00357f] hover:bg-[#00509e] text-white text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            Pasar a {STATUS_LABELS[nextStatus]}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Aviso de «listo» por WhatsApp (solo Listo_Entrega). */}
                      {status === 'Listo_Entrega' && (
                        <div className="space-y-1.5">
                          {waHref ? (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                // El aviso queda registrado
                                // (message_send_log, kind order_ready) y
                                // el sello se pinta al momento; el
                                // registro NUNCA bloquea la apertura de
                                // WhatsApp.
                                if (!sale.customer_id) return
                                void logMessageSend('order_ready', {
                                  customerId: sale.customer_id,
                                  saleId: sale.id,
                                }).then(entry => {
                                  if (entry) {
                                    setSendsBySale(prev => new Map(prev).set(sale.id, entry))
                                  }
                                })
                              }}
                              className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Avisar que está listo
                            </a>
                          ) : (
                            <p className="text-[11px] font-bold text-[#92400e] bg-[#fef3c7] rounded-lg px-2.5 py-2">
                              Sin teléfono registrado: no se puede avisar por WhatsApp.
                            </p>
                          )}
                          {lastSend && (
                            <p className="text-[11px] font-bold text-[#00422b]">
                              Cliente avisado por {lastSend.sent_by_name} ·{' '}
                              {new Date(lastSend.sent_at)
                                .toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                                .replace(/\.$/, '')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </main>
  )
}
