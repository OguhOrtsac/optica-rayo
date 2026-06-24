'use client'

import { useEffect, useState } from 'react'
import { getProducts, createSale, getReminders } from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']

interface CartItem {
  product: Product
  quantity: number
}

export default function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [reminders, setReminders] = useState<(Reminder & { customer_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      const [productsData, remindersData] = await Promise.all([
        getProducts(),
        getReminders()
      ])
      setProducts(productsData)
      setReminders(remindersData)
      setLoading(false)
    }
    loadData()
  }, [])

  const reloadData = async () => {
    const [productsData, remindersData] = await Promise.all([
      getProducts(),
      getReminders()
    ])
    setProducts(productsData)
    setReminders(remindersData)
  }

  // Filter products for POS
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.stock > 0
  )

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock) {
        setErrorMessage(`No puedes vender más de ${product.stock} unidades de este producto (límite de inventario).`)
        setTimeout(() => setErrorMessage(''), 3000)
        return
      }
      setCart(cart.map(item => 
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ))
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, qty: number) => {
    const item = cart.find(i => i.product.id === productId)
    if (!item) return
    if (qty > item.product.stock) {
      setErrorMessage(`Solo hay ${item.product.stock} unidades disponibles.`)
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }
    if (qty <= 0) {
      removeFromCart(productId)
    } else {
      setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
    }
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      setErrorMessage('Debes ingresar el nombre del cliente para registrar la venta y crear sus recordatorios.')
      setTimeout(() => setErrorMessage(''), 4000)
      return
    }
    if (cart.length === 0) {
      setErrorMessage('El carrito está vacío.')
      setTimeout(() => setErrorMessage(''), 3000)
      return
    }

    setSubmitting(true)
    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }))

      await createSale(customerName, items)
      
      setSuccessMessage('¡Venta registrada con éxito! El stock ha sido actualizado y se programó un recordatorio visual automático para dentro de 12 meses.')
      setCart([])
      setCustomerName('')
      await reloadData()
      setTimeout(() => setSuccessMessage(''), 6000)
    } catch (e) {
      setErrorMessage('Ocurrió un error al procesar la venta.')
      setTimeout(() => setErrorMessage(''), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 space-y-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Terminal Punto de Venta (POS)
          </h1>
          <p className="text-sm text-slate-400">
            Registra transacciones de clientes y programa sus citas preventivas automáticamente.
          </p>
        </div>

        {/* Success/Error Alerts */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
            <svg className="w-6 h-6 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-emerald-400 leading-normal">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <svg className="w-6 h-6 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-rose-400 leading-normal">{errorMessage}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
            <p className="text-sm text-slate-500">Cargando catálogo de venta...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Product Selector */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">Productos Disponibles</h2>
                
                {/* Search Product */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Buscador rápido de stock..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                  />
                </div>

                {/* Product Grid inside Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="bg-slate-950/60 border border-slate-900 hover:border-cyan-500/40 rounded-xl p-4 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer hover:shadow hover:shadow-cyan-950/5 group"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            {p.category === 'frames' && 'Armazón'}
                            {p.category === 'lenses' && 'Mica'}
                            {p.category === 'contact_lenses' && 'Lente'}
                            {p.category === 'accessories' && 'Accesorio'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            p.stock < 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-900 text-slate-400'
                          }`}>
                            Stock: {p.stock}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                          {p.name}
                        </h3>
                      </div>
                      <div className="mt-4 flex justify-between items-center w-full">
                        <span className="text-xs text-slate-500">Precio</span>
                        <span className="text-sm font-extrabold text-slate-100">{formatPrice(p.price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Checkout Cart */}
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between min-h-[450px] shadow-xl relative">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">Carrito de Compra</h2>
                    <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-2.5 py-0.5 rounded-full font-bold">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)} Artículos
                    </span>
                  </div>

                  <div className="h-px bg-slate-900" />

                  {/* Cart Items List */}
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-slate-550 text-xs">
                      Selecciona artículos a la izquierda para agregarlos al carrito.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex justify-between items-center bg-slate-950/40 border border-slate-900 rounded-xl p-3 text-xs">
                          <div className="space-y-1 max-w-[140px]">
                            <h4 className="font-bold text-slate-200 truncate">{item.product.name}</h4>
                            <p className="text-slate-500">{formatPrice(item.product.price)} c/u</p>
                          </div>
                          
                          {/* Quantity selector */}
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 bg-slate-900 hover:bg-slate-800 rounded flex items-center justify-center cursor-pointer font-bold"
                            >
                              -
                            </button>
                            <span className="font-semibold text-slate-200 text-xs">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 bg-slate-900 hover:bg-slate-800 rounded flex items-center justify-center cursor-pointer font-bold"
                            >
                              +
                            </button>
                          </div>

                          <span className="font-bold text-slate-200 min-w-[70px] text-right">
                            {formatPrice(item.product.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Billing details Form */}
                <form onSubmit={handleCheckout} className="mt-8 pt-4 border-t border-slate-900 space-y-4">
                  <div>
                    <label htmlFor="customer" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Nombre del Cliente
                    </label>
                    <input
                      id="customer"
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold text-slate-300">
                    <span>Total a Cobrar</span>
                    <span className="text-lg font-black text-cyan-400">{formatPrice(calculateTotal())}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={cart.length === 0 || submitting}
                    className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs shadow-md shadow-cyan-500/10 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Procesando...' : 'Registrar Venta & Crear Recordatorio'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* Reminders Monitoring Table */}
        <section className="bg-slate-900/25 border border-slate-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Monitoreo de Próximas Citas y Recordatorios
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Última Revisión</th>
                  <th className="py-3 px-4">Revisión Sugerida</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950">
                {reminders.map((rem) => {
                  const overdue = new Date(rem.next_suggested_visit).getTime() < Date.now()
                  return (
                    <tr key={rem.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-350">{rem.customer_name || 'Desconocido'}</td>
                      <td className="py-3 px-4 text-slate-450">{new Date(rem.last_visit_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-semibold">{new Date(rem.next_suggested_visit).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          overdue ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {overdue ? 'Atrasada' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  )
}
