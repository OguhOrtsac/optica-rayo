import { Database } from '@/types/database.types'
import {
  buildInstallmentSchedule,
  summarizePlan,
  type PaymentPlanInput,
  type PaymentPlanSummary,
} from './payment-plan'
import { effectiveClientPrice } from './pricing'

type Product = Database['public']['Tables']['products']['Row']
type Coupon = Database['public']['Tables']['coupons']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']
type Sale = Database['public']['Tables']['sales']['Row']
type SaleItem = Database['public']['Tables']['sale_items']['Row']

// Initial mock products
export let MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Armazón Aviador Carbono',
    description: 'Armazón metálico estilo aviador ultraligero con terminales de fibra de carbono. Ideal para lentes graduados.',
    price: 1899.00,
    stock: 12,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=600&q=80',
    is_promo: true,
    is_featured: true,
    client_price: null,
    brand: 'Rayo Studio',
    material: 'Metal y fibra de carbono',
    sku: 'RAY-AVI-001',
    frame_shape: 'aviator',
    color: 'Negro carbono',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p2',
    name: 'Mica Anti-Reflejante Blue Shield',
    description: 'Micas graduadas con tratamiento anti-reflejante premium y filtro de protección para luz azul de pantallas.',
    price: 1200.00,
    stock: 50,
    category: 'lenses',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Blue Shield',
    material: 'Policarbonato',
    sku: 'MIC-BLUE-001',
    frame_shape: null,
    color: 'Transparente',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p3',
    name: 'Lentes de Contacto Acuvue Oasys (Caja/6)',
    description: 'Lentes de contacto desechables quincenales. Alta hidratación para ojos secos.',
    price: 850.00,
    stock: 8,
    category: 'contact_lenses',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Acuvue',
    material: 'Hidrogel de silicona',
    sku: 'ACU-OAS-006',
    frame_shape: null,
    color: 'Transparente',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p4',
    name: 'Armazón Carey Vintage',
    description: 'Armazón de acetato italiano color carey de forma redonda clásica.',
    price: 2450.00,
    stock: 3,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80',
    is_promo: false,
    is_featured: true,
    client_price: null,
    brand: 'Rayo Vintage',
    material: 'Acetato italiano',
    sku: 'RAY-CAR-002',
    frame_shape: 'round',
    color: 'Carey',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p5',
    name: 'Kit de Limpieza Opti-Clean',
    description: 'Líquido limpiador anti-empañante de 60ml y paño de microfibra de alta calidad.',
    price: 150.00,
    stock: 25,
    category: 'accessories',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Rayo Care',
    material: 'Plástico',
    sku: 'ACC-CLEAN-001',
    frame_shape: null,
    color: 'Transparente',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p6',
    name: 'Ray-Ban Clubmaster Classic',
    description: 'Lentes de sol icónicos con montura de acetato negro premium y detalles metálicos dorados. Estilo vintage clásico de alta distinción.',
    price: 3599.00,
    stock: 8,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=600&q=80',
    is_promo: true,
    is_featured: true,
    client_price: 2999.00,
    brand: 'Ray-Ban',
    material: 'Acetato y metal',
    sku: 'RB-CLUB-001',
    frame_shape: 'square',
    color: 'Negro y dorado',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p7',
    name: 'Oakley Holbrook Polarized',
    description: 'Gafas de sol deportivas con micas polarizadas Prizm de espejo azul. Montura O Matter negra mate ultra duradera.',
    price: 4200.00,
    stock: 2,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80',
    is_promo: false,
    is_featured: true,
    client_price: 3499.00,
    brand: 'Oakley',
    material: 'O Matter',
    sku: 'OAK-HOL-001',
    frame_shape: 'square',
    color: 'Negro mate',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p8',
    name: 'Gucci GG Rectangular Black',
    description: 'Armazón oftálmico rectangular de acetato negro de alta gama con las patillas grabadas con la banda web característica de Gucci.',
    price: 6899.00,
    stock: 5,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=600&q=80',
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Gucci',
    material: 'Acetato',
    sku: 'GUC-REC-001',
    frame_shape: 'rectangular',
    color: 'Negro',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p9',
    name: 'Carrera Sport Navigator',
    description: 'Gafas de sol de aviador contemporáneas con montura metálica fina, doble puente negro y patillas con inserciones de goma deportiva.',
    price: 2950.00,
    stock: 15,
    category: 'frames',
    image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80',
    is_promo: true,
    is_featured: true,
    client_price: null,
    brand: 'Carrera',
    material: 'Metal',
    sku: 'CAR-NAV-001',
    frame_shape: 'aviator',
    color: 'Negro',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p10',
    name: 'Mica Progresiva Varilux Physio',
    description: 'Lentes progresivos de alta definición con transición de campos visuales fluida y tratamiento antirreflejante de alta duración Crizal.',
    price: 4800.00,
    stock: 30,
    category: 'lenses',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Varilux',
    material: 'Alto índice',
    sku: 'MIC-VAR-001',
    frame_shape: null,
    color: 'Transparente',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p11',
    name: 'Mica Transitions Crizal Sapphire',
    description: 'Micas inteligentes con cambio de tonalidad fotosensible Transitions gris de alta velocidad. Antirreflejante Sapphire premium.',
    price: 3600.00,
    stock: 45,
    category: 'lenses',
    image_url: null,
    is_promo: true,
    is_featured: false,
    client_price: null,
    brand: 'Essilor',
    material: 'Policarbonato',
    sku: 'MIC-TRA-001',
    frame_shape: null,
    color: 'Gris fotosensible',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p12',
    name: 'Lentes de Contacto Biofinity Toric (Caja/6)',
    description: 'Lentes de contacto mensuales de hidrogel de silicona diseñados específicamente para corregir altos grados de astigmatismo. Transpirables.',
    price: 1450.00,
    stock: 10,
    category: 'contact_lenses',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Biofinity',
    material: 'Hidrogel de silicona',
    sku: 'BIO-TOR-006',
    frame_shape: null,
    color: 'Transparente',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'p13',
    name: 'Estuche Rígido de Piel Rayo',
    description: 'Estuche de lujo fabricado en piel genuina color tabaco curtida artesanalmente. Interior afelpado suave de terciopelo anti-rayaduras.',
    price: 450.00,
    stock: 3,
    category: 'accessories',
    image_url: null,
    is_promo: false,
    is_featured: false,
    client_price: null,
    brand: 'Rayo',
    material: 'Piel genuina',
    sku: 'ACC-CASE-001',
    frame_shape: null,
    color: 'Tabaco',
    gallery_urls: [],
    image_alt: null,
    display_order: null,
    created_at: new Date().toISOString()
  }
]

