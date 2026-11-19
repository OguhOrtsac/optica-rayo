'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import {
  getProducts,
  createSale,
  getReminders,
  searchCustomers,
  getCoupons,
  getMemberDiscountPercent,
  getReminderConfig,
  COUPON_LIMIT_MESSAGE,
  isCouponExhausted
} from '@/lib/services'
import {
  buildInstallmentSchedule,
  defaultFirstPaymentDate,
  frequencyEvery,
  frequencyPlural,
  type PaymentFrequency,
  type PaymentPlanSummary
} from '@/lib/payment-plan'
import { registerCustomerAction } from '@/app/customers/actions'
import PageHeader from '@/components/page-header'
import PhoneInput from '@/components/phone-input'
import { effectiveClientPrice } from '@/lib/pricing'
import { getProductDetails } from '@/lib/product-data'
import { DEFAULT_REMINDER_MONTHS } from '@/lib/reminder-config'
import { toWhatsAppNumber } from '@/lib/phone'
import { buildTicketMessage, orderCodeFromSaleId, type TicketLine } from '@/lib/ticket'
import { Database } from '@/types/database.types'
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  ShieldAlert,
  ShoppingCart,
  UserPlus,
  X,
  Pencil,
  MessageSquare
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']
type Coupon = Database['public']['Tables']['coupons']['Row']

// Product search by type uses the words sellers actually say (Spanish),
// not the internal category codes — nobody searches by code at the counter.
const CATEGORY_SEARCH_TERMS: Record<Product['category'], string> = {
  frames: 'armazones armazón frames',
  lenses: 'micas mica lentes lenses',
  contact_lenses: 'lentes de contacto contacto contact_lenses',
  accessories: 'accesorios accesorio accessories',
}

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

interface CustomerProfile {
  id: string
  full_name: string
  email: string
  role?: string | null
  customer_profiles?: {
    phone: string | null
  } | null
}

// Counter discount dictated by the owner (2026-11-18): at the counter
// the seller can discount by percentage OR by naming the final price
// the customer will pay. It is mutually exclusive with a coupon —
// «aplicar cupón O aplicar descuento», never both stacked.
type ManualDiscount =
  | { mode: 'percent'; percent: number; reason: string }
  | { mode: 'finalPrice'; finalPrice: number; reason: string }

// Snapshot of a just-registered sale, captured BEFORE the POS state is
// cleared, so the success card can offer the WhatsApp ticket with
// exactly what was charged on screen.
interface LastSaleTicket {
  saleId: string
  createdAt: string
  buyerName: string
  buyerPhone: string | null
  lines: TicketLine[]
  subtotal: number
  discount: { amount: number; detail?: string } | null
  total: number
  paid: number
  pendingBalance: number
  reminderMonths: number
  /** Plan de pagos generado con la venta (null si no se creó). */
  paymentPlan: PaymentPlanSummary | null
}

