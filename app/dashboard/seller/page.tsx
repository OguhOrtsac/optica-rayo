'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getProducts,
  createSale,
  getReminders,
  searchCustomers,
  getCoupons,
  getSales,
  updateSaleStatus,
  getMemberDiscountPercent
} from '@/lib/services'
import { registerCustomerAction } from '@/app/customers/actions'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { effectiveClientPrice } from '@/lib/pricing'
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
  UserPlus,
  ArrowRight,
  TrendingDown,
  X,
  Pencil
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']
type Coupon = Database['public']['Tables']['coupons']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

// Free-text complement attached to a product at the counter (e.g.
// «Fotocromático»). price 0 means the complement is free («Gratis»).
interface CartComplement {
  name: string
  price: number
}

interface CartItem {
  product: Product
  quantity: number
  complements: CartComplement[]
  // Stable identity of the line: the product id for plain lines (so
  // repeat taps merge quantity, as before) and a unique key for lines
  // carrying complements (each complement set is its own line).
  cartKey: string
}

// One persisted sale_items row as the workshop history renders it:
// product rows and complement rows (is_complement) of the same sale.
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

interface CustomerProfile {
  id: string
  full_name: string
  email: string
  role?: string | null
  customer_profiles?: {
    phone: string | null
  } | null
}

