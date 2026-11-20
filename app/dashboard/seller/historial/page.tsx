'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSales, updateSaleStatus } from '@/lib/services'
import PageHeader from '@/components/page-header'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { Database } from '@/types/database.types'
import { ArrowLeft, CheckCircle, History, ShieldAlert } from 'lucide-react'

type Sale = Database['public']['Tables']['sales']['Row']

// One persisted sale_items row as the history cards render it: product
// rows and complement rows (is_complement) of the same sale.
interface SaleItemLine {
  id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  price: number
  is_complement: boolean
  complement_name: string | null
  complement_for: string | null
}

// Historial de ventas: hasta el 2026-11-18 vivía como la vista «taller»
// dentro de Realizar Venta; el dueño pidió pantalla propia enlazada
// desde el menú (Ventas → Historial de ventas) para dejar el POS limpio.
// Mismas lecturas (getSales + el lote de partidas), mismos textos y el
// mismo selector de estatus endurecido de siempre.
//
// Desde el 2026-11-19 el Historial es SOLO lo entregado (dictado del
// dueño): todo lo que sigue en proceso vive en su pantalla hermana,
// «Pedidos en proceso» (Ventas → Pedidos en proceso), y al marcar un
// pedido como Entregado sale de allá y aparece aquí.
export default function SalesHistoryPage() {
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string; items?: SaleItemLine[] })[]>([])
  const [loading, setLoading] = useState(true)
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

  // Sale line items (products + free-text complements) for the history
  // cards. getSales does not join items, so they are read here in one
  // batch and attached to each sale. Any failure (demo mode, or the
  // complements migration not applied yet) leaves the sales untouched
  // and the cards render exactly as before, with no items section.
  const attachSaleItems = async (
    saleList: (Sale & { customer_name?: string; seller_name?: string })[]
  ): Promise<(Sale & { customer_name?: string; seller_name?: string; items?: SaleItemLine[] })[]> => {
    if (saleList.length === 0) return saleList
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, sale_id, product_id, quantity, price, is_complement, complement_name, complement_for, product:products(name)')
        .in('sale_id', saleList.map(s => s.id))
      if (error || !data) return saleList
      const bySale = new Map<string, SaleItemLine[]>()
      for (const row of data as any[]) {
        const line: SaleItemLine = {
          id: row.id,
          product_id: row.product_id ?? null,
          product_name: row.product?.name ?? null,
          quantity: row.quantity ?? 1,
          price: Number(row.price ?? 0),
          is_complement: !!row.is_complement,
          complement_name: row.complement_name ?? null,
          complement_for: row.complement_for ?? null
        }
        const arr = bySale.get(row.sale_id) ?? []
        arr.push(line)
        bySale.set(row.sale_id, arr)
      }
      return saleList.map(s => ({ ...s, items: bySale.get(s.id) ?? [] }))
    } catch {
      return saleList
    }
  }

  const loadSales = async () => {
    try {
      // SOLO entregados: el historial es el archivo de lo ya cerrado;
      // los pedidos vivos están en «Pedidos en proceso».
      const salesData = (await getSales()).filter(s => s.status === 'Entregado')
      setSales(await attachSaleItems(salesData))
    } catch (e) {
      console.error('Error loading sales history:', e)
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

  // Update Workshop status of a sale
  const handleStatusChange = async (saleId: string, newStatus: any) => {
    try {
      const success = await updateSaleStatus(saleId, newStatus)
      if (success) {
        showFeedback('success', 'Estado del trabajo en taller actualizado correctamente.')
        await loadSales()
      } else {
        showFeedback('error', 'No se pudo actualizar el estado de taller.')
      }
    } catch (err) {
      showFeedback('error', 'Error al modificar el estado de taller.')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 space-y-4 md:space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">

      {/* Header chico del sistema, como Reportes y Mensajes.
          En móvil: solo la etiqueta + el volver compacto (PageHeader). */}
      <PageHeader
        title="Historial de ventas"
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
            <History className="w-4.5 h-4.5" />
          </span>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Historial de ventas</h1>
            <p className="text-xs text-[#434653] font-medium">Monitoreo de taller: partidas, complementos y estado de cada venta.</p>
          </div>
        </div>
      </PageHeader>

      {/* Global Feedback Notifications */}
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
          <p className="text-sm text-[#737784] font-bold">Cargando ventas...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Orders list — solo entregados (ver la nota de la página). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sales.length === 0 ? (
              <div className="col-span-full py-20 text-center text-sm text-[#737784] bg-white rounded-[20px] or-shadow-card font-semibold">
                No hay ventas entregadas todavía.
              </div>
            ) : (
              sales.map((sale) => {
                const balance = sale.pending_balance !== undefined ? sale.pending_balance : 0
                const paid = sale.paid_amount !== undefined ? sale.paid_amount : sale.total
                const productLines = (sale.items ?? []).filter(i => !i.is_complement)
                const orphanComplements = (sale.items ?? []).filter(c =>
                  c.is_complement && !productLines.some(i => (i.product_name || '') === (c.complement_for || ''))
                )

                return (
                  <div
                    key={sale.id}
                    className="bg-white rounded-[20px] or-shadow-card p-5 flex flex-col justify-between gap-4 text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-xs text-[#737784] block font-semibold">Orden #{sale.id.slice(2, 8).toUpperCase()}</span>
                          <h3 className="font-extrabold text-base text-[#111c2d] mt-0.5 leading-snug">
                            {sale.customer_name || 'Cliente Externo'}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                          sale.status === 'Cotizacion' ? 'bg-[#dee8ff] text-[#00357f]' :
                          sale.status === 'Anticipo_Pagado' ? 'bg-[#fef3c7] text-[#92400e]' :
                          sale.status === 'En_Taller' ? 'bg-[#fef3c7] text-[#92400e]' :
                          sale.status === 'Listo_Entrega' ? 'bg-[#dee8ff] text-[#00357f]' :
                          'bg-[#e2f9ee] text-[#00422b]'
                        }`}>
                          {sale.status === 'Cotizacion' && 'Cotización'}
                          {sale.status === 'Anticipo_Pagado' && 'Anticipo'}
                          {sale.status === 'En_Taller' && 'En taller'}
                          {sale.status === 'Listo_Entrega' && 'Listo para entrega'}
                          {sale.status === 'Entregado' && 'Entregado'}
                        </span>
                      </div>

                      <div className="h-px bg-[#f0f3ff]" />

                      {/* Financial info */}
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
                          <span className="block text-[#737784] font-semibold text-[11px] mb-0.5">Adeudo</span>
                          <span className={`font-bold tabular-nums ${balance > 0 ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
                            {formatPrice(balance)}
                          </span>
                        </div>
                      </div>

                      {sale.notes && (
                        <p className="text-xs text-[#434653] bg-[#f9f9ff] p-2.5 rounded-xl truncate font-medium" title={sale.notes}>
                          <strong>Nota:</strong> {sale.notes}
                        </p>
                      )}

                      {/* Sold items with their free-text complements */}
                      {sale.items && sale.items.length > 0 && (
                        <div className="space-y-1.5 bg-[#f9f9ff] p-2.5 rounded-xl text-xs">
                          {productLines.map(line => (
                            <div key={line.id}>
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold text-[#111c2d]">{line.product_name || 'Producto'}</span>
                                <span className="tabular-nums text-[#434653] shrink-0">{line.quantity} × {formatPrice(line.price)}</span>
                              </div>
                              {(sale.items ?? []).filter(c => c.is_complement && (c.complement_for || '') === (line.product_name || '')).map(c => (
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

                    {/* ACTION SELECT ENGINE FOR WORKSHOP */}
                    <div className="space-y-1.5 pt-2 border-t border-[#f0f3ff]">
                      <label className="block text-xs font-semibold text-[#434653]">
                        Cambiar Estado de Laboratorio
                      </label>

                      <select
                        value={sale.status}
                        onChange={(e) => handleStatusChange(sale.id, e.target.value)}
                        className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2 text-sm text-[#111c2d] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] font-semibold cursor-pointer transition-colors"
                      >
                        <option value="Cotizacion">Cotización (Sin pago)</option>
                        <option value="Anticipo_Pagado">Anticipo Pagado (Espera taller)</option>
                        <option value="En_Taller">En Taller (Laboratorio)</option>
                        <option value="Listo_Entrega">Listo para Entrega</option>
                        <option value="Entregado">Entregado al Cliente</option>
                      </select>
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
