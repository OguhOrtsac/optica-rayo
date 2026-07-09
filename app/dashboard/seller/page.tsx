'use client'

import { useEffect, useState, useMemo } from 'react'
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
import { 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Wrench, 
  ShoppingCart, 
  Tag, 
  User, 
  ArrowRight,
  TrendingDown
} from 'lucide-react'

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
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase())) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
    )
  }, [products, productSearch])

  // Filter customer suggestions based on text input
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.customer_profiles?.phone && c.customer_profiles.phone.includes(customerSearch))
    )
  }, [customers, customerSearch])

  // Filter sales for the workshop monitor
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (tallerFilter === 'Todos') return true
      return s.status === tallerFilter
    })
  }, [sales, tallerFilter])

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
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0), [cart])
  
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

  const discount = useMemo(() => activeCoupon ? subtotal * (activeCoupon.discount_percent / 100) : 0, [activeCoupon, subtotal])
  const taxableBase = useMemo(() => subtotal - discount, [subtotal, discount])
  const netSubtotal = useMemo(() => taxableBase / 1.16, [taxableBase])
  const iva = useMemo(() => taxableBase - netSubtotal, [taxableBase, netSubtotal])
  const total = useMemo(() => taxableBase, [taxableBase])

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
      showFeedback('error', 'Debes ingresar el nombre o buscar un cliente registrado.')
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

      // Register sale
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
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      
      {/* Header and View Mode Toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e7eeff] pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">
            Realizar Venta
          </h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Registro de ventas, control de inventario y monitoreo clínico.
          </p>
        </div>

        {/* Tab Selector: POS vs Taller */}
        <div className="flex bg-[#f0f3ff] p-1 rounded-xl border border-[#cbd5e1] w-full md:w-auto shadow-sm">
          <button
            onClick={() => setViewMode('pos')}
            className={`flex-1 md:flex-none text-xs font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'pos'
                ? 'bg-[#dee8ff] text-[#00357f] border border-[#cbd5e1]/30 shadow-sm font-black'
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            Realizar Venta
          </button>
          <button
            onClick={() => setViewMode('taller')}
            className={`flex-1 md:flex-none text-xs font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'taller'
                ? 'bg-[#dee8ff] text-[#00357f] border border-[#cbd5e1]/30 shadow-sm font-black'
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            Historial ({sales.filter(s => s.status !== 'Entregado').length})
          </button>
        </div>
      </div>

      {/* Global Feedback Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-600">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-xs font-bold text-rose-600">{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-sm text-[#737784] font-bold">Cargando base de datos unificada...</p>
        </div>
      ) : (
        <>
          {/* VIEW MODE: TERMINAL POS */}
          {viewMode === 'pos' && (
            <>
              {/* Mobile Tabs Header */}
              <div className="grid grid-cols-2 gap-2 bg-[#f0f3ff] p-1 rounded-xl border border-[#cbd5e1] md:hidden">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'products' ? 'bg-white text-[#00357f] shadow-sm font-black' : 'text-[#737784]'
                  }`}
                >
                  1. Catálogo ({filteredProducts.length})
                </button>
                <button
                  onClick={() => setActiveTab('cart')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'cart' ? 'bg-white text-[#00357f] shadow-sm font-black' : 'text-[#737784]'
                  }`}
                >
                  2. Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* LEFT: PRODUCTS SEARCH & STOCK HIGHLIGHT */}
                <div className={`md:col-span-2 space-y-4 ${activeTab === 'products' ? 'block' : 'hidden md:block'}`}>
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-[#f0f3ff] pb-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Productos Disponibles</h2>
                      <span className="text-[10px] bg-[#dee8ff]/60 px-2 py-0.5 rounded text-[#00357f] font-black uppercase">
                        Filtro Activo
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
                      <input
                        type="text"
                        placeholder="Buscar por código, nombre o tipo de lente..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]"
                      />
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {filteredProducts.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-xs text-[#737784] font-semibold">
                          No hay productos coincidentes en el inventario.
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addToCart(p)}
                            disabled={p.stock <= 0}
                            className="bg-[#f9f9ff] border border-[#cbd5e1]/45 hover:border-[#dee8ff] rounded-xl p-4 text-left flex flex-col justify-between transition-all hover:bg-white cursor-pointer min-h-[145px] group disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                          >
                            <div className="w-full space-y-1">
                              <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-[#737784]">
                                <span>
                                  {p.category === 'frames' && 'Armazón'}
                                  {p.category === 'lenses' && 'Mica'}
                                  {p.category === 'contact_lenses' && 'Contacto'}
                                  {p.category === 'accessories' && 'Accesorio'}
                                </span>
                                
                                {p.stock <= 3 ? (
                                  <span className="bg-[#ffdad6] text-[#ba1a1a] px-2 py-0.5 rounded font-black animate-pulse">
                                    Stock Crítico: {p.stock}
                                  </span>
                                ) : (
                                  <span className="bg-white border border-[#cbd5e1]/40 text-[#434653] px-2 py-0.5 rounded font-bold">
                                    Stock: {p.stock}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-[#111c2d] group-hover:text-[#00357f] transition-colors leading-snug">
                                {p.name}
                              </h3>
                              {p.description && (
                                <p className="text-[10px] text-[#737784] line-clamp-2 leading-relaxed">
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 flex justify-between items-center w-full pt-2 border-t border-[#cbd5e1]/40">
                              <span className="text-[9px] text-[#737784] uppercase font-bold">Precio</span>
                              <span className="text-xs font-black text-[#00357f] font-mono">{formatPrice(p.price)}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT: CART CHECKOUT & PAYMENT METHOD */}
                <div className={`space-y-4 ${activeTab === 'cart' ? 'block' : 'hidden md:block'}`}>
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 flex flex-col justify-between min-h-[500px] shadow-sm">
                    <div className="space-y-5">
                      
                      <div className="flex items-center justify-between border-b border-[#f0f3ff] pb-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f] flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4" /> Carrito
                        </h2>
                        <span className="bg-[#00357f] text-white px-2.5 py-0.5 rounded-full font-bold text-[9px]">
                          {cart.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>

                      {/* Cart items */}
                      {cart.length === 0 ? (
                        <div className="text-center py-20 text-xs text-[#737784] font-semibold">
                          El carrito está vacío. Agrega artículos a la izquierda.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[170px] overflow-y-auto pr-1">
                          {cart.map((item) => (
                            <div key={item.product.id} className="flex justify-between items-center bg-[#f9f9ff] border border-[#cbd5e1]/30 rounded-xl p-3 text-xs">
                              <div className="space-y-0.5 max-w-[130px] text-left">
                                <h4 className="font-bold text-[#111c2d] truncate">{item.product.name}</h4>
                                <p className="text-[10px] text-[#737784] font-mono">{formatPrice(item.product.price)}</p>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                  className="w-6.5 h-6.5 bg-white hover:bg-[#dee8ff] border border-[#cbd5e1] rounded flex items-center justify-center font-bold text-[#00357f] cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-bold text-[#111c2d] px-1 select-none font-mono">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                  className="w-6.5 h-6.5 bg-white hover:bg-[#dee8ff] border border-[#cbd5e1] rounded flex items-center justify-center font-bold text-[#00357f] cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <span className="font-bold text-[#00357f] font-mono text-right min-w-[70px]">
                                {formatPrice(item.product.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Customer predict selector */}
                      <div className="relative space-y-1 text-left">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#434653] mb-1">
                          Buscar Cliente / CRM
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Escribe el nombre del cliente..."
                            value={selectedCustomer ? selectedCustomer.full_name : customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value)
                              setSelectedCustomer(null)
                              setShowCustomerSuggestions(true)
                            }}
                            onFocus={() => setShowCustomerSuggestions(true)}
                            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]"
                          />
                          {selectedCustomer && (
                            <button 
                              type="button" 
                              onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {showCustomerSuggestions && customerSearch.trim() && !selectedCustomer && (
                          <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-[#cbd5e1] rounded-lg max-h-[160px] overflow-y-auto shadow-lg divide-y divide-[#f0f3ff]">
                            {filteredCustomers.length === 0 ? (
                              <div className="p-3 text-[10px] text-[#737784] font-semibold">
                                No hay clientes registrados con ese nombre.
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
                                  className="w-full text-left p-3 hover:bg-[#dee8ff]/30 transition-colors flex justify-between items-center text-xs cursor-pointer"
                                >
                                  <span className="font-bold text-[#111c2d]">{c.full_name}</span>
                                  <span className="text-[10px] text-[#737784]">
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
                          className="w-2/3 bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none min-h-[40px] font-mono uppercase"
                        />
                        <button
                          type="submit"
                          disabled={subtotal === 0}
                          className="w-1/3 bg-white border border-[#cbd5e1] text-xs font-bold rounded-lg text-[#00357f] hover:bg-[#dee8ff]/30 min-h-[40px] cursor-pointer transition-colors"
                        >
                          Aplicar
                        </button>
                      </form>

                    </div>

                    {/* Payment values */}
                    <form onSubmit={handleCheckout} className="mt-6 pt-4 border-t border-[#cbd5e1]/40 space-y-4 text-left">
                      
                      <div className="space-y-1.5 bg-[#f9f9ff] p-3.5 rounded-xl border border-[#cbd5e1]/40 text-xs font-medium">
                        <div className="flex justify-between text-[#737784]">
                          <span>Subtotal</span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-bold">
                            <span>Descuento ({activeCoupon?.discount_percent}%)</span>
                            <span>-{formatPrice(discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[#737784] text-[10px]">
                          <span>Desglose IVA (16%)</span>
                          <span>{formatPrice(iva)}</span>
                        </div>
                        <div className="flex justify-between text-[#111c2d] font-bold pt-1.5 border-t border-[#cbd5e1]/50 border-dashed">
                          <span>Total Neto</span>
                          <span className="text-sm font-black text-[#00357f] font-mono">{formatPrice(total)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#737784] mb-1.5">
                            Anticipo Recibido
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={total.toFixed(2)}
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            disabled={subtotal === 0}
                            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] focus:outline-none min-h-[44px] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#737784] mb-1.5">
                            Saldo Pendiente
                          </label>
                          <div className="w-full bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg px-4 py-3 text-xs font-black text-[#ba1a1a] min-h-[44px] flex items-center justify-center font-mono">
                            {formatPrice(pendingBalance)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#737784]">
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
                              className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                                paymentMethod === m.id
                                  ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f] font-black'
                                  : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#dee8ff]/30'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1">
                        <input 
                          type="text" 
                          placeholder="Notas de la receta / observaciones..." 
                          value={saleNotes}
                          onChange={(e) => setSaleNotes(e.target.value)}
                          disabled={subtotal === 0}
                          className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={cart.length === 0 || submitting}
                        className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-4 px-4 rounded-xl text-xs shadow-sm cursor-pointer transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Registrando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
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
            <div className="space-y-6">
              
              {/* Taller status filter tabs */}
              <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto scrollbar-none">
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
                    className={`text-[10px] font-bold px-4 py-2.5 rounded-lg border transition-all cursor-pointer min-h-[34px] ${
                      tallerFilter === tab.id
                        ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f] font-black'
                        : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#f0f3ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Orders list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSales.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-xs text-[#737784] bg-white border border-[#cbd5e1] rounded-2xl shadow-sm font-semibold">
                    No hay órdenes de taller bajo este estado.
                  </div>
                ) : (
                  filteredSales.map((sale) => {
                    const balance = sale.pending_balance !== undefined ? sale.pending_balance : 0
                    const paid = sale.paid_amount !== undefined ? sale.paid_amount : sale.total

                    return (
                      <div
                        key={sale.id}
                        className="bg-white border border-[#cbd5e1] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] text-[#737784] block font-bold uppercase">Orden #{sale.id.slice(2, 8).toUpperCase()}</span>
                              <h3 className="font-extrabold text-sm text-[#111c2d] mt-0.5 leading-snug">
                                {sale.customer_name || 'Cliente Externo'}
                              </h3>
                            </div>
                            
                            {/* Status Badge */}
                            <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                              sale.status === 'Cotizacion' ? 'bg-[#f0f3ff] text-[#434653] border-[#cbd5e1]' :
                              sale.status === 'Anticipo_Pagado' ? 'bg-[#dee8ff] text-[#00357f] border-[#00357f]/20' :
                              sale.status === 'En_Taller' ? 'bg-[#c4e7ff] text-[#004c69] border-[#004c69]/20' :
                              sale.status === 'Listo_Entrega' ? 'bg-[#49da9f]/20 text-[#00422b] border-[#49da9f]/30 animate-pulse' :
                              'bg-[#f9f9ff] text-[#737784] border-[#cbd5e1]'
                            }`}>
                              {sale.status === 'Cotizacion' && 'Cotización'}
                              {sale.status === 'Anticipo_Pagado' && 'Anticipo'}
                              {sale.status === 'En_Taller' && 'En Taller'}
                              {sale.status === 'Listo_Entrega' && 'Listo'}
                              {sale.status === 'Entregado' && 'Entregado'}
                            </span>
                          </div>

                          <div className="h-px bg-[#f0f3ff]" />

                          {/* Financial info */}
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-medium">
                            <div className="bg-[#f9f9ff] p-2 rounded-xl border border-[#cbd5e1]/40">
                              <span className="block text-[#737784] uppercase font-bold text-[8px] mb-0.5">Total</span>
                              <span className="font-bold text-[#111c2d] font-mono">{formatPrice(sale.total)}</span>
                            </div>
                            <div className="bg-[#f9f9ff] p-2 rounded-xl border border-[#cbd5e1]/40">
                              <span className="block text-[#737784] uppercase font-bold text-[8px] mb-0.5">Anticipo</span>
                              <span className="font-bold text-emerald-600 font-mono">{formatPrice(paid)}</span>
                            </div>
                            <div className="bg-[#f9f9ff] p-2 rounded-xl border border-[#cbd5e1]/40">
                              <span className="block text-[#737784] uppercase font-bold text-[8px] mb-0.5">Adeudo</span>
                              <span className={`font-bold font-mono ${balance > 0 ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
                                {formatPrice(balance)}
                              </span>
                            </div>
                          </div>

                          {sale.notes && (
                            <p className="text-[10px] text-[#434653] bg-[#f9f9ff] p-2.5 rounded-lg border border-[#cbd5e1]/40 truncate font-medium" title={sale.notes}>
                              <strong>Nota:</strong> {sale.notes}
                            </p>
                          )}
                        </div>

                        {/* ACTION SELECT ENGINE FOR WORKSHOP */}
                        <div className="space-y-1.5 pt-2 border-t border-[#f0f3ff]">
                          <label className="block text-[8px] font-black uppercase tracking-wider text-[#737784]">
                            Cambiar Estado de Laboratorio
                          </label>
                          
                          <select
                            value={sale.status}
                            onChange={(e) => handleStatusChange(sale.id, e.target.value)}
                            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#111c2d] focus:outline-none min-h-[40px] font-bold cursor-pointer"
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
        </>
      )}

    </main>
  )
}