export default function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [reminders, setReminders] = useState<(Reminder & { customer_name?: string })[]>([])
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [memberDiscount, setMemberDiscount] = useState(0)
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string; items?: SaleItemLine[] })[]>([])
  
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

  // Quick-add customer (from the empty state of the customer dropdown):
  // mini form + the persistent walk-in warning shown when the seller
  // chooses to continue with a name that is not registered.
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickError, setQuickError] = useState('')
  const [quickCreating, setQuickCreating] = useState(false)
  const [showWalkInWarning, setShowWalkInWarning] = useState(false)
  
  // Cart & Checkout states
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  const [paidAmountInput, setPaidAmountInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [saleNotes, setSaleNotes] = useState('')
  
  // Complements modal: tapping a product opens it instead of adding the
  // product straight away; the pencil on a cart line reopens it in 'edit'
  // mode with that line's complements loaded. Rows are free text (name +
  // price; empty or 0 price means the complement is «Gratis»).
  const [complementModal, setComplementModal] = useState<
    | { mode: 'add'; product: Product }
    | { mode: 'edit'; product: Product; cartKey: string }
    | null
  >(null)
  const [complementRows, setComplementRows] = useState<{ name: string; price: string }[]>([])

  // Removing a cart line always asks first (confirmation modal).
  const [removeCandidate, setRemoveCandidate] = useState<CartItem | null>(null)

  // Taller Filter state
  const [tallerFilter, setTallerFilter] = useState<'Todos' | 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado'>('Todos')
  
  // Messages states
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Sale line items (products + free-text complements) for the workshop
  // history cards. getSales does not join items, so they are read here in
  // one batch and attached to each sale. Any failure (demo mode, or the
  // complements migration not applied yet) leaves the sales untouched and
  // the cards render exactly as before, with no items section.
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

  const loadAllData = async () => {
    try {
      const [productsData, remindersData, customersData, couponsData, salesData, memberPctData] = await Promise.all([
        getProducts(),
        getReminders(),
        searchCustomers(''),
        getCoupons(),
        getSales(),
        getMemberDiscountPercent()
      ])
      setMemberDiscount(memberPctData)
      setProducts(productsData)
      setReminders(remindersData)
      setCustomers(customersData)
      setCoupons(couponsData)
      setSales(await attachSaleItems(salesData))
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

  // Adds one unit of a product to the cart. Without complements it keeps
  // the classic behaviour (repeat taps merge into the plain line and bump
  // its quantity); with complements the unit becomes its own line so each
  // complement set stays attached to the unit it was configured for.
  // Stock is validated against the TOTAL units of the product already in
  // the cart, across all of its lines. Returns false when stock blocks it.
  const addToCart = (product: Product, complements: CartComplement[] = []): boolean => {
    const unitsInCart = cart
      .filter(item => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0)
    if (unitsInCart + 1 > product.stock) {
      showFeedback('error', `Inventario insuficiente. Solo quedan ${product.stock} unidades de este producto.`)
      return false
    }
    if (complements.length === 0) {
      const existing = cart.find(item => item.product.id === product.id && item.complements.length === 0)
      if (existing) {
        setCart(cart.map(item =>
          item.cartKey === existing.cartKey ? { ...item, quantity: item.quantity + 1 } : item
        ))
      } else {
        setCart([...cart, { product, quantity: 1, complements: [], cartKey: product.id }])
      }
    } else {
      setCart([...cart, { product, quantity: 1, complements, cartKey: `${product.id}__${Date.now()}` }])
    }
    showFeedback('success', `"${product.name}" agregado al carrito.`)
    return true
  }

  // Removing a line takes its complements with it (they live inside the
  // cart item, never as separate lines).
  const removeFromCart = (cartKey: string) => {
    setCart(cart.filter(item => item.cartKey !== cartKey))
  }

  const updateQuantity = (cartKey: string, qty: number) => {
    const item = cart.find(i => i.cartKey === cartKey)
    if (!item) return
    const otherUnits = cart
      .filter(i => i.product.id === item.product.id && i.cartKey !== cartKey)
      .reduce((sum, i) => sum + i.quantity, 0)
    if (qty + otherUnits > item.product.stock) {
      showFeedback('error', `Solo hay ${item.product.stock} unidades disponibles en inventario.`)
      return
    }
    if (qty <= 0) {
      // Dropping to zero removes the line, and removal always asks first.
      setRemoveCandidate(item)
    } else {
      setCart(cart.map(i => i.cartKey === cartKey ? { ...i, quantity: qty } : i))
    }
  }

  // --- Complements modal (add & edit modes) ---
  const openComplementModal = (product: Product) => {
    setComplementModal({ mode: 'add', product })
    setComplementRows([{ name: '', price: '' }])
  }

  const openEditComplementsModal = (item: CartItem) => {
    setComplementModal({ mode: 'edit', product: item.product, cartKey: item.cartKey })
    setComplementRows(
      item.complements.length > 0
        ? item.complements.map(c => ({ name: c.name, price: c.price > 0 ? String(c.price) : '' }))
        : [{ name: '', price: '' }]
    )
  }

  const closeComplementModal = () => {
    setComplementModal(null)
    setComplementRows([])
  }

  const updateComplementRow = (index: number, field: 'name' | 'price', value: string) => {
    setComplementRows(rows => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const removeComplementRow = (index: number) => {
    setComplementRows(rows => rows.filter((_, i) => i !== index))
  }

  // Parses the modal rows: rows without a name are ignored, and a price
  // left empty or at 0 makes the complement «Gratis» (price 0).
  const parseComplementRows = (): CartComplement[] =>
    complementRows
      .map(row => ({ name: row.name.trim(), price: Math.max(0, parseFloat(row.price) || 0) }))
      .filter(c => c.name.length > 0)

  // Add mode: sends the product (with its complements) to the cart; the
  // modal only closes when the add succeeded (stock). Edit mode: applies
  // the corrected complements to that existing cart line and the totals
  // recalculate from the cart state.
  const handleConfirmComplementModal = () => {
    if (!complementModal) return
    const complements = parseComplementRows()
    if (complementModal.mode === 'add') {
      if (addToCart(complementModal.product, complements)) {
        closeComplementModal()
      }
    } else {
      const cartKey = complementModal.cartKey
      setCart(cart.map(item => (item.cartKey === cartKey ? { ...item, complements } : item)))
      showFeedback('success', `"${complementModal.product.name}" actualizado en el carrito.`)
      closeComplementModal()
    }
  }

  // --- Remove-line confirmation ---
  const confirmRemoveFromCart = () => {
    if (!removeCandidate) return
    removeFromCart(removeCandidate.cartKey)
    setRemoveCandidate(null)
  }

  // Member pricing at the counter: when the selected buyer is a registered
  // customer (profile role 'customer'), the unit price is the client price
  // (special client_price, else the general member discount). createSale
  // recomputes with exactly this rule, so screen and stored totals match.
  // A typed-in walk-in name (no selected profile) keeps visitor prices.
  const isClientBuyer = selectedCustomer?.role === 'customer'
  const unitPriceOf = (p: Product) =>
    isClientBuyer ? effectiveClientPrice(p.price, p.client_price, memberDiscount) : p.price

  // Complements are charged per unit of their product (same rule as the
  // lens treatments elsewhere in the app); a price of 0 adds nothing.
  const complementsUnitTotal = (item: CartItem) =>
    item.complements.reduce((sum, c) => sum + c.price, 0)

  // Real-time mathematics (products + their complements)
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + ((unitPriceOf(item.product) + complementsUnitTotal(item)) * item.quantity), 0), [cart, isClientBuyer, memberDiscount])
  
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

  // Username suggestion with the EXACT convention of /customers/new:
  // lowercase, accents stripped, non-alphanumerics become '_', first two
  // words joined by '_'. registerCustomerAction turns it into the account
  // email (username@opticarayo.com) unless the value already contains '@',
  // in which case it is used as the email as-is.
  const suggestUsername = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .split('_')
      .filter(Boolean)
      .slice(0, 2)
      .join('_')

  // Creates a customer through the SAME path as /customers/new
  // (registerCustomerAction: Auth account + profile role 'customer' +
  // customer_profile). Only username and fullName are required there;
  // every other field the action receives empty is stored as null.
  const createCustomerViaOfficialPath = async (fullName: string, phone?: string, email?: string) => {
    const formData = new FormData()
    formData.set('fullName', fullName)
    formData.set('username', email?.trim() ? email.trim() : suggestUsername(fullName))
    if (phone?.trim()) formData.set('phone', phone.trim())
    return registerCustomerAction({ error: null, success: null, customerId: null }, formData)
  }

  const openQuickAdd = () => {
    setQuickName(customerSearch.trim())
    setQuickPhone('')
    setQuickEmail('')
    setQuickError('')
    setShowQuickAdd(true)
  }

  // Quick-add from the dropdown: create, reload the directory, select the
  // new customer and close the panel. Errors stay inside the panel.
  const handleQuickCreateCustomer = async () => {
    const name = quickName.trim()
    if (!name) {
      setQuickError('Escribe el nombre del cliente.')
      return
    }
    setQuickCreating(true)
    setQuickError('')
    try {
      const result = await createCustomerViaOfficialPath(name, quickPhone, quickEmail)
      if (result.error || !result.customerId) {
        setQuickError(result.error || 'No se pudo crear el cliente.')
        return
      }
      const freshCustomers = await searchCustomers('')
      setCustomers(freshCustomers)
      const created = freshCustomers.find((c: any) => c.id === result.customerId)
      if (created) {
        setSelectedCustomer(created)
      } else {
        setSelectedCustomer({
          id: result.customerId,
          full_name: name,
          email: quickEmail.trim() || `${suggestUsername(name)}@opticarayo.com`,
          role: 'customer',
          customer_profiles: { phone: quickPhone.trim() || null }
        })
      }
      setCustomerSearch('')
      setShowCustomerSuggestions(false)
      setShowQuickAdd(false)
      setShowWalkInWarning(false)
      showFeedback('success', 'Cliente creado y seleccionado')
    } catch {
      setQuickError('No se pudo crear el cliente. Inténtalo de nuevo.')
    } finally {
      setQuickCreating(false)
    }
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const typedName = customerSearch.trim()
    let buyer: CustomerProfile | null = selectedCustomer
    let nameToRegister = buyer ? buyer.full_name : typedName
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
      // Free-typed name with no selected customer: resolve who the buyer is
      // BEFORE registering, so the purchase lands in a real history.
      // 1) An exact name match against the loaded directory links the sale
      //    to that customer instead of creating a duplicate profile.
      // 2) No match: create the minimal profile first (name only, through
      //    the same path as /customers/new) and link the sale to it.
      // 3) If creation fails, keep the previous behaviour — sale under the
      //    free-typed name — and warn that no profile was created.
      let profileCreationFailed = false
      if (!buyer && typedName) {
        const exactMatch = customers.find(
          c => c.full_name.trim().toLowerCase() === typedName.toLowerCase()
        )
        if (exactMatch) {
          buyer = exactMatch
          nameToRegister = exactMatch.full_name
        } else {
          try {
            const created = await createCustomerViaOfficialPath(typedName)
            if (!created.error && created.customerId) {
              buyer = {
                id: created.customerId,
                full_name: typedName,
                email: `${suggestUsername(typedName)}@opticarayo.com`,
                role: 'customer',
                customer_profiles: null
              }
            } else {
              profileCreationFailed = true
            }
          } catch {
            profileCreationFailed = true
          }
        }
      }

      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        complements: item.complements.map(c => ({ name: c.name, price: c.price }))
      }))

      // Register sale with everything captured on screen: the registered
      // customer (when one was selected), the applied coupon and the note.
      await createSale(nameToRegister, items, paidAmount || total, paymentMethod, {
        customerId: buyer?.id || null,
        couponId: activeCoupon?.id || null,
        discountApplied: discount,
        notes: saleNotes.trim() || undefined,
        // The buyer was resolved from the typed name at checkout (exact
        // match or minimal profile just created): the screen charged
        // visitor prices, so the recorded sale keeps those prices.
        chargeAsWalkIn: !selectedCustomer && !!buyer,
      })

      showFeedback('success', '¡Venta registrada exitosamente! El inventario se actualizó y se programó la cita de revisión.')
      if (profileCreationFailed) {
        showFeedback('error', 'La venta se registró con el nombre escrito, pero no se pudo crear el perfil del cliente. Agrégalo después en Clientes.')
      }

      // Clear POS state
      setCart([])
      setCustomerSearch('')
      setSelectedCustomer(null)
      setShowWalkInWarning(false)
      setShowQuickAdd(false)
      setPaidAmountInput('')
      setCouponCode('')
      setActiveCoupon(null)
      setSaleNotes('')
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
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      
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
        <div className="flex bg-white p-1 rounded-full or-shadow-card w-full md:w-auto">
          <button
            onClick={() => setViewMode('pos')}
            className={`flex-1 md:flex-none text-sm font-semibold px-5 min-h-[44px] rounded-full transition-colors cursor-pointer ${
              viewMode === 'pos'
                ? 'bg-[#dee8ff] text-[#00357f] font-bold'
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            Realizar Venta
          </button>
          <button
            onClick={() => setViewMode('taller')}
            className={`flex-1 md:flex-none text-sm font-semibold px-5 min-h-[44px] rounded-full transition-colors cursor-pointer ${
              viewMode === 'taller'
                ? 'bg-[#dee8ff] text-[#00357f] font-bold'
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            Historial ({sales.filter(s => s.status !== 'Entregado').length})
          </button>
        </div>
      </div>

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
        <>
          {/* VIEW MODE: TERMINAL POS */}
          {viewMode === 'pos' && (
            <>
              {/* Mobile Tabs Header */}
              <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-full or-shadow-card md:hidden">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`min-h-[44px] text-sm font-semibold rounded-full transition-all ${
                    activeTab === 'products' ? 'bg-[#dee8ff] text-[#00357f] font-bold' : 'text-[#737784]'
                  }`}
                >
                  1. Catálogo ({filteredProducts.length})
                </button>
                <button
                  onClick={() => setActiveTab('cart')}
                  className={`min-h-[44px] text-sm font-semibold rounded-full transition-all ${
                    activeTab === 'cart' ? 'bg-[#dee8ff] text-[#00357f] font-bold' : 'text-[#737784]'
                  }`}
                >
                  2. Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* LEFT: PRODUCTS SEARCH & STOCK HIGHLIGHT */}
                <div className={`md:col-span-2 space-y-4 ${activeTab === 'products' ? 'block' : 'hidden md:block'}`}>
                  <div className="bg-white rounded-[20px] or-shadow-card p-5 md:p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-[#f0f3ff] pb-3">
                      <h2 className="text-base font-bold text-[#111c2d]">Productos Disponibles</h2>
                      <span className="text-[11px] bg-[#dee8ff] px-2.5 py-1 rounded-full text-[#00357f] font-bold">
                        {filteredProducts.length} en catálogo
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#737784]" />
                      <input
                        type="text"
                        placeholder="Buscar por código, nombre o tipo de lente..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-full pl-11 pr-4 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                      />
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {filteredProducts.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-sm text-[#737784] font-semibold">
                          No hay productos coincidentes en el inventario.
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => openComplementModal(p)}
                            disabled={p.stock <= 0}
                            className="bg-[#f9f9ff] border border-[#dee8ff]/70 hover:border-[#00357f]/30 rounded-[20px] p-4 text-left flex flex-col justify-between transition-all hover:bg-white cursor-pointer min-h-[145px] group disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="w-full space-y-1.5">
                              <div className="flex justify-between items-center text-[11px] font-semibold text-[#737784]">
                                <span>
                                  {p.category === 'frames' && 'Armazón'}
                                  {p.category === 'lenses' && 'Mica'}
                                  {p.category === 'contact_lenses' && 'Contacto'}
                                  {p.category === 'accessories' && 'Accesorio'}
                                </span>

                                {p.stock <= 3 ? (
                                  <span className="bg-[#ffdad6] text-[#ba1a1a] px-2.5 py-1 rounded-full font-bold">
                                    Stock crítico: {p.stock}
                                  </span>
                                ) : (
                                  <span className="bg-white text-[#434653] px-2.5 py-1 rounded-full font-semibold">
                                    Stock: {p.stock}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-[15px] font-bold text-[#111c2d] group-hover:text-[#00357f] transition-colors leading-snug">
                                {p.name}
                              </h3>
                              {p.description && (
                                <p className="text-xs text-[#737784] line-clamp-2 leading-relaxed">
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 flex justify-between items-end w-full pt-3 border-t border-[#dee8ff]/70">
                              <div className="space-y-0.5">
                                <span className="block text-[11px] text-[#737784] font-semibold">{isClientBuyer && unitPriceOf(p) !== p.price ? 'Precio cliente' : 'Precio'}</span>
                                <span className="block text-lg font-extrabold text-[#00357f] tabular-nums leading-none">
                                  {formatPrice(unitPriceOf(p))}
                                  {isClientBuyer && unitPriceOf(p) !== p.price && (
                                    <span className="ml-1.5 text-sm line-through text-[#737784] font-medium">{formatPrice(p.price)}</span>
                                  )}
                                </span>
                              </div>
                              <span className="flex items-center gap-1 bg-[#00357f] text-white text-xs font-bold pl-2.5 pr-3 min-h-[36px] rounded-full group-hover:bg-[#00509e] transition-colors">
                                <Plus className="w-4 h-4" />
                                Agregar
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT: CART CHECKOUT & PAYMENT METHOD */}
                <div className={`space-y-4 ${activeTab === 'cart' ? 'block' : 'hidden md:block'}`}>
                  <div className="bg-white rounded-[20px] or-shadow-card p-5 md:p-6 flex flex-col justify-between min-h-[500px]">
                    <div className="space-y-5">

                      <div className="flex items-center justify-between border-b border-[#f0f3ff] pb-3">
                        <h2 className="text-base font-bold text-[#111c2d] flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-[#00357f]" /> Carrito
                        </h2>
                        <span className="bg-[#00357f] text-white px-2.5 py-1 rounded-full font-bold text-[11px]">
                          {cart.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>

                      {/* Cart items */}
                      {cart.length === 0 ? (
                        <div className="text-center py-20 text-sm text-[#737784] font-semibold">
                          El carrito está vacío. Agrega artículos a la izquierda.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                          {cart.map((item) => (
                            <div key={item.cartKey} className="bg-[#f9f9ff] rounded-2xl p-3 text-sm space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-0.5 text-left min-w-0">
                                  <h4 className="font-bold text-[#111c2d] leading-snug">{item.product.name}</h4>
                                  <p className="text-xs text-[#737784] tabular-nums">{formatPrice(unitPriceOf(item.product))} c/u</p>
                                </div>
                                <span className="font-bold text-[#00357f] tabular-nums text-right shrink-0">
                                  {formatPrice((unitPriceOf(item.product) + complementsUnitTotal(item)) * item.quantity)}
                                </span>
                              </div>

                              {item.complements.length > 0 && (
                                <ul className="space-y-1 border-t border-[#dee8ff]/70 pt-2">
                                  {item.complements.map((c, ci) => (
                                    <li key={ci} className="flex justify-between items-center gap-2 text-xs">
                                      <span className="text-[#434653] font-medium min-w-0">
                                        Complemento: <strong className="text-[#111c2d]">{c.name}</strong>
                                      </span>
                                      {c.price > 0 ? (
                                        <span className="tabular-nums text-[#434653] shrink-0">
                                          {item.quantity > 1 ? `${formatPrice(c.price)} × ${item.quantity} = ` : ''}
                                          <strong className="text-[#111c2d]">{formatPrice(c.price * item.quantity)}</strong>
                                        </span>
                                      ) : (
                                        <span className="bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0">Gratis</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="flex items-center justify-between border-t border-[#dee8ff]/70 pt-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                                    className="w-8 h-8 bg-white hover:bg-[#dee8ff] border border-[#dee8ff] rounded-full flex items-center justify-center font-bold text-base text-[#00357f] cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="font-bold text-[#111c2d] px-1 select-none tabular-nums">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                                    className="w-8 h-8 bg-white hover:bg-[#dee8ff] border border-[#dee8ff] rounded-full flex items-center justify-center font-bold text-base text-[#00357f] cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => openEditComplementsModal(item)}
                                    aria-label={`Editar ${item.product.name}`}
                                    title="Editar artículo"
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#00357f] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemoveCandidate(item)}
                                    aria-label={`Quitar ${item.product.name} del carrito`}
                                    title="Quitar del carrito"
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Customer predict selector */}
                      <div className="relative space-y-1 text-left">
                        <label className="block text-[13px] font-semibold text-[#434653] mb-1">
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
                              setShowQuickAdd(false)
                              setQuickError('')
                              if (!e.target.value.trim()) setShowWalkInWarning(false)
                            }}
                            onFocus={() => setShowCustomerSuggestions(true)}
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                          {selectedCustomer && (
                            <button
                              type="button"
                              onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setShowWalkInWarning(false); }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ba1a1a] hover:text-[#93000a] text-xs font-bold cursor-pointer px-1 py-1"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {showCustomerSuggestions && customerSearch.trim() && !selectedCustomer && (
                          <div className={`absolute left-0 right-0 z-30 mt-1 bg-white border border-[#dee8ff] rounded-2xl overflow-y-auto shadow-lg divide-y divide-[#f0f3ff] ${filteredCustomers.length === 0 ? 'max-h-[380px]' : 'max-h-[160px]'}`}>
                            {filteredCustomers.length === 0 ? (
                              <div className="p-4 space-y-3 text-left">
                                {!showQuickAdd ? (
                                  <>
                                    <p className="text-sm text-[#434653] font-semibold">
                                      &ldquo;{customerSearch.trim()}&rdquo; no está registrado.
                                    </p>
                                    <div className="space-y-2">
                                      <button
                                        type="button"
                                        onClick={openQuickAdd}
                                        className="w-full min-h-[44px] bg-[#00357f] hover:bg-[#00509e] text-white text-sm font-bold rounded-xl px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                      >
                                        <UserPlus className="w-4 h-4" />
                                        Agregar cliente rápido
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowCustomerSuggestions(false)
                                          setShowWalkInWarning(true)
                                        }}
                                        className="w-full min-h-[44px] bg-white border border-[#dee8ff] text-[#00357f] text-sm font-bold rounded-xl px-3 hover:bg-[#dee8ff]/30 flex items-center justify-center cursor-pointer transition-colors"
                                      >
                                        Continuar solo con el nombre
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-sm font-bold text-[#00357f]">Agregar cliente rápido</p>
                                    <div>
                                      <label className="block text-[13px] font-semibold text-[#434653] mb-1">
                                        Nombre *
                                      </label>
                                      <input
                                        type="text"
                                        value={quickName}
                                        onChange={(e) => setQuickName(e.target.value)}
                                        placeholder="Nombre completo del cliente"
                                        className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[13px] font-semibold text-[#434653] mb-1">
                                        Teléfono (opcional)
                                      </label>
                                      <input
                                        type="tel"
                                        value={quickPhone}
                                        onChange={(e) => setQuickPhone(e.target.value)}
                                        placeholder="Ej. (555) 123-4567"
                                        className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[13px] font-semibold text-[#434653] mb-1">
                                        Correo (opcional)
                                      </label>
                                      <input
                                        type="email"
                                        value={quickEmail}
                                        onChange={(e) => setQuickEmail(e.target.value)}
                                        placeholder="cliente@correo.com"
                                        className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                                      />
                                    </div>
                                    {quickError && (
                                      <p className="bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/25 rounded-xl px-3 py-2 text-[13px] font-semibold">
                                        {quickError}
                                      </p>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={handleQuickCreateCustomer}
                                        disabled={quickCreating}
                                        className="flex-1 min-h-[44px] bg-[#00357f] hover:bg-[#00509e] text-white text-sm font-bold rounded-xl px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                                      >
                                        {quickCreating ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Creando...
                                          </>
                                        ) : (
                                          'Crear y seleccionar'
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setShowQuickAdd(false); setQuickError('') }}
                                        disabled={quickCreating}
                                        className="min-h-[44px] bg-white border border-[#dee8ff] text-[#737784] text-sm font-bold rounded-xl px-4 hover:bg-[#dee8ff]/30 cursor-pointer transition-colors disabled:opacity-50"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              filteredCustomers.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(c)
                                    setShowCustomerSuggestions(false)
                                    setShowWalkInWarning(false)
                                  }}
                                  className="w-full text-left p-3 min-h-[48px] hover:bg-[#dee8ff]/30 transition-colors flex justify-between items-center text-sm cursor-pointer"
                                >
                                  <span className="font-bold text-[#111c2d]">{c.full_name}</span>
                                  <span className="text-xs text-[#737784]">
                                    {c.customer_profiles?.phone || 'Sin Tel.'}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {showWalkInWarning && !selectedCustomer && customerSearch.trim() && (
                        <p className="bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/25 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-left flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
                          Ese cliente no existe: al registrar la venta se creará un perfil básico solo con el nombre, para que lo completes después en Clientes.
                        </p>
                      )}

                      {isClientBuyer && (
                        <p className="text-xs font-semibold text-[#00422b] bg-[#e2f9ee] border border-[#00422b]/20 rounded-xl px-3 py-2.5 text-left">
                          Cliente registrado: se aplica su precio de cliente en esta venta.
                        </p>
                      )}

                      {/* Apply Coupon */}
                      <form onSubmit={handleApplyCoupon} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Cupón (ej. RAYO15)"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          disabled={subtotal === 0}
                          className="w-2/3 bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] uppercase transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={subtotal === 0}
                          className="w-1/3 bg-white border border-[#dee8ff] text-sm font-bold rounded-xl text-[#00357f] hover:bg-[#dee8ff]/30 min-h-[44px] cursor-pointer transition-colors"
                        >
                          Aplicar
                        </button>
                      </form>

                    </div>

                    {/* Payment values */}
                    <form onSubmit={handleCheckout} className="mt-6 pt-4 border-t border-[#dee8ff] space-y-4 text-left">

                      <div className="space-y-1.5 bg-[#f9f9ff] p-4 rounded-2xl text-sm font-medium">
                        <div className="flex justify-between text-[#737784]">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{formatPrice(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-[#00422b] font-bold">
                            <span>Descuento ({activeCoupon?.discount_percent}%)</span>
                            <span className="tabular-nums">-{formatPrice(discount)}</span>
                          </div>
                        )}
                        {/* Informative VAT breakdown: catalog prices already
                            include the 16% VAT, so this only splits the
                            amount to charge (total after coupon) into its
                            net part (total / 1.16) and its tax part. The
                            charged total does not change by a cent. */}
                        <div className="pt-2 mt-1 border-t border-[#dee8ff] border-dashed space-y-1.5">
                          <p className="text-[11px] font-semibold text-[#737784]">Los precios ya incluyen IVA</p>
                          <div className="flex justify-between text-[#737784] text-xs">
                            <span>Precio sin IVA</span>
                            <span className="tabular-nums">{formatPrice(netSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-[#737784] text-xs">
                            <span>IVA (16%)</span>
                            <span className="tabular-nums">{formatPrice(iva)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-baseline text-[#111c2d] font-bold pt-2 border-t border-[#dee8ff] border-dashed">
                          <span className="text-base">Total</span>
                          <span className="text-xl font-black text-[#00357f] tabular-nums">{formatPrice(total)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[13px] font-semibold text-[#434653] mb-1.5">
                            Anticipo Recibido
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={total.toFixed(2)}
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            disabled={subtotal === 0}
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] tabular-nums transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-semibold text-[#434653] mb-1.5">
                            Saldo Pendiente
                          </label>
                          <div className="w-full bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl px-4 py-3 text-sm font-black text-[#ba1a1a] min-h-[44px] flex items-center justify-center tabular-nums">
                            {formatPrice(pendingBalance)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[13px] font-semibold text-[#434653]">
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
                              className={`py-2 text-sm font-semibold rounded-full border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                                paymentMethod === m.id
                                  ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                                  : 'bg-white border-[#dee8ff] text-[#737784] hover:bg-[#dee8ff]/30'
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
                          className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={cart.length === 0 || submitting}
                        className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold py-4 px-4 rounded-2xl text-[15px] cursor-pointer transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2"
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
                  { id: 'En_Taller', label: 'En taller' },
                  { id: 'Listo_Entrega', label: 'Listo para entrega' },
                  { id: 'Entregado', label: 'Entregado' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTallerFilter(tab.id as any)}
                    className={`text-[13px] font-semibold px-4 py-2.5 rounded-full border transition-all cursor-pointer min-h-[40px] ${
                      tallerFilter === tab.id
                        ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                        : 'bg-white border-[#dee8ff] text-[#737784] hover:bg-[#f9f9ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Orders list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSales.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-sm text-[#737784] bg-white rounded-[20px] or-shadow-card font-semibold">
                    No hay órdenes de taller bajo este estado.
                  </div>
                ) : (
                  filteredSales.map((sale) => {
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
        </>
      )}

      {/* COMPLEMENTS MODAL (add mode from the catalog, edit mode from a
          cart line). Cancel discards everything; the confirm button adds
          the product with its complements or applies the corrections to
          the cart line. */}
      {complementModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 p-0 sm:p-4"
          onClick={closeComplementModal}
          role="dialog"
          aria-modal="true"
          aria-label={complementModal.mode === 'edit' ? 'Editar artículo del carrito' : 'Agregar artículo al carrito'}
        >
          <div
            className="bg-white rounded-t-[20px] sm:rounded-[20px] or-shadow-card w-full max-w-md max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Product header */}
            <div className="p-5 pb-4 border-b border-[#f0f3ff] space-y-1.5 text-left">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-[#111c2d] leading-snug">{complementModal.product.name}</h3>
                <button
                  type="button"
                  onClick={closeComplementModal}
                  aria-label="Cerrar"
                  className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 shrink-0 flex items-center justify-center rounded-full text-[#737784] hover:bg-[#dee8ff]/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs font-semibold text-[#737784]">
                {complementModal.product.category === 'frames' && 'Armazón'}
                {complementModal.product.category === 'lenses' && 'Mica'}
                {complementModal.product.category === 'contact_lenses' && 'Contacto'}
                {complementModal.product.category === 'accessories' && 'Accesorio'}
                {' · '}Stock: {complementModal.product.stock}
                {complementModal.mode === 'edit' && ' · Editando la línea del carrito'}
              </p>
              {complementModal.product.description && (
                <p className="text-sm text-[#434653] leading-relaxed">{complementModal.product.description}</p>
              )}
              <p className="text-lg font-extrabold text-[#00357f] tabular-nums">
                {formatPrice(unitPriceOf(complementModal.product))}
                {isClientBuyer && unitPriceOf(complementModal.product) !== complementModal.product.price && (
                  <span className="ml-1.5 text-sm line-through text-[#737784] font-medium">{formatPrice(complementModal.product.price)}</span>
                )}
              </p>
            </div>

            {/* Complements editor */}
            <div className="p-5 space-y-3 text-left">
              <h4 className="text-sm font-bold text-[#111c2d]">Complementos</h4>
              {complementRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateComplementRow(idx, 'name', e.target.value)}
                    placeholder="Nombre (ej. Fotocromático)"
                    aria-label="Nombre del complemento"
                    className="flex-1 min-w-0 bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateComplementRow(idx, 'price', e.target.value)}
                    placeholder="Precio"
                    aria-label="Precio del complemento"
                    className="w-24 shrink-0 bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] tabular-nums transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeComplementRow(idx)}
                    aria-label="Quitar complemento"
                    className="min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center rounded-full text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setComplementRows(rows => [...rows, { name: '', price: '' }])}
                className="min-h-[44px] px-3 flex items-center gap-1.5 text-sm font-bold text-[#00357f] hover:bg-[#dee8ff]/40 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agregar complemento
              </button>
              <p className="text-xs text-[#737784] font-medium">
                Precio en 0 o vacío = <strong className="text-[#00422b]">Gratis</strong>. Sin complementos, el producto se agrega como siempre.
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pt-3 border-t border-[#f0f3ff] flex gap-2">
              <button
                type="button"
                onClick={closeComplementModal}
                className="flex-1 min-h-[48px] rounded-xl bg-[#ffdad6] hover:bg-[#ffc9c4] text-[#ba1a1a] font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmComplementModal}
                className="flex-1 min-h-[48px] rounded-xl bg-[#00357f] hover:bg-[#00509e] text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {complementModal.mode === 'edit' ? 'Confirmar' : 'Enviar a carrito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE LINE CONFIRMATION: removing a cart line (trash button or
          quantity dropping to zero) always asks first; confirming removes
          the line together with its complements. */}
      {removeCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 p-0 sm:p-4"
          onClick={() => setRemoveCandidate(null)}
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar quitar artículo del carrito"
        >
          <div
            className="bg-white rounded-t-[20px] sm:rounded-[20px] or-shadow-card w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5 text-left">
              <h3 className="text-base font-bold text-[#111c2d] leading-snug">¿Seguro que quieres quitar este artículo del carrito?</h3>
              <p className="text-sm text-[#434653] font-medium">
                {removeCandidate.product.name}
                {removeCandidate.complements.length > 0 && ' (se quitan también sus complementos)'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveCandidate(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-white border border-[#dee8ff] text-[#00357f] font-bold text-sm hover:bg-[#dee8ff]/30 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRemoveFromCart}
                className="flex-1 min-h-[48px] rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Sí, quitar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
