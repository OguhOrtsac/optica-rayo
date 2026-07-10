import { Database } from '@/types/database.types'

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
    created_at: new Date().toISOString()
  }
]

// Initial mock coupons
export let MOCK_COUPONS: Coupon[] = [
  {
    id: 'c1',
    code: 'RAYO15',
    discount_percent: 15,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'c2',
    code: 'BIENVENIDO',
    discount_percent: 10,
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'c3',
    code: 'EXPIRED20',
    discount_percent: 20,
    valid_until: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // expired
    is_active: true,
    created_at: new Date().toISOString()
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
  }
]

export let MOCK_SALE_ITEMS: SaleItem[] = [
  {
    id: 'si1',
    sale_id: 's1',
    product_id: 'p1',
    quantity: 1,
    price: 1899.00
  },
  {
    id: 'si2',
    sale_id: 's1',
    product_id: 'p2',
    quantity: 1,
    price: 1200.00
  },
  {
    id: 'si3',
    sale_id: 's2',
    product_id: 'p4',
    quantity: 1,
    price: 2450.00
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

export function addMockSale(
  customerName: string, 
  items: { productId: string; quantity: number }[],
  paidAmount?: number,
  paymentMethod?: 'cash' | 'card' | 'transfer'
) {
  const customerId = 'cust_' + Math.random().toString(36).substr(2, 9)
  
  let total = 0
  const saleId = 's_' + Math.random().toString(36).substr(2, 9)
  const itemsToAdd: SaleItem[] = []

  items.forEach(item => {
    const product = MOCK_PRODUCTS.find(p => p.id === item.productId)
    if (product) {
      const price = product.price
      total += price * item.quantity
      itemsToAdd.push({
        id: 'si_' + Math.random().toString(36).substr(2, 9),
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        price
      })
      // Decrement stock
      updateMockProductStock(item.productId, Math.max(0, product.stock - item.quantity))
    }
  })

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
    coupon_id: null,
    discount_applied: 0,
    notes: null,
    total,
    paid_amount: finalPaidAmount,
    pending_balance: pendingBalance,
    payment_method: paymentMethod || 'cash',
    status: statusVal,
    created_at: new Date().toISOString()
  }

  MOCK_SALES = [newSale, ...MOCK_SALES]
  MOCK_SALE_ITEMS = [...MOCK_SALE_ITEMS, ...itemsToAdd]

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

  return { sale: newSale, items: itemsToAdd }
}

export function updateMockSaleStatus(id: string, newStatus: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado') {
  MOCK_SALES = MOCK_SALES.map(s => s.id === id ? { ...s, status: newStatus } : s)
  return true
}

export let MOCK_PROFILES = [
  { id: 'sell-1', email: 'vendedora@opticarayo.com', full_name: 'Patricia Vendedora', role: 'seller', temporal_password_changed: true },
  { id: 'opt-1', email: 'optometrista@opticarayo.com', full_name: 'Dr. Hugo Optometrista', role: 'dev', temporal_password_changed: true },
  { id: 'cust-1', email: 'carlos@gmail.com', full_name: 'Carlos Mendoza', role: 'customer', temporal_password_changed: true },
  { id: 'cust-2', email: 'sofia@gmail.com', full_name: 'Ana Sofia Gomez', role: 'customer', temporal_password_changed: true }
]

export let MOCK_CUSTOMER_PROFILES = [
  { id: 'cust-1', phone: '(555) 987-6543', medical_notes: 'Sensibilidad a la luz azul. Usa micas anti-reflejantes.' },
  { id: 'cust-2', phone: '(555) 456-7890', medical_notes: 'Paciente con astigmatismo elevado en ojo izquierdo.' }
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
    oi_sphere: -1.75,
    oi_cylinder: -0.25,
    oi_axis: 170,
    pd_distance: 63.0,
    lens_type: 'Monofocal',
    treatment: 'Anti-Reflejante premium',
    next_exam_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
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
  status: 'pending' | 'paid'
  payment_date?: string
  created_at: string
}

export interface MockNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'general' | 'payment_reminder' | 'lens_request'
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

export let MOCK_PAYMENT_INSTALLMENTS: MockPaymentInstallment[] = []
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
