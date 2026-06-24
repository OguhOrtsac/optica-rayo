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
    image_url: null,
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
    created_at: new Date().toISOString()
  },
  {
    id: 'p4',
    name: 'Armazón Carey Vintage',
    description: 'Armazón de acetato italiano color carey de forma redonda clásica.',
    price: 2450.00,
    stock: 3,
    category: 'frames',
    image_url: null,
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

export function addMockSale(customerName: string, items: { productId: string; quantity: number }[]) {
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