// Initial mock coupons (max_uses NULL = ilimitado, dictado 2026-11-19)
export let MOCK_COUPONS: Coupon[] = [
  {
    id: 'c1',
    code: 'RAYO15',
    discount_percent: 15,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    is_active: true,
    created_at: new Date().toISOString(),
    max_uses: null
  },
  {
    id: 'c2',
    code: 'BIENVENIDO',
    discount_percent: 10,
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    max_uses: null
  },
  {
    id: 'c3',
    code: 'EXPIRED20',
    discount_percent: 20,
    valid_until: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // expired
    is_active: true,
    created_at: new Date().toISOString(),
    max_uses: null
  }
]

// Initial mock reminders
export let MOCK_REMINDERS: (Reminder & { customer_name?: string })[] = [
  {
    id: 'r1',
    customer_id: 'cust-1',
    customer_name: 'Carlos Mendoza',
    last_visit_date: new Date(Date.now() - 340 * 24 * 60 * 60 * 1000).toISOString(), // ~11 months ago
    next_suggested_visit: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // in 25 days
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'r2',
    customer_id: 'cust-2',
    customer_name: 'Ana Sofia Gomez',
    last_visit_date: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // ~13 months ago (overdue)
    next_suggested_visit: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // overdue
    status: 'pending',
    created_at: new Date().toISOString()
  }
]

