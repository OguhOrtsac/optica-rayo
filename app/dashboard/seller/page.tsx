'use client'

import { useEffect, useState } from 'react'
import { 
  getProducts, 
  createSale, 
  getReminders, 
  searchCustomers, 
  getCoupons, 
  getSales, 
  updateSaleStatus 
} from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']
type Coupon = Database['public']['Tables']['coupons']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

interface CartItem {
  product: Product
  quantity: number
}

interface CustomerProfile {
  id: string
  full_name: string
  email: string
  customer_profiles?: {
    phone: string | null
  } | null
}

export default function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [reminders, setReminders] = useState<(Reminder & { customer_name?: string })[]>([])
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string })[]>([])
  
  const [loading, setLoading] = useState(true)
  
  // View mode: 'pos' (Nueva Venta) or 'taller' (Monitoreo de Taller)
  const [viewMode, setViewMode] = useState<'pos' | 'taller'>('pos')
  
  // Mobile active tab for POS mode ('products' or 'cart')
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products')
  
  // Search and autocomplete states
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null)
  
  // Cart & Checkout states
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [saleNotes, setSaleNotes] = useState('')
  
  // Taller Filter state
  const [tallerFilter, setTallerFilter] = useState<'Todos' | 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado'>('Todos')
  
  // Messages states
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadAllData = async () => {
    try {
      const [productsData, remindersData, customersData, couponsData, salesData] = await Promise.all([
        getProducts(),
        getReminders(),
        searchCustomers(''),
        getCoupons(),
        getSales()
      ])
      setProducts(productsData)
      setReminders(remindersData)
      setCustomers(customersData)
      setCoupons(couponsData)
      setSales(salesData)
    } catch (e) {
      console.error('Error loading POS data:', e)
    }
  }

  useEffect(() => {
    async function initLoad() {
      setLoading(true)
      await loadAllData()
      setLoading(false)
    }
    initLoad()
  }, [])

  // Filter products locally
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase())) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  )

  // Filter customer suggestions based on text input
  const filteredCustomers = customers.filter(c => 
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.customer_profiles?.phone && c.customer_profiles.phone.includes(customerSearch))
  )

  // Filter sales for the workshop monitor
  const filteredSales = sales.filter(s => {
    if (tallerFilter === 'Todos') return true
    return s.status === tallerFilter
  })

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock) {
        showFeedback('error', `Inventario insuficiente. Solo quedan ${product.stock} unidades de este producto.`)
        return
      }
      setCart(cart.map(item => 
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ))
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
    showFeedback('success', `"${product.name}" agregado al carrito.`)
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, qty: number) => {
    const item = cart.find(i => i.product.id === productId)
    if (!item) return
    if (qty > item.product.stock) {
      showFeedback('error', `Solo hay ${item.product.stock} unidades disponibles en inventario.`)
      return
    }
    if (qty <= 0) {
      removeFromCart(productId)
    } else {
      setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
    }
  }

  // Real-time mathematics
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  
  // Validate and apply coupon
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponCode.trim()) return

    const matched = coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase())
    if (matched && matched.is_active && new Date(matched.valid_until) > new Date()) {
      setActiveCoupon(matched)
      showFeedback('success', `Cupón "${matched.code}" aplicado con ${matched.discount_percent}% de descuento.`)
    } else {
      setActiveCoupon(null)
      showFeedback('error', 'El cupón no es válido o ha expirado.')
    }
  }

  const discount = activeCoupon ? subtotal * (activeCoupon.discount_percent / 100) : 0
  const taxableBase = subtotal - discount
  const netSubtotal = taxableBase / 1.16
  const iva = taxableBase - netSubtotal
  const total = taxableBase

  // Payment inputs and balance calculations
  const paidAmount = parseFloat(paidAmountInput) || 0
  const pendingBalance = Math.max(0, total - paidAmount)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(''), 4500)
    } else {
      setErrorMessage(message)
      setTimeout(() => setErrorMessage(''), 4500)
    }
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const nameToRegister = selectedCustomer ? selectedCustomer.full_name : customerSearch.trim()
    if (!nameToRegister) {
      showFeedback('error', 'Debes ingresar el nombre o buscar un paciente registrado.')
      return
    }
    if (cart.length === 0) {
      showFeedback('error', 'El carrito de compras está vacío.')
      return
    }
    if (paidAmountInput !== '' && paidAmount < 0) {
      showFeedback('error', 'El monto recibido no puede ser negativo.')
      return
    }

    setSubmitting(true)
    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }))

      // Register sale with Supabase or mock fallback
      await createSale(nameToRegister, items, paidAmount || total, paymentMethod)
      
      showFeedback('success', '¡Venta registrada exitosamente! El inventario se actualizó y se programó la cita de revisión.')
      
      // Clear POS state
      setCart([])
      setCustomerSearch('')
      setSelectedCustomer(null)
      setPaidAmountInput('')
      setCouponCode('')
      setActiveCoupon(null)
      setSaleNotes('')
      setActiveTab('products')
      
      await loadAllData()
    } catch (e) {
      showFeedback('error', 'Ocurrió un error al procesar la transacción.')
    } finally {
      setSubmitting(false)
    }
  }

  // Update Workshop status of a sale
  const handleStatusChange = async (saleId: string, newStatus: any) => {
    try {
      const success = await updateSaleStatus(saleId, newStatus)
      if (success) {
        showFeedback('success', 'Estado del trabajo en taller actualizado correctamente.')
        await loadAllData()
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
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 pb-24 relative">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header and View Mode Toggles */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Terminal POS + Monitoreo de Taller
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Terminal unificada para registro de ventas, control de inventario y estado clínico en taller.
            </p>
          </div>

          {/* Tab Selector: POS vs Taller */}
          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/40 w-full md:w-auto">
            <button
              onClick={() => setViewMode('pos')}
              className={`flex-1 md:flex-none text-xs font-black px-5 py-3 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                viewMode === 'pos'
                  ? 'bg-gradient-to-tr from-cyan-500/25 to-indigo-500/25 border border-cyan-500/40 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Terminal POS
            </button>
            <button
              onClick={() => setViewMode('taller')}
              className={`flex-1 md:flex-none text-xs font-black px-5 py-3 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                viewMode === 'taller'
                  ? 'bg-gradient-to-tr from-cyan-500/25 to-indigo-500/25 border border-cyan-500/40 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monitoreo Taller ({sales.filter(s => s.status !== 'Entregado').length})
            </button>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-bold text-emerald-400">{successMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-bold text-rose-400">{errorMessage}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500 font-bold">Cargando base de datos unificada...</p>
          </div>
        ) : (
          <>
            {/* VIEW MODE: TERMINAL POS */}
            {viewMode === 'pos' && (
              <>
                {/* Mobile Tabs Header */}
                <div className="grid grid-cols-2 gap-2 bg-slate-900/30 p-1 rounded-xl border border-slate-800/40 md:hidden">
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'products' ? 'bg-slate-900 border border-slate-800 text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    1. Catálogo ({filteredProducts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('cart')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'cart' ? 'bg-slate-900 border border-slate-800 text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    2. Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* LEFT: PRODUCTS SEARCH & STOCK HIGHLIGHT */}
                  <div className={`md:col-span-2 space-y-4 ${activeTab === 'products' ? 'block' : 'hidden md:block'}`}>
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Productos Disponibles</h2>
                        <span className="text-[10px] bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-slate-500 font-bold">
                          Filtro en Vivo
                        </span>
                      </div>

                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          placeholder="Buscar por código, nombre o tipo de lente..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all min-h-[44px]"
                        />
                      </div>

                      {/* Products Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-1">
                        {filteredProducts.length === 0 ? (
                          <div className="col-span-full py-16 text-center text-xs text-slate-650">
                            No hay productos coincidentes en el inventario.
                          </div>
                        ) : (
                          filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => addToCart(p)}
                              disabled={p.stock <= 0}
                              className="bg-slate-955/40 border border-slate-900 hover:border-cyan-500/30 rounded-2xl p-4 text-left flex flex-col justify-between transition-all hover:scale-[1.01] hover:bg-slate-950 cursor-pointer min-h-[145px] group disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <div className="w-full space-y-1">
                                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                  <span>
                                    {p.category === 'frames' && 'Armazón'}
                                    {p.category === 'lenses' && 'Mica'}
                                    {p.category === 'contact_lenses' && 'Contacto'}
                                    {p.category === 'accessories' && 'Accesorio'}
                                  </span>
                                  
                                  {/* CRITICAL STOCK HIGHLIGHT (Stock <= 3) */}
                                  {p.stock <= 3 ? (
                                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-black animate-pulse">
                                      Stock Crítico: {p.stock}
                                    </span>
                                  ) : (
                                    <span className="bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-bold">
                                      Stock: {p.stock}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-sm font-bold text-slate-250 group-hover:text-cyan-400 transition-colors">
                                  {p.name}
                                </h3>
                                {p.description && (
                                  <p className="text-[10px] text-slate-650 line-clamp-2 leading-relaxed">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                              <div className="mt-4 flex justify-between items-center w-full pt-2 border-t border-slate-900/60">
                                <span className="text-[10px] text-slate-500">Precio de Venta</span>
                                <span className="text-sm font-black text-slate-100">{formatPrice(p.price)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: CART CHECKOUT & PAYMENT METHOD */}
                  <div className={`space-y-4 ${activeTab === 'cart' ? 'block' : 'hidden md:block'}`}>
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 flex flex-col justify-between min-h-[550px] shadow-xl relative">
                      <div className="space-y-5">
                        
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Carrito de Compra</h2>
                          <span className="text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">
                            {cart.reduce((s, i) => s + i.quantity, 0)} items
                          </span>
                        </div>

                        <div className="h-px bg-slate-850" />

                        {/* Cart items */}
                        {cart.length === 0 ? (
                          <div className="text-center py-20 text-xs text-slate-650">
                            El carrito está vacío. Agrega artículos a la izquierda.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
                            {cart.map((item) => (
                              <div key={item.product.id} className="flex justify-between items-center bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-xs">
                                <div className="space-y-0.5 max-w-[130px]">
                                  <h4 className="font-bold text-slate-200 truncate">{item.product.name}</h4>
                                  <p className="text-[10px] text-slate-500">{formatPrice(item.product.price)}</p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                    className="w-7.5 h-7.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded flex items-center justify-center font-bold text-slate-350 min-h-[30px] min-w-[30px]"
                                  >
                                    -
                                  </button>
                                  <span className="font-bold text-slate-200 px-1">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                    className="w-7.5 h-7.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded flex items-center justify-center font-bold text-slate-350 min-h-[30px] min-w-[30px]"
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

                        {/* Customer predict selector */}
                        <div className="relative space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">
                            Buscar Paciente / CRM
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Escribe el nombre del paciente..."
                              value={selectedCustomer ? selectedCustomer.full_name : customerSearch}
                              onChange={(e) => {
                                setCustomerSearch(e.target.value)
                                setSelectedCustomer(null)
                                setShowCustomerSuggestions(true)
                              }}
                              onFocus={() => setShowCustomerSuggestions(true)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none min-h-[44px]"
                            />
                            {selectedCustomer && (
                              <button 
                                type="button" 
                                onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>

                          {showCustomerSuggestions && customerSearch.trim() && !selectedCustomer && (
                            <div className="absolute left-0 right-0 z-30 mt-1 bg-slate-900 border border-slate-800 rounded-xl max-h-[160px] overflow-y-auto shadow-2xl divide-y divide-slate-850">
                              {filteredCustomers.length === 0 ? (
                                <div className="p-3 text-[10px] text-slate-500">
                                  No hay pacientes registrados con ese nombre.
                                </div>
                              ) : (
                                filteredCustomers.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCustomer(c)
                                      setShowCustomerSuggestions(false)
                                    }}
                                    className="w-full text-left p-3 hover:bg-slate-950/80 transition-colors flex justify-between items-center text-xs"
                                  >
                                    <span className="font-bold text-slate-200">{c.full_name}</span>
                                    <span className="text-[10px] text-slate-500">
                                      {c.customer_profiles?.phone || 'Sin Tel.'}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        {/* Apply Coupon */}
                        <form onSubmit={handleApplyCoupon} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Cupón (ej. RAYO15)"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            disabled={subtotal === 0}
                            className="w-2/3 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none min-h-[40px]"
                          />
                          <button
                            type="submit"
                            disabled={subtotal === 0}
                            className="w-1/3 bg-slate-900 border border-slate-850 text-xs font-bold rounded-xl text-slate-300 hover:text-slate-100 min-h-[40px] cursor-pointer"
                          >
                            Aplicar
                          </button>
                        </form>

                      </div>

                      {/* Payment values */}
                      <form onSubmit={handleCheckout} className="mt-6 pt-4 border-t border-slate-850 space-y-4">
                        
                        <div className="space-y-1.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-900/60 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>{formatPrice(subtotal)}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-emerald-500 font-bold">
                              <span>Descuento ({activeCoupon?.discount_percent}%)</span>
                              <span>-{formatPrice(discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-550 text-[10px]">
                            <span>Desglose IVA (16%)</span>
                            <span>{formatPrice(iva)}</span>
                          </div>
                          <div className="flex justify-between text-slate-200 font-bold pt-1.5 border-t border-slate-900">
                            <span>Total Neto</span>
                            <span className="text-sm font-black text-cyan-400">{formatPrice(total)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              Anticipo Recibido
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={total.toFixed(2)}
                              value={paidAmountInput}
                              onChange={(e) => setPaidAmountInput(e.target.value)}
                              disabled={subtotal === 0}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none min-h-[44px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              Saldo Pendiente
                            </label>
                            <div className="w-full bg-slate-900 border border-slate-850/40 rounded-xl px-4 py-3 text-xs font-black text-rose-400 min-h-[44px] flex items-center justify-center">
                              {formatPrice(pendingBalance)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            Método de Pago
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'cash', label: 'Efectivo' },
                              { id: 'card', label: 'Tarjeta' },
                              { id: 'transfer', label: 'Transf.' }
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setPaymentMethod(m.id as any)}
                                disabled={subtotal === 0}
                                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                                  paymentMethod === m.id
                                    ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border-cyan-500 text-cyan-400'
                                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <input 
                            type="text" 
                            placeholder="Notas de la receta / observaciones..." 
                            value={saleNotes}
                            onChange={(e) => setSaleNotes(e.target.value)}
                            disabled={subtotal === 0}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={cart.length === 0 || submitting}
                          className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black py-4 px-4 rounded-2xl text-xs shadow-md shadow-cyan-500/10 cursor-pointer transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Registrar Venta & Taller
                            </>
                          )}
                        </button>

                      </form>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* VIEW MODE: MONITOREO DE TALLER (STATUS ENGINE) */}
            {viewMode === 'taller' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Taller status filter tabs */}
                <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto">
                  {[
                    { id: 'Todos', label: 'Todos' },
                    { id: 'Cotizacion', label: 'Cotización' },
                    { id: 'Anticipo_Pagado', label: 'Con Anticipo' },
                    { id: 'En_Taller', label: 'En Taller' },
                    { id: 'Listo_Entrega', label: 'Listo para Entrega' },
                    { id: 'Entregado', label: 'Entregados' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTallerFilter(tab.id as any)}
                      className={`text-[10px] font-extrabold px-3.5 py-2 rounded-lg border transition-all cursor-pointer min-h-[34px] ${
                        tallerFilter === tab.id
                          ? 'bg-slate-900 border-slate-800 text-cyan-400 font-black'
                          : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Orders list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSales.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-xs text-slate-500 bg-slate-900/10 border border-slate-900 rounded-3xl">
                      No hay órdenes de taller bajo este estado.
                    </div>
                  ) : (
                    filteredSales.map((sale) => {
                      const balance = sale.pending_balance !== undefined ? sale.pending_balance : 0
                      const paid = sale.paid_amount !== undefined ? sale.paid_amount : sale.total

                      return (
                        <div
                          key={sale.id}
                          className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow hover:shadow-cyan-950/5 transition-all"
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[9px] text-slate-500 block">Orden #{sale.id.slice(2, 8).toUpperCase()}</span>
                                <h3 className="font-extrabold text-sm text-slate-200 mt-0.5">
                                  {sale.customer_name || 'Cliente Externo'}
                                </h3>
                              </div>
                              
                              {/* Status Badge with color matching status */}
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                sale.status === 'Cotizacion' ? 'bg-slate-950 text-slate-400 border-slate-800' :
                                sale.status === 'Anticipo_Pagado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                sale.status === 'En_Taller' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                sale.status === 'Listo_Entrega' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' :
                                'bg-slate-900 text-slate-500 border-slate-950'
                              }`}>
                                {sale.status === 'Cotizacion' && 'Cotización'}
                                {sale.status === 'Anticipo_Pagado' && 'Anticipo'}
                                {sale.status === 'En_Taller' && 'En Taller'}
                                {sale.status === 'Listo_Entrega' && 'Listo'}
                                {sale.status === 'Entregado' && 'Entregado'}
                              </span>
                            </div>

                            <div className="h-px bg-slate-950" />

                            {/* Financial info */}
                            <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                                <span className="block text-slate-500 uppercase font-bold text-[8px]">Total</span>
                                <span className="font-bold text-slate-300">{formatPrice(sale.total)}</span>
                              </div>
                              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                                <span className="block text-slate-500 uppercase font-bold text-[8px]">Anticipo</span>
                                <span className="font-bold text-emerald-500">{formatPrice(paid)}</span>
                              </div>
                              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                                <span className="block text-slate-500 uppercase font-bold text-[8px]">Adeudo</span>
                                <span className={`font-bold ${balance > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                  {formatPrice(balance)}
                                </span>
                              </div>
                            </div>

                            {sale.notes && (
                              <p className="text-[10px] text-slate-500 bg-slate-950/20 p-2.5 rounded-lg border border-slate-900/60 truncate" title={sale.notes}>
                                <strong>Nota:</strong> {sale.notes}
                              </p>
                            )}
                          </div>

                          {/* ACTION SELECT ENGINE FOR WORKSHOP */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-950">
                            <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500">
                              Cambiar Estado de Laboratorio
                            </label>
                            
                            <select
                              value={sale.status}
                              onChange={(e) => handleStatusChange(sale.id, e.target.value)}
                              className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none min-h-[40px] font-bold"
                            >
                              <option value="Cotizacion">Cotización (Sin pago)</option>
                              <option value="Anticipo_Pagado">Anticipo Pagado (Espera taller)</option>
                              <option value="En_Taller">En Taller (Laboratorio)</option>
                              <option value="Listo_Entrega">Listo para Entrega</option>
                              <option value="Entregado">Entregado al Paciente</option>
                            </select>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
