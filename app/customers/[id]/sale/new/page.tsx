'use client'

import * as React from 'react'
import { useEffect, useState, useActionState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getProducts } from '@/lib/services'
import { createLinkedSaleAction, CreateSaleState } from '@/app/customers/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

const initialState: CreateSaleState = { error: null, success: null }

export default function NewLinkedSalePage({ params }: PageProps) {
  const { id: customerId } = React.use(params)
  const router = useRouter()

  const [customer, setCustomer] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // POS State
  const [cart, setCart] = useState<{ productId: string; name: string; price: number; quantity: number }[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [couponCode, setCouponCode] = useState('')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const [state, formAction, isPending] = useActionState<CreateSaleState, FormData>(createLinkedSaleAction, initialState)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [custData, examsData, productsData] = await Promise.all([
        getCustomerById(customerId),
        getCustomerExams(customerId),
        getProducts(),
      ])
      setCustomer(custData)
      setExams(examsData)
      setProducts(productsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        router.push(`/customers/${customerId}`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state?.success, customerId, router])

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId))
    } else {
      setCart(prev =>
        prev.map(item => (item.productId === productId ? { ...item, quantity } : item))
      )
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId))
  }

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Cargando catálogo y datos del cliente...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">El paciente no fue encontrado</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
            Volver a pacientes
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24">
      {/* Background glow */}
      <div className="fixed top-20 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/customers/${customerId}`} className="w-9 h-9 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Punto de Venta (POS)</h1>
            <p className="text-xs text-slate-500 mt-0.5">Vincular venta a: <strong className="text-slate-300">{customer.full_name}</strong></p>
          </div>
        </div>

        {/* Feedback Messages */}
        {state?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-400">¡Venta registrada con éxito!</p>
              <p className="text-xs text-emerald-500/80 mt-1">{state.success}</p>
              <p className="text-xs text-emerald-600 mt-1">Redirigiendo de vuelta al expediente del cliente...</p>
            </div>
          </div>
        )}
        {state?.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-rose-400">{state.error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CATALOG SECTOR (Lg: 7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Catálogo de Productos</h2>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="frames">Armazones</option>
                  <option value="lenses">Micas / Lentes Graduados</option>
                  <option value="contact_lenses">Lentes de Contacto</option>
                  <option value="accessories">Accesorios</option>
                </select>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center sm:col-span-2">No se encontraron productos en catálogo.</p>
                ) : (
                  filteredProducts.map(p => (
                    <div key={p.id} className="bg-slate-950/60 border border-slate-850 hover:border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between transition-all group">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-xs text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-1">{p.name}</h3>
                          <span className="text-[9px] bg-slate-800 text-slate-400 font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0">
                            {p.category === 'frames' ? 'Armazón' : p.category === 'lenses' ? 'Micas' : p.category === 'contact_lenses' ? 'Contacto' : 'Accesorio'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{p.description || 'Sin descripción'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-900/60">
                        <div>
                          <span className="text-[9px] text-slate-600 block uppercase font-bold">Precio</span>
                          <span className="font-mono font-bold text-xs text-slate-200">${p.price.toFixed(2)} MXN</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-800 text-slate-300 text-[10px] font-black px-3.5 py-1.5 rounded-lg transition-all"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SHOPPING CART / CHECKOUT (Lg: 5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form action={formAction} className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Resumen del Carrito</h2>

              {/* Hidden Inputs for Form */}
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="examId" value={selectedExamId} />
              <input type="hidden" name="couponCode" value={couponCode} />
              <input type="hidden" name="notes" value={notes} />
              <input type="hidden" name="items" value={JSON.stringify(cart)} />

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className="bg-slate-950/40 border border-slate-900 rounded-2xl py-12 text-center text-xs text-slate-600 font-medium">
                  El carrito está vacío. Agrega productos desde el catálogo.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.productId} className="flex justify-between items-center bg-slate-950/60 border border-slate-850 px-3.5 py-2.5 rounded-xl text-xs gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-200 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">${item.price.toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-6 h-6 bg-slate-900 hover:bg-slate-800 rounded-md text-slate-400 font-extrabold flex items-center justify-center border border-slate-800"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-slate-200 w-6 text-center select-none">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-6 h-6 bg-slate-900 hover:bg-slate-800 rounded-md text-slate-400 font-extrabold flex items-center justify-center border border-slate-800"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className="text-rose-500 hover:text-rose-400 font-semibold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Linking to clinical exam */}
              {exams.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Vincular a Examen Clínico (Opcional)
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={e => setSelectedExamId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-350 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                  >
                    <option value="">No vincular a examen</option>
                    {exams.map((ex, i) => (
                      <option key={ex.id} value={ex.id}>
                        Examen #{exams.length - i} ({new Date(ex.exam_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}) - {ex.lens_type || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Coupon input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Aplicar Cupón de Descuento
                </label>
                <input
                  type="text"
                  placeholder="Ej. RAYO20"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all font-mono tracking-widest"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Notas de la Venta
                </label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de pago, fecha de entrega..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all resize-none"
                />
              </div>

              {/* Subtotals & Total */}
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-900/60 text-xs space-y-2">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">${subtotal.toFixed(2)} MXN</span>
                </div>
                <div className="flex justify-between font-bold text-slate-200 border-t border-slate-900/80 pt-2 text-sm">
                  <span>Total estimado:</span>
                  <span className="font-mono text-cyan-400">${subtotal.toFixed(2)} MXN</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal pt-1 text-center">
                  * Los cupones se validan en el servidor al confirmar la venta.
                </p>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isPending || cart.length === 0 || !!state?.success}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-500/10 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase"
              >
                {isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Registrando venta...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Confirmar y Registrar Venta
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