// Initial mock sales
export let MOCK_SALES: (Sale & { customer_name?: string; seller_name?: string })[] = [
  {
    id: 's1',
    customer_id: 'cust-1',
    customer_name: 'Carlos Mendoza',
    seller_id: 'sell-1',
    seller_name: 'Patricia Vendedora',
    exam_id: null,
    coupon_id: null,
    discount_applied: 0,
    notes: null,
    total: 3099.00,
    paid_amount: 3099.00,
    pending_balance: 0.00,
    payment_method: 'cash',
    status: 'Entregado',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 's2',
    customer_id: 'cust-2',
    customer_name: 'Ana Sofia Gomez',
    seller_id: 'sell-1',
    seller_name: 'Patricia Vendedora',
    exam_id: null,
    coupon_id: null,
    discount_applied: 0,
    notes: null,
    total: 2450.00,
    paid_amount: 2450.00,
    pending_balance: 0.00,
    payment_method: 'card',
    status: 'Entregado',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    // Venta a plazos de Carlos Mendoza: total $2,400, anticipo $800 y
    // una cuota de $400 ya pagada (paid_amount $1,200); el plan original
    // dividió el saldo de $1,600 en 4 cuotas quincenales de $400 y
    // quedan 3 pendientes = saldo $1,200. Es el caso de verificación de
    // la REESTRUCTURACIÓN (dictado 2026-11-19): +$200 y 4 quincenales
    // deben dar saldo $1,400 en 4 cuotas de $350 con la pagada intacta.
    id: 's3',
    customer_id: 'cust-1',
    customer_name: 'Carlos Mendoza',
    seller_id: 'sell-1',
    seller_name: 'Patricia Vendedora',
    exam_id: null,
    coupon_id: null,
    discount_applied: 0,
    notes: null,
    total: 2400.00,
    paid_amount: 1200.00,
    pending_balance: 1200.00,
    payment_method: 'cash',
    status: 'Anticipo_Pagado',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export let MOCK_SALE_ITEMS: SaleItem[] = [
  {
    id: 'si1',
    sale_id: 's1',
    product_id: 'p1',
    quantity: 1,
    price: 1899.00,
    is_complement: false,
    complement_name: null,
    complement_for: null
  },
  {
    id: 'si2',
    sale_id: 's1',
    product_id: 'p2',
    quantity: 1,
    price: 1200.00,
    is_complement: false,
    complement_name: null,
    complement_for: null
  },
  {
    id: 'si3',
    sale_id: 's2',
    product_id: 'p4',
    quantity: 1,
    price: 2450.00,
    is_complement: false,
    complement_name: null,
    complement_for: null
  },
  {
    id: 'si4',
    sale_id: 's3',
    product_id: 'p2',
    quantity: 2,
    price: 1200.00,
    is_complement: false,
    complement_name: null,
    complement_for: null
  }
]

// Helper functions to mutate mock state (simulating API writes in memory)
export function addMockProduct(product: Omit<Product, 'id' | 'created_at'>) {
  const newProduct: Product = {
    ...product,
    id: 'p_' + Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString()
  }
  MOCK_PRODUCTS = [newProduct, ...MOCK_PRODUCTS]
  return newProduct
}

export function updateMockProductStock(id: string, newStock: number) {
  MOCK_PRODUCTS = MOCK_PRODUCTS.map(p => p.id === id ? { ...p, stock: newStock } : p)
}

/**
 * Demo-mode counterpart of saveProductsOrder (lib/services.ts): stamps
 * each product's display_order from the dragged id sequence and sorts
 * the in-memory catalog to match, so the demo behaves like the real
 * catalog until the session ends. Ids not in the sequence keep their
 * previous relative order at the end.
 */
export function reorderMockProducts(orderedIds: string[]) {
  const position = new Map(orderedIds.map((id, i) => [id, i + 1]))
  MOCK_PRODUCTS = [...MOCK_PRODUCTS]
    .map(p => ({ ...p, display_order: position.get(p.id) ?? p.display_order ?? null }))
    .sort((a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER))
}

export function addMockSale(
  customerName: string,
  items: { productId: string; quantity: number; complements?: { name: string; price: number }[] }[],
  paidAmount?: number,
  paymentMethod?: 'cash' | 'card' | 'transfer',
  extras?: {
    customerId?: string | null
    couponId?: string | null
    discountApplied?: number
    notes?: string | null
    plan?: PaymentPlanInput | null
    memberDiscountPercent?: number
  }
): { sale: (typeof MOCK_SALES)[number]; items: SaleItem[]; paymentPlan: PaymentPlanSummary | null } {
  const customerId = extras?.customerId || 'cust_' + Math.random().toString(36).substr(2, 9)

  // Member pricing mirrors the real createSale: a sale linked to a
  // registered mock customer charges the client price (special
  // client_price or the member discount over the list price), so the
  // demo totals, pending balance and plan installments match what the
  // POS preview showed. Walk-in sales keep list prices.
  const buyerIsRegisteredCustomer =
    !!extras?.customerId && MOCK_CUSTOMER_PROFILES.some(c => c.id === extras.customerId)
  const memberPct = buyerIsRegisteredCustomer ? (extras?.memberDiscountPercent ?? 0) : 0

  let grossTotal = 0
  const saleId = 's_' + Math.random().toString(36).substr(2, 9)
  const itemsToAdd: SaleItem[] = []

  items.forEach(item => {
    const product = MOCK_PRODUCTS.find(p => p.id === item.productId)
    if (product) {
      const price = buyerIsRegisteredCustomer
        ? effectiveClientPrice(product.price, product.client_price, memberPct)
        : product.price
      grossTotal += price * item.quantity
      itemsToAdd.push({
        id: 'si_' + Math.random().toString(36).substr(2, 9),
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        price,
        is_complement: false,
        complement_name: null,
        complement_for: null
      })
      // Complements persist as their own rows, like the real createSale.
      for (const c of item.complements || []) {
        if (!c.name?.trim()) continue
        const cPrice = Math.max(0, c.price || 0)
        grossTotal += cPrice * item.quantity
        itemsToAdd.push({
          id: 'si_' + Math.random().toString(36).substr(2, 9),
          sale_id: saleId,
          product_id: null,
          quantity: item.quantity,
          price: cPrice,
          is_complement: true,
          complement_name: c.name.trim(),
          complement_for: product.name
        })
      }
      // Decrement stock
      updateMockProductStock(item.productId, Math.max(0, product.stock - item.quantity))
    }
  })

  const discountApplied = Math.min(Math.max(0, extras?.discountApplied || 0), grossTotal)
  const total = grossTotal - discountApplied
  const finalPaidAmount = paidAmount !== undefined ? paidAmount : total
  const pendingBalance = Math.max(0, total - finalPaidAmount)

  // Status computation for workshop
  let statusVal: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado' = 'Cotizacion'
  if (finalPaidAmount >= total) {
    statusVal = 'Listo_Entrega'
  } else if (finalPaidAmount > 0) {
    statusVal = 'Anticipo_Pagado'
  }

  const newSale = {
    id: saleId,
    customer_id: customerId,
    customer_name: customerName,
    seller_id: 'sell-current',
    seller_name: 'Vendedor Actual',
    exam_id: null,
    coupon_id: extras?.couponId || null,
    discount_applied: discountApplied,
    notes: extras?.notes?.trim() ? extras.notes.trim() : null,
    total,
    paid_amount: finalPaidAmount,
    pending_balance: pendingBalance,
    payment_method: paymentMethod || 'cash',
    status: statusVal,
    created_at: new Date().toISOString()
  }

  MOCK_SALES = [newSale, ...MOCK_SALES]
  MOCK_SALE_ITEMS = [...MOCK_SALE_ITEMS, ...itemsToAdd]

  // Plan de pagos del POS (dictado 2026-11-19): las cuotas mock
  // equivalentes, para que Cobranza y Pagos diferidos las muestren
  // igual que con base real.
  let paymentPlan: PaymentPlanSummary | null = null
  if (extras?.plan && pendingBalance > 0) {
    const schedule = buildInstallmentSchedule(
      pendingBalance,
      extras.plan.installments,
      extras.plan.frequency,
      extras.plan.firstPaymentDate
    )
    MOCK_PAYMENT_INSTALLMENTS = [
      ...MOCK_PAYMENT_INSTALLMENTS,
      ...schedule.map(spec => ({
        id: 'i_' + Math.random().toString(36).substr(2, 9),
        sale_id: saleId,
        installment_number: spec.installment_number,
        due_date: new Date(`${spec.due_date}T12:00:00`).toISOString(),
        amount: spec.amount,
        amount_paid: 0,
        status: 'pending' as const,
        created_at: new Date().toISOString()
      }))
    ]
    paymentPlan = summarizePlan(pendingBalance, extras.plan, schedule)
  }

  // Create a auto reminder for 12 months from now for this new sale
  const newReminder: Reminder & { customer_name?: string } = {
    id: 'r_' + Math.random().toString(36).substr(2, 9),
    customer_id: customerId,
    customer_name: customerName,
    last_visit_date: new Date().toISOString(),
    next_suggested_visit: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    status: 'pending',
    created_at: new Date().toISOString()
  }
  MOCK_REMINDERS = [newReminder, ...MOCK_REMINDERS]

  return { sale: newSale, items: itemsToAdd, paymentPlan }
}

/**
 * Demo-mode counterpart of the restructure server action
 * (app/customers/actions.ts): same math and same invariants — el
 * recargo suma a total y pending_balance, las cuotas NO liquidadas se
 * sustituyen (las parciales también: lo abonado ya vive neto en el
 * paid_amount de la venta y el plan nuevo divide el saldo vigente),
 * las liquidadas quedan intactas y Σ cuotas nuevas == saldo nuevo.
 */
export function restructureMockSalePayments(
  saleId: string,
  input: { feeAmount: number; installmentsCount: number; frequency: 'weekly' | 'biweekly' | 'monthly'; firstDueDate: string }
): { sale: (typeof MOCK_SALES)[number]; refinancing: MockSaleRefinancing } | null {
  const sale = MOCK_SALES.find(s => s.id === saleId)
  if (!sale) return null

  const isSettled = (i: MockPaymentInstallment) =>
    i.status === 'paid' || Number(i.amount_paid || 0) >= Number(i.amount || 0)
  const saleInsts = MOCK_PAYMENT_INSTALLMENTS.filter(i => i.sale_id === saleId)
  const kept = saleInsts.filter(isSettled)
  const replaced = saleInsts.filter(i => !isSettled(i))

  const fee = Math.max(0, input.feeAmount || 0)
  const previousPaid = Number(sale.paid_amount || 0)
  const previousPending = Number(sale.pending_balance || 0)
  const newPending = previousPending + fee
  const newTotal = Number(sale.total || 0) + fee

  sale.total = newTotal
  sale.pending_balance = newPending
  if (fee > 0) {
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    const linea = `Refinanciación ${fecha}: +$${fee.toFixed(2)} por reestructura de pagos`
    sale.notes = sale.notes ? `${sale.notes}\n${linea}` : linea
  }

  MOCK_PAYMENT_INSTALLMENTS = MOCK_PAYMENT_INSTALLMENTS.filter(
    i => !(i.sale_id === saleId && !isSettled(i))
  )
  const startNumber = kept.reduce((m, i) => Math.max(m, i.installment_number), 0) + 1
  const schedule = buildInstallmentSchedule(
    newPending,
    input.installmentsCount,
    input.frequency,
    input.firstDueDate,
    startNumber
  )
  MOCK_PAYMENT_INSTALLMENTS = [
    ...MOCK_PAYMENT_INSTALLMENTS,
    ...schedule.map(spec => ({
      id: 'i_' + Math.random().toString(36).substr(2, 9),
      sale_id: saleId,
      installment_number: spec.installment_number,
      due_date: new Date(`${spec.due_date}T12:00:00`).toISOString(),
      amount: spec.amount,
      amount_paid: 0,
      status: 'pending' as const,
      created_at: new Date().toISOString()
    }))
  ]

  const refinancing: MockSaleRefinancing = {
    id: 'ref_' + Math.random().toString(36).substr(2, 9),
    sale_id: saleId,
    customer_id: sale.customer_id,
    created_at: new Date().toISOString(),
    created_by: null,
    previous_paid_amount: previousPaid,
    previous_pending_balance: previousPending,
    replaced_installments: replaced.length,
    fee_amount: fee,
    new_total: newTotal,
    installments_count: Math.max(1, Math.floor(input.installmentsCount) || 1),
    frequency: input.frequency,
    first_due_date: input.firstDueDate,
    installment_amount: schedule[0]?.amount ?? 0
  }
  MOCK_SALE_REFINANCINGS = [refinancing, ...MOCK_SALE_REFINANCINGS]

  return { sale, refinancing }
}

/** Demo-mode coupon writes (espejo de createCoupon/updateCoupon). */
export function addMockCoupon(input: Omit<Coupon, 'id' | 'created_at'>): Coupon {
  const coupon: Coupon = {
    ...input,
    id: 'c_' + Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString()
  }
  MOCK_COUPONS = [coupon, ...MOCK_COUPONS]
  return coupon
}

export function updateMockCoupon(id: string, patch: Partial<Coupon>): Coupon | null {
  MOCK_COUPONS = MOCK_COUPONS.map(c => (c.id === id ? { ...c, ...patch } : c))
  return MOCK_COUPONS.find(c => c.id === id) ?? null
}

export function updateMockSaleStatus(id: string, newStatus: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado') {
  MOCK_SALES = MOCK_SALES.map(s => s.id === id ? { ...s, status: newStatus } : s)
  return true
}

export let MOCK_PROFILES = [
  { id: 'super-1', email: 'superadmin@opticarayo.com', full_name: 'Super Administrador', role: 'super_admin', temporal_password_changed: true },
  { id: 'owner-1', email: 'dueno@opticarayo.com', full_name: 'Ing. Hugo Ortsac', role: 'owner', temporal_password_changed: true },
  { id: 'sell-1', email: 'vendedora@opticarayo.com', full_name: 'Patricia Vendedora', role: 'seller', temporal_password_changed: true },
  { id: 'opt-1', email: 'optometrista@opticarayo.com', full_name: 'Dr. Hugo Optometrista', role: 'optometrist', temporal_password_changed: true },
  { id: 'cust-1', email: 'carlos@gmail.com', full_name: 'Carlos Mendoza', role: 'customer', temporal_password_changed: true },
  { id: 'cust-2', email: 'sofia@gmail.com', full_name: 'Ana Sofia Gomez', role: 'customer', temporal_password_changed: true },
  // Ana Paula es la clienta de la cita demo de las 10:30 (lib/appointments.ts):
  // su customer_id enlaza esa cita con su expediente para el botón
  // «Realizar examen» de la Agenda.
  { id: 'cust-3', email: 'ana.paula.gutierrez@clientes.rayo.demo', full_name: 'Ana Paula Gutiérrez Mendoza', role: 'customer', temporal_password_changed: true }
]

export let MOCK_CUSTOMER_PROFILES = [
  { id: 'cust-1', phone: '(555) 987-6543', date_of_birth: '1988-03-08', occupation: 'Ingeniero de sistemas', medical_notes: 'Sensibilidad a la luz azul. Usa micas anti-reflejantes.' },
  { id: 'cust-2', phone: '(555) 456-7890', date_of_birth: '1995-07-21', occupation: 'Diseñadora gráfica', medical_notes: 'Paciente con astigmatismo elevado en ojo izquierdo.' },
  { id: 'cust-3', phone: '5214441230103', date_of_birth: '1992-09-17', occupation: 'Maestra', medical_notes: '' }
]

export let MOCK_CLINICAL_EXAMS = [
  {
    id: 'e1',
    customer_id: 'cust-1',
    examiner_id: 'opt-1',
    exam_date: new Date(Date.now() - 340 * 24 * 60 * 60 * 1000).toISOString(),
    od_sphere: -1.5,
    od_cylinder: -0.5,
    od_axis: 180,
    od_add: 1.0,
    od_visual_acuity: '20/20',
    oi_sphere: -1.75,
    oi_cylinder: -0.25,
    oi_axis: 170,
    oi_add: 1.0,
    oi_visual_acuity: '20/20',
    pd_distance: 63.0,
    pd_near: 60.0,
    lens_type: 'Monofocal',
    treatment: 'Anti-Reflejante premium',
    next_exam_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    // Historia clínica de ejemplo (la hoja en papel, ver
    // lib/clinical-history.ts): la RX inicial difiere un poco de la
    // RX Final guardada arriba, como pasa en la práctica.
    clinical_history: {
      bothersLights: 'si',
      usedGlassesBefore: 'si',
      glassesTime: '4 años',
      lastExamDate: '2023-11-20',
      occupation: 'Ingeniero de sistemas',
      eyeSurgery: 'no',
      eyeSurgeryDetail: null,
      hypertensionDiabetes: 'ninguna',
      medications: 'no',
      medicationsDetail: null,
      familyUsesGlasses: 'si',
      screenTime: '9 horas al día',
      vaScFar: { od: '20/60', oi: '20/70', ao: '20/50' },
      vaScNear: { od: '20/40', oi: '20/40', ao: '20/30' },
      vaCcFar: { od: '20/20', oi: '20/20', ao: '20/20' },
      vaCcNear: { od: '20/25', oi: '20/25', ao: '20/20' },
      retinoscopy: { od: '-1.75', oi: '-2.00' },
      dipOd: 31.5,
      dipOi: 31.5,
      rx: {
        od: { sphere: -1.75, cylinder: -0.5, axis: 175, add: 1.0 },
        oi: { sphere: -2.0, cylinder: -0.25, axis: 165, add: 1.0 }
      },
      observations: 'Paciente refiere fatiga visual al final del día; se sugiere control en 6 meses.'
    }
  }
]

export let MOCK_LENS_MATERIALS = [
  { id: 'mat-1', name: 'Resina Básica CR-39', price: 350.00 },
  { id: 'mat-2', name: 'Policarbonato (Resistente a impactos)', price: 650.00 },
  { id: 'mat-3', name: 'Alto Índice 1.67 (Extra delgada)', price: 1290.00 },
  { id: 'mat-4', name: 'Lente de Contacto (Par)', price: 800.00 }
]

export let MOCK_LENS_TREATMENTS = [
  { id: 'treat-1', name: 'Antirreflejante Básico', price: 250.00 },
  { id: 'treat-2', name: 'Filtro Luz Azul (Celular/Computadora)', price: 450.00 },
  { id: 'treat-3', name: 'Fotocromático Transitions (Cambio con sol)', price: 950.00 },
  { id: 'treat-4', name: 'Tratamiento Hidrofóbico (Anti-empañante)', price: 200.00 },
  { id: 'treat-5', name: 'Espejado Estético (Sol)', price: 400.00 }
]

export interface MockSaleItemTreatment {
  sale_item_id: string
  treatment_id: string
  price: number
}

export let MOCK_SALE_ITEM_TREATMENTS: MockSaleItemTreatment[] = []

export function addMockCustomer(profile: any, customerProfile: any, clinicalExam?: any) {
  MOCK_PROFILES = [...MOCK_PROFILES, profile]
  MOCK_CUSTOMER_PROFILES = [...MOCK_CUSTOMER_PROFILES, customerProfile]
  if (clinicalExam) {
    MOCK_CLINICAL_EXAMS = [clinicalExam, ...MOCK_CLINICAL_EXAMS]
  }
  return profile.id
}

/**
 * Demo-mode counterpart of the general-data update (nombre, teléfono,
 * fecha de nacimiento y dirección) used by the «Actualizar datos» modal
 * on the customer file. Mutates the in-memory mock arrays the same way
 * addMockCustomer does, so the file re-read shows the new values within
 * the session. Creates the customer_profile row when the customer was
 * registered without one (e.g. public self-signup).
 */
export function updateMockCustomerGeneralData(id: string, data: {
  full_name?: string
  phone?: string | null
  date_of_birth?: string | null
  address?: string | null
}) {
  if (data.full_name !== undefined) {
    const newName = data.full_name
    MOCK_PROFILES = MOCK_PROFILES.map(p => (p.id === id ? { ...p, full_name: newName } : p))
  }
  const exists = MOCK_CUSTOMER_PROFILES.some(cp => cp.id === id)
  if (exists) {
    MOCK_CUSTOMER_PROFILES = MOCK_CUSTOMER_PROFILES.map(cp => {
      if (cp.id !== id) return cp
      // The seed rows are loosely typed (some lack `address` entirely),
      // so the patched row is built as `any`, like the rest of the
      // mock-write helpers in this file.
      const next: any = { ...cp }
      if (data.phone !== undefined) next.phone = data.phone
      if (data.date_of_birth !== undefined) next.date_of_birth = data.date_of_birth
      if (data.address !== undefined) next.address = data.address
      return next
    })
  } else {
    const row: any = {
      id,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      address: data.address ?? null,
      occupation: null,
      blood_type: null,
      medical_notes: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    }
    MOCK_CUSTOMER_PROFILES = [...MOCK_CUSTOMER_PROFILES, row]
  }
}

export function addMockReminder(reminder: any) {
  MOCK_REMINDERS = [reminder, ...MOCK_REMINDERS]
}

// ----------------------------------------------------
// Wishlists local storage mocks
// ----------------------------------------------------
export interface WishlistItem {
  id: string
  user_id: string
  product_id: string
  created_at: string
}

export let MOCK_WISHLISTS: WishlistItem[] = []

export function addMockWishlistItem(userId: string, productId: string) {
  const exists = MOCK_WISHLISTS.some(w => w.user_id === userId && w.product_id === productId)
  if (!exists) {
    MOCK_WISHLISTS.push({
      id: 'w_' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      product_id: productId,
      created_at: new Date().toISOString()
    })
  }
}

export function removeMockWishlistItem(userId: string, productId: string) {
  MOCK_WISHLISTS = MOCK_WISHLISTS.filter(w => !(w.user_id === userId && w.product_id === productId))
}

export function getMockWishlist(userId: string): string[] {
  return MOCK_WISHLISTS
    .filter(w => w.user_id === userId)
    .map(w => w.product_id)
}

export interface MockPaymentInstallment {
  id: string
  sale_id: string
  installment_number: number
  due_date: string
  amount: number
  amount_paid?: number
  status: 'pending' | 'paid'
  payment_date?: string
  created_at: string
}

/** Registro demo de una refinanciación (espejo de sale_refinancings). */
export interface MockSaleRefinancing {
  id: string
  sale_id: string
  customer_id: string | null
  created_at: string
  created_by: string | null
  previous_paid_amount: number
  previous_pending_balance: number
  replaced_installments: number
  fee_amount: number
  new_total: number
  installments_count: number
  frequency: 'weekly' | 'biweekly' | 'monthly'
  first_due_date: string
  installment_amount: number
}

export let MOCK_SALE_REFINANCINGS: MockSaleRefinancing[] = []

export interface MockNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'general' | 'payment_reminder' | 'lens_request' | 'appointment' | 'low_stock'
  is_read: boolean
  created_at: string
}

export interface MockLensRequest {
  id: string
  customer_id: string
  frame_id?: string
  lens_material_id?: string
  treatment_ids: string[]
  notes?: string
  status: 'pending' | 'contacted' | 'completed'
  created_at: string
}

// Plan original de la venta s3: saldo de $1,600 en 4 cuotas quincenales
// de $400; la primera ya se pagó y quedan 3 pendientes ($1,200 = el
// pending_balance de la venta).
export let MOCK_PAYMENT_INSTALLMENTS: MockPaymentInstallment[] = [
  {
    id: 'i_s3_1',
    sale_id: 's3',
    installment_number: 1,
    due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 400,
    amount_paid: 400,
    status: 'paid',
    payment_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'i_s3_2',
    sale_id: 's3',
    installment_number: 2,
    due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 400,
    amount_paid: 0,
    status: 'pending',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'i_s3_3',
    sale_id: 's3',
    installment_number: 3,
    due_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 400,
    amount_paid: 0,
    status: 'pending',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'i_s3_4',
    sale_id: 's3',
    installment_number: 4,
    due_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 400,
    amount_paid: 0,
    status: 'pending',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  }
]
export let MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'n1',
    user_id: 'cust-1',
    title: 'Bienvenido a Optica Rayo',
    message: 'Gracias por registrarte en nuestro portal de salud visual.',
    type: 'general',
    is_read: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
]
export let MOCK_LENS_REQUESTS: MockLensRequest[] = []

export function addMockStaffProfile(profile: any) {
  MOCK_PROFILES = [...MOCK_PROFILES, profile]
}

export function updateMockStaffProfile(id: string, data: any) {
  MOCK_PROFILES = MOCK_PROFILES.map(p => 
    p.id === id 
      ? { ...p, full_name: data.fullName, email: data.username.includes('@') ? data.username : `${data.username}@opticarayo.com`, role: data.role } 
      : p
  )
}

export function deleteMockStaffProfile(id: string) {
  MOCK_PROFILES = MOCK_PROFILES.filter(p => p.id !== id)
}