export default function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [reminders, setReminders] = useState<(Reminder & { customer_name?: string })[]>([])
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [memberDiscount, setMemberDiscount] = useState(0)
  const [loading, setLoading] = useState(true)

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
  // Selector de cliente como el de la Agenda (dictado del dueño,
  // 2026-11-19): la lista se abre con la primera interacción (clic o
  // tecleo), NUNCA sola al cargar; muestra TODOS los clientes y
  // filtra al escribir; tocar fuera la cierra. Tras «Limpiar» la
  // lista queda suprimida hasta que el usuario vuelve a tocar el
  // campo (misma regla suppressAutoOpen de Agenda y Realizar examen).
  const customerPickerRef = useRef<HTMLDivElement>(null)
  const suppressCustomerAutoOpenRef = useRef(false)
  const customerPickerInteractedRef = useRef(false)
  
  // Cart & Checkout states
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  // Manual counter discount (see ManualDiscount): the form drafts live
  // separately from the applied discount, like the coupon code does.
  const [manualMode, setManualMode] = useState<'percent' | 'finalPrice'>('percent')
  const [manualPercentInput, setManualPercentInput] = useState('')
  const [manualFinalPriceInput, setManualFinalPriceInput] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [activeManualDiscount, setActiveManualDiscount] = useState<ManualDiscount | null>(null)
  // Success card with the WhatsApp ticket of the last registered sale.
  const [lastSale, setLastSale] = useState<LastSaleTicket | null>(null)
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

  // Messages states
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Synchronous checkout lock: the `submitting` state only disables the
  // button after a re-render, so a fast second submit (double tap, Enter
  // in a field) could slip a second handleCheckout run in and register
  // the sale twice. This ref flips synchronously, before any await.
  const checkoutLockRef = useRef(false)
  // Live node of the anticipo input: at submit time the charged amount
  // is re-read from the field itself, so what is charged always matches
  // what the cashier sees even if a change event was swallowed.
  const anticipoInputRef = useRef<HTMLInputElement>(null)

  const loadAllData = async () => {
    try {
      const [productsData, remindersData, customersData, couponsData, memberPctData] = await Promise.all([
        getProducts(),
        getReminders(),
        searchCustomers(''),
        getCoupons(),
        getMemberDiscountPercent()
      ])
      setMemberDiscount(memberPctData)
      setProducts(productsData)
      setReminders(remindersData)
      setCustomers(customersData)
      setCoupons(couponsData)
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

  // Tocar fuera del selector de cliente lo cierra (igual que la Agenda).
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (customerPickerRef.current && !customerPickerRef.current.contains(e.target as Node)) {
        setShowCustomerSuggestions(false)
        setShowQuickAdd(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Filter products locally: by name, by BRAND and by TYPE (the way
  // sellers actually search at the counter), keeping the previous
  // description/category matches.
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    return products.filter(p => {
      const details = getProductDetails(p)
      return (
        p.name.toLowerCase().includes(q) ||
        details.brand.toLowerCase().includes(q) ||
        CATEGORY_SEARCH_TERMS[p.category].includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      )
    })
  }, [products, productSearch])

  // Filter customer suggestions based on text input
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.customer_profiles?.phone && c.customer_profiles.phone.includes(customerSearch))
    )
  }, [customers, customerSearch])

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
  
  // Validate and apply coupon. A coupon and a manual discount never
  // stack (owner's rule): applying the coupon removes the manual one.
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponCode.trim()) return

    const matched = coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase())
    if (matched && matched.is_active && new Date(matched.valid_until) > new Date()) {
      // Límite de usos (dictado 2026-11-19): un cupón que ya llegó a
      // su límite NO se aplica; el conteo se lee en vivo de las
      // ventas guardadas con ese coupon_id. Al cobrar, createSale
      // vuelve a validar por si el límite se alcanzó entretanto.
      if (await isCouponExhausted(matched)) {
        setActiveCoupon(null)
        showFeedback('error', COUPON_LIMIT_MESSAGE)
        return
      }
      const replacedManual = !!activeManualDiscount
      setActiveCoupon(matched)
      if (replacedManual) setActiveManualDiscount(null)
      showFeedback('success', `Cupón "${matched.code}" aplicado con ${matched.discount_percent}% de descuento.${replacedManual ? ' Se quitó el descuento manual: los descuentos no se combinan.' : ''}`)
    } else {
      setActiveCoupon(null)
      showFeedback('error', 'El cupón no es válido o ha expirado.')
    }
  }

  // Apply the manual counter discount (percentage or final price).
  // Applying it removes any active coupon — they never stack.
  const handleApplyManualDiscount = (e: React.FormEvent) => {
    e.preventDefault()
    if (subtotal <= 0) return

    let next: ManualDiscount
    if (manualMode === 'percent') {
      const percent = parseFloat(manualPercentInput.trim().replace(',', '.'))
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        showFeedback('error', 'El porcentaje de descuento debe estar entre 1 y 100.')
        return
      }
      next = { mode: 'percent', percent, reason: manualReason.trim() }
    } else {
      const finalPrice = parseFloat(manualFinalPriceInput.trim().replace(',', '.'))
      if (!Number.isFinite(finalPrice) || finalPrice < 0) {
        showFeedback('error', 'Escribe el precio final que pagará el cliente.')
        return
      }
      if (finalPrice >= subtotal) {
        showFeedback('error', `El precio final debe ser menor que el subtotal (${formatPrice(subtotal)}).`)
        return
      }
      next = { mode: 'finalPrice', finalPrice, reason: manualReason.trim() }
    }

    const replacedCoupon = !!activeCoupon
    setActiveManualDiscount(next)
    if (replacedCoupon) {
      setActiveCoupon(null)
      setCouponCode('')
    }
    showFeedback('success', `Descuento manual aplicado.${replacedCoupon ? ' Se quitó el cupón: los descuentos no se combinan.' : ''}`)
  }

  // «Quitar» next to the discount line: clears whichever discount
  // origin is active (coupon or manual).
  const handleRemoveDiscount = () => {
    setActiveCoupon(null)
    setCouponCode('')
    setActiveManualDiscount(null)
    showFeedback('success', 'Descuento retirado.')
  }

  // The discount comes from the single active origin: coupon OR manual.
  const discount = useMemo(() => {
    if (activeCoupon) return subtotal * (activeCoupon.discount_percent / 100)
    if (!activeManualDiscount) return 0
    return activeManualDiscount.mode === 'percent'
      ? subtotal * (activeManualDiscount.percent / 100)
      : Math.max(0, subtotal - activeManualDiscount.finalPrice)
  }, [activeCoupon, activeManualDiscount, subtotal])

  // Full label of the active discount for the summary line.
  const discountLabel = activeCoupon
    ? `Descuento cupón ${activeCoupon.code} (${activeCoupon.discount_percent}%)`
    : activeManualDiscount?.mode === 'percent'
      ? `Descuento manual (${activeManualDiscount.percent}%)`
      : activeManualDiscount
        ? 'Descuento por precio final'
        : 'Descuento'
  const taxableBase = useMemo(() => subtotal - discount, [subtotal, discount])
  const netSubtotal = useMemo(() => taxableBase / 1.16, [taxableBase])
  const iva = useMemo(() => taxableBase - netSubtotal, [taxableBase, netSubtotal])
  const total = useMemo(() => taxableBase, [taxableBase])

  // Payment inputs and balance calculations. Derived explicitly from
  // the raw field value on every render (comma-tolerant parse), so the
  // «Saldo Pendiente» always reflects what the anticipo field currently
  // holds instead of lagging one edit behind.
  const paidAmount = useMemo(() => {
    const normalized = paidAmountInput.trim().replace(/\s/g, '').replace(',', '.')
    const parsed = parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }, [paidAmountInput])
  const pendingBalance = useMemo(() => Math.max(0, total - paidAmount), [total, paidAmount])

  // Plan de pagos (dictado 2026-11-19): divide el SALDO en cuotas al
  // cobrar. Solo se ofrece con cliente dado de alta — seleccionado o
  // con el nombre tecleado, porque «Continuar solo con el nombre» crea
  // el registro al cobrar — y con saldo pendiente > 0. La fecha del
  // primer pago se precarga a un periodo de la venta (+15 días
  // quincenal / +1 mes mensual) y es editable.
  const [planEnabled, setPlanEnabled] = useState(false)
  const [planCountInput, setPlanCountInput] = useState('4')
  const [planFrequency, setPlanFrequency] = useState<PaymentFrequency>('biweekly')
  const [planFirstDate, setPlanFirstDate] = useState('') // '' = automática según frecuencia
  const planCount = Math.max(1, Math.floor(parseInt(planCountInput, 10) || 0) || 1)
  const planFirstDue = planFirstDate || defaultFirstPaymentDate(planFrequency)
  const planEligible = !!selectedCustomer || customerSearch.trim().length > 0
  const planSchedule = useMemo(
    () => (planEnabled && pendingBalance > 0
      ? buildInstallmentSchedule(pendingBalance, planCount, planFrequency, planFirstDue)
      : []),
    [planEnabled, pendingBalance, planCount, planFrequency, planFirstDue]
  )
  const planFirstDueLabel = (() => {
    const [py, pm, pd] = planFirstDue.split('-').map(Number)
    return new Date(py || 1970, (pm || 1) - 1, pd || 1).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  })()

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
    // Anti double-submit lock (see checkoutLockRef): a second submit
    // while a registration is in flight is ignored outright — every
    // extra click used to create another order.
    if (checkoutLockRef.current) return

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

    // Re-read the anticipo straight from the field: the amount charged
    // must be the one on screen, even if the last change event never
    // reached the state (autofill / swallowed input events).
    const fieldPaidRaw = anticipoInputRef.current?.value ?? paidAmountInput
    const fieldPaidParsed = parseFloat(fieldPaidRaw.trim().replace(/\s/g, '').replace(',', '.'))
    const effectivePaidAmount = Number.isFinite(fieldPaidParsed) ? fieldPaidParsed : paidAmount
    if (fieldPaidRaw !== paidAmountInput) setPaidAmountInput(fieldPaidRaw)
    if (fieldPaidRaw !== '' && effectivePaidAmount < 0) {
      showFeedback('error', 'El monto recibido no puede ser negativo.')
      return
    }

    checkoutLockRef.current = true
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

      // Discount detail line persisted in the sale notes (the owner's
      // dictation: the discount must travel with the sale so the ticket
      // and the history can explain it). Built from the LIVE screen
      // values, so it always matches the stored discount amount.
      const discountReason = activeManualDiscount?.reason || ''
      const discountNoteLine = discount > 0
        ? activeCoupon
          ? `Descuento: cupón ${activeCoupon.code} (${activeCoupon.discount_percent}%) −${formatPrice(discount)}`
          : activeManualDiscount?.mode === 'percent'
            ? `Descuento: manual ${activeManualDiscount.percent}% −${formatPrice(discount)}${discountReason ? ` · Motivo: ${discountReason}` : ''}`
            : activeManualDiscount
              ? `Descuento: precio final de ${formatPrice(subtotal)} a ${formatPrice(activeManualDiscount.finalPrice)} (−${formatPrice(discount)})${discountReason ? ` · Motivo: ${discountReason}` : ''}`
              : ''
        : ''

      // Short explanation of the discount for the WhatsApp ticket.
      const ticketDiscountDetail = discount > 0
        ? [
            activeCoupon
              ? `cupón ${activeCoupon.code}`
              : activeManualDiscount?.mode === 'percent'
                ? `${activeManualDiscount.percent}%`
                : activeManualDiscount
                  ? 'precio final'
                  : '',
            discountReason
          ].filter(Boolean).join(' · ') || undefined
        : undefined

      // Ticket snapshot BEFORE registering/clearing: the lines with the
      // prices actually charged on screen (client price when it applied)
      // and the money figures of this exact sale.
      const ticketLines: TicketLine[] = cart.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        lineTotal: unitPriceOf(item.product) * item.quantity,
        complements: item.complements.map(c => ({
          name: c.name,
          lineTotal: c.price * item.quantity
        }))
      }))
      const ticketPaid = effectivePaidAmount || total

      // Plan de pagos pedido en pantalla: solo viaja si el comprador
      // quedó como REGISTRO de cliente (seleccionado o resuelto del
      // nombre tecleado) y la venta deja saldo. createSale genera las
      // cuotas sobre SU saldo calculado y devuelve el plan aplicado.
      const requestedPlan = planEnabled && buyer?.id && Math.max(0, total - ticketPaid) > 0
        ? { installments: planCount, frequency: planFrequency, firstPaymentDate: planFirstDue }
        : null

      // Register sale with everything captured on screen: the registered
      // customer (when one was selected), the applied coupon and the note.
      const saleResult = await createSale(nameToRegister, items, ticketPaid, paymentMethod, {
        customerId: buyer?.id || null,
        couponId: activeCoupon?.id || null,
        discountApplied: discount,
        notes: saleNotes.trim()
          ? [saleNotes.trim(), discountNoteLine].filter(Boolean).join('\n')
          : discountNoteLine || undefined,
        // The buyer was resolved from the typed name at checkout (exact
        // match or minimal profile just created): the screen charged
        // visitor prices, so the recorded sale keeps those prices.
        chargeAsWalkIn: !selectedCustomer && !!buyer,
        paymentPlan: requestedPlan,
      })
      const appliedPlan = (saleResult as any)?.paymentPlan ?? null

      // Success card with the WhatsApp ticket: it survives the state
      // cleanup below. The reminder period for the closing line comes
      // from the real configuration (fallback: the default 6 months).
      const createdSaleId = (saleResult as any)?.sale?.id as string | undefined
      if (createdSaleId) {
        let reminderMonths = DEFAULT_REMINDER_MONTHS
        try {
          reminderMonths = (await getReminderConfig()).months
        } catch { /* keep the default period */ }
        setLastSale({
          saleId: createdSaleId,
          createdAt: new Date().toISOString(),
          buyerName: nameToRegister,
          buyerPhone: buyer?.customer_profiles?.phone || null,
          lines: ticketLines,
          subtotal,
          discount: discount > 0 ? { amount: discount, detail: ticketDiscountDetail } : null,
          total,
          paid: ticketPaid,
          pendingBalance: Math.max(0, total - ticketPaid),
          reminderMonths,
          paymentPlan: appliedPlan
        })
      }

      showFeedback('success', '¡Venta registrada exitosamente! El inventario se actualizó y se programó la cita de revisión.')
      if (profileCreationFailed) {
        showFeedback('error', 'La venta se registró con el nombre escrito, pero no se pudo crear el perfil del cliente. Agrégalo después en Clientes.')
      }
      if (requestedPlan && !appliedPlan) {
        showFeedback('error', 'La venta se registró, pero el plan de pagos no se generó. El saldo quedó sin plan a plazos.')
      }

      // Clear POS state (coupon AND manual discount, like the rest)
      setCart([])
      setCustomerSearch('')
      setSelectedCustomer(null)
      setShowWalkInWarning(false)
      setShowQuickAdd(false)
      setPaidAmountInput('')
      setPlanEnabled(false)
      setPlanFirstDate('')
      setCouponCode('')
      setActiveCoupon(null)
      setActiveManualDiscount(null)
      setManualMode('percent')
      setManualPercentInput('')
      setManualFinalPriceInput('')
      setManualReason('')
      setSaleNotes('')
      setActiveTab('products')
      
      await loadAllData()
    } catch (e) {
      // Keep the REAL error: log it in full and surface its message on
      // screen. The bare generic text hid the actual database failure
      // (e.g. the sale_items insert rejection) during live diagnosis.
      console.error('Error al registrar la venta:', e)
      const detail = e instanceof Error && e.message ? ` ${e.message}` : ''
      showFeedback('error', `Ocurrió un error al procesar la transacción.${detail}`)
    } finally {
      checkoutLockRef.current = false
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // WhatsApp ticket of the last registered sale (success card): the
  // number is normalized with the same helper the birthdays use, and
  // the message is built from the snapshot taken at checkout.
  const lastSaleWaNumber = lastSale?.buyerPhone ? toWhatsAppNumber(lastSale.buyerPhone) : null
  const lastSaleTicketText = lastSale
    ? buildTicketMessage({
        orderCode: orderCodeFromSaleId(lastSale.saleId),
        date: new Date(lastSale.createdAt),
        lines: lastSale.lines,
        subtotal: lastSale.subtotal,
        discount: lastSale.discount,
        total: lastSale.total,
        paid: lastSale.paid,
        pendingBalance: lastSale.pendingBalance,
        reminderMonths: lastSale.reminderMonths,
        paymentPlan: lastSale.paymentPlan
          ? {
              installments: lastSale.paymentPlan.installments,
              frequency: lastSale.paymentPlan.frequency,
              installmentAmount: lastSale.paymentPlan.installmentAmount,
              firstPaymentDate: lastSale.paymentPlan.firstPaymentDate
            }
          : null
      })
    : ''

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 space-y-4 md:space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      
      {/* Header: en móvil solo la etiqueta chiquita (PageHeader) */}
      <PageHeader title="Realizar Venta">
        <div className="border-b border-[#e7eeff] pb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">
            Realizar Venta
          </h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Registro de ventas y control de inventario.
          </p>
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

      {/* Success card of the last registered sale: persistent (unlike
          the auto-dismissing feedback) and the only place the WhatsApp
          ticket is offered. The POS behind it is already clean. */}
      {lastSale && (
        <div className="bg-[#e2f9ee] border border-[#00422b]/25 rounded-[20px] or-shadow-card p-5 space-y-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold text-[#00422b] flex items-center gap-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              ¡Venta registrada!
            </h3>
            <span className="shrink-0 bg-white/70 text-[#00422b] text-[11px] font-bold px-2.5 py-1 rounded-full tabular-nums">
              Orden #{orderCodeFromSaleId(lastSale.saleId)}
            </span>
          </div>
          <p className="text-sm font-medium text-[#00422b]">
            {lastSale.buyerName} · Total {formatPrice(lastSale.total)}
            {lastSale.pendingBalance > 0 && (
              <> · Saldo pendiente {formatPrice(lastSale.pendingBalance)}</>
            )}
          </p>
          {lastSale.paymentPlan && (
            <p className="text-sm font-bold text-[#00422b] bg-white/60 border border-[#00422b]/15 rounded-xl px-3.5 py-2.5">
              Plan de pagos: {lastSale.paymentPlan.installments} pagos {frequencyPlural(lastSale.paymentPlan.frequency)} de {formatPrice(lastSale.paymentPlan.installmentAmount)}
              {lastSale.paymentPlan.lastInstallmentAmount !== lastSale.paymentPlan.installmentAmount && (
                <> (último de {formatPrice(lastSale.paymentPlan.lastInstallmentAmount)})</>
              )}
              {' '}· primer pago el {(() => {
                const [py, pm, pd] = lastSale.paymentPlan.firstPaymentDate.split('-').map(Number)
                return new Date(py || 1970, (pm || 1) - 1, pd || 1).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
              })()}
            </p>
          )}
          {lastSaleWaNumber ? (
            <a
              href={`https://wa.me/${lastSaleWaNumber}?text=${encodeURIComponent(lastSaleTicketText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl px-4 flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar ticket por WhatsApp
            </a>
          ) : (
            <p className="text-[13px] font-semibold text-[#737784]">
              Sin teléfono registrado: el ticket no se puede enviar por WhatsApp.
            </p>
          )}
          <button
            type="button"
            onClick={() => setLastSale(null)}
            className="w-full min-h-[44px] bg-white border border-[#00422b]/25 text-[#00422b] text-sm font-bold rounded-xl px-4 hover:bg-white/60 transition-colors cursor-pointer"
          >
            Nueva venta
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-sm text-[#737784] font-bold">Cargando ventas...</p>
        </div>
      ) : (
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
                        placeholder="Buscar por marca, nombre o tipo de lente..."
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
                                {/* Precio de la LÍNEA = solo el producto
                                    × cantidad (dictado del dueño,
                                    2026-11-19): los complementos NO se
                                    suman aquí — van como sublíneas con
                                    su precio y la suma vive en el
                                    TOTAL del carrito. */}
                                <span className="font-bold text-[#00357f] tabular-nums text-right shrink-0">
                                  {formatPrice(unitPriceOf(item.product) * item.quantity)}
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

                      {/* Customer selector: mismo comportamiento que
                          el de la Agenda (dictado 2026-11-19) — clic
                          abre el combo con TODOS los clientes, escribir
                          filtra, «Registrar nuevo cliente» va primero
                          y el walk-in sigue en el estado vacío. */}
                      <div className="relative space-y-1 text-left" ref={customerPickerRef}>
                        <label className="block text-[13px] font-semibold text-[#434653] mb-1">
                          Buscar Cliente / CRM
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Escribe el nombre del cliente..."
                            value={selectedCustomer ? selectedCustomer.full_name : customerSearch}
                            onChange={(e) => {
                              suppressCustomerAutoOpenRef.current = false
                              customerPickerInteractedRef.current = true
                              setCustomerSearch(e.target.value)
                              setSelectedCustomer(null)
                              setShowCustomerSuggestions(true)
                              setShowQuickAdd(false)
                              setQuickError('')
                              if (!e.target.value.trim()) setShowWalkInWarning(false)
                            }}
                            onFocus={() => {
                              // Primer toque: se arma la apertura y el
                              // combo se despliega con todos los clientes.
                              suppressCustomerAutoOpenRef.current = false
                              customerPickerInteractedRef.current = true
                              setShowCustomerSuggestions(true)
                            }}
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                          {selectedCustomer && (
                            <button
                              type="button"
                              onClick={() => {
                                // Como la basura de la Agenda: quitar la
                                // selección deja la lista CERRADA hasta
                                // que el usuario vuelva a tocar el campo.
                                suppressCustomerAutoOpenRef.current = true
                                setSelectedCustomer(null)
                                setCustomerSearch('')
                                setShowWalkInWarning(false)
                                setShowCustomerSuggestions(false)
                                setShowQuickAdd(false)
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ba1a1a] hover:text-[#93000a] text-xs font-bold cursor-pointer px-1 py-1"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {showCustomerSuggestions && !selectedCustomer && (
                          <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-[#dee8ff] rounded-2xl overflow-y-auto shadow-lg max-h-[380px]">
                            {showQuickAdd ? (
                              <div className="p-4 space-y-3 text-left">
                                  <div className="space-y-3">
                                    <p className="text-sm font-bold text-[#00357f]">Registrar nuevo cliente</p>
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
                                      {/* Prefijo elegible (+52 default sin el «1»): quickPhone guarda el valor compuesto */}
                                      <PhoneInput
                                        value={quickPhone}
                                        onChange={setQuickPhone}
                                        selectClassName="bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-2 py-2.5 text-sm text-[#111c2d] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors cursor-pointer shrink-0"
                                        customPrefixClassName="w-[72px] shrink-0 bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-2 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                                        inputClassName="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
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
                              </div>
                            ) : (
                              <div className="divide-y divide-[#f0f3ff]">
                                {/* Primera opción SIEMPRE: el alta rápida,
                                    como en la Agenda (dictado 2026-11-19). */}
                                <button
                                  type="button"
                                  onClick={openQuickAdd}
                                  className="w-full text-left px-3.5 py-2.5 min-h-[48px] hover:bg-[#dee8ff]/30 text-sm font-bold text-[#00357f] flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <UserPlus className="w-4 h-4" /> Registrar nuevo cliente
                                </button>
                                {filteredCustomers.length === 0 ? (
                                  <div className="p-4 space-y-3 text-left">
                                    {customerSearch.trim() ? (
                                      <>
                                        <p className="text-sm text-[#434653] font-semibold">
                                          &ldquo;{customerSearch.trim()}&rdquo; no está registrado.
                                        </p>
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
                                      </>
                                    ) : (
                                      <p className="text-sm text-[#737784] font-medium">Sin clientes registrados todavía.</p>
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

                      {/* Manual counter discount (owner's dictation):
                          percentage OR final price, with an optional
                          reason. Exclusive with the coupon — applying
                          one removes the other. */}
                      <div className="space-y-2.5 border-t border-[#f0f3ff] pt-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[#434653]">Descuento manual</span>
                          <div className="flex bg-[#f0f3ff] rounded-full p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setManualMode('percent')}
                              className={`px-3 min-h-[32px] rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                manualMode === 'percent' ? 'bg-[#00357f] text-white' : 'text-[#737784] hover:text-[#00357f]'
                              }`}
                            >
                              Porcentaje %
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualMode('finalPrice')}
                              className={`px-3 min-h-[32px] rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                manualMode === 'finalPrice' ? 'bg-[#00357f] text-white' : 'text-[#737784] hover:text-[#00357f]'
                              }`}
                            >
                              Precio final $
                            </button>
                          </div>
                        </div>
                        <form onSubmit={handleApplyManualDiscount} className="space-y-2">
                          {manualMode === 'percent' ? (
                            <input
                              type="number"
                              min="1"
                              max="100"
                              step="0.01"
                              placeholder="Porcentaje de descuento (1–100)"
                              value={manualPercentInput}
                              onChange={(e) => setManualPercentInput(e.target.value)}
                              disabled={subtotal === 0}
                              className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] tabular-nums transition-colors"
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Precio final que pagará el cliente"
                              value={manualFinalPriceInput}
                              onChange={(e) => setManualFinalPriceInput(e.target.value)}
                              disabled={subtotal === 0}
                              className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] tabular-nums transition-colors"
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Motivo del descuento (opcional)"
                            value={manualReason}
                            onChange={(e) => setManualReason(e.target.value)}
                            disabled={subtotal === 0}
                            className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-2 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={subtotal === 0}
                            className="w-full bg-white border border-[#dee8ff] text-sm font-bold rounded-xl text-[#00357f] hover:bg-[#dee8ff]/30 min-h-[44px] cursor-pointer transition-colors disabled:opacity-50"
                          >
                            Aplicar descuento
                          </button>
                        </form>
                        <p className="text-[11px] font-medium text-[#737784]">
                          El descuento manual y el cupón no se combinan: aplicar uno quita el otro.
                        </p>
                      </div>

                    </div>

                    {/* Payment values */}
                    <form onSubmit={handleCheckout} className="mt-6 pt-4 border-t border-[#dee8ff] space-y-4 text-left">

                      <div className="space-y-1.5 bg-[#f9f9ff] p-4 rounded-2xl text-sm font-medium">
                        <div className="flex justify-between text-[#737784]">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{formatPrice(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between items-center gap-2 text-[#00422b] font-bold">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="truncate">{discountLabel}</span>
                              <button
                                type="button"
                                onClick={handleRemoveDiscount}
                                className="shrink-0 text-[11px] font-bold text-[#ba1a1a] bg-[#ffdad6] hover:bg-[#ffc9c4] rounded-full px-2 py-0.5 cursor-pointer transition-colors"
                              >
                                Quitar
                              </button>
                            </span>
                            <span className="tabular-nums shrink-0">−{formatPrice(discount)}</span>
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
                            ref={anticipoInputRef}
                            type="number"
                            step="0.01"
                            placeholder={total.toFixed(2)}
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            onInput={(e) => setPaidAmountInput(e.currentTarget.value)}
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

                      {/* Plan de pagos (dictado 2026-11-19): con saldo
                          pendiente y cliente dado de alta (seleccionado
                          o solo-nombre), el interruptor despliega N°
                          de pagos, frecuencia y primer pago, con vista
                          previa en vivo. Sin cliente alguno, la nota
                          empuja al alta. */}
                      {pendingBalance > 0 && subtotal > 0 && (
                        planEligible ? (
                          <div className="border border-[#dee8ff] rounded-xl p-3.5 space-y-3 bg-[#f9f9ff]">
                            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                              <span>
                                <span className="block text-[13px] font-semibold text-[#434653]">Dividir el saldo en pagos</span>
                                <span className="block text-[11px] text-[#737784] font-medium">Genera las cuotas del saldo al registrar la venta.</span>
                              </span>
                              <input
                                type="checkbox"
                                checked={planEnabled}
                                onChange={(e) => setPlanEnabled(e.target.checked)}
                                className="w-5 h-5 shrink-0 accent-[#00357f] cursor-pointer"
                              />
                            </label>
                            {planEnabled && (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[13px] font-semibold text-[#434653] mb-1.5">
                                      Número de pagos
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={planCountInput}
                                      onChange={(e) => setPlanCountInput(e.target.value)}
                                      className="w-full bg-white border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] tabular-nums transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[13px] font-semibold text-[#434653] mb-1.5">
                                      Frecuencia
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {[
                                        { id: 'biweekly', label: 'Quincenal' },
                                        { id: 'monthly', label: 'Mensual' }
                                      ].map((f) => (
                                        <button
                                          key={f.id}
                                          type="button"
                                          onClick={() => setPlanFrequency(f.id as PaymentFrequency)}
                                          className={`py-2 text-sm font-semibold rounded-full border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                                            planFrequency === f.id
                                              ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                                              : 'bg-white border-[#dee8ff] text-[#737784] hover:bg-[#dee8ff]/30'
                                          }`}
                                        >
                                          {f.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[13px] font-semibold text-[#434653] mb-1.5">
                                    Fecha del primer pago
                                  </label>
                                  <input
                                    type="date"
                                    value={planFirstDue}
                                    onChange={(e) => setPlanFirstDate(e.target.value)}
                                    className="w-full bg-white border border-[#dee8ff] rounded-xl px-4 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                                  />
                                </div>
                                {planSchedule.length > 0 && (
                                  <p className="text-xs font-bold text-[#00357f] bg-[#dee8ff]/50 border border-[#00357f]/15 rounded-xl px-3.5 py-2.5">
                                    {planCount} pagos de {formatPrice(planSchedule[0].amount)} · {frequencyEvery(planFrequency)} · primer pago el {planFirstDueLabel}
                                    {planSchedule.length > 1 && planSchedule[planSchedule.length - 1].amount !== planSchedule[0].amount && (
                                      <> · último de {formatPrice(planSchedule[planSchedule.length - 1].amount)}</>
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] font-bold text-[#92400e] bg-[#fef3c7] border border-[#92400e]/20 rounded-xl px-3.5 py-2.5">
                            Para plan de pagos, registra al cliente (aunque sea solo su nombre).
                          </p>
                        )
                      )}

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
