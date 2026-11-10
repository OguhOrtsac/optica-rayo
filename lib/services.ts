import { createClient as createBrowserClient } from '@/utils/supabase/client'
import * as mockDb from './mocks'
import { Database } from '@/types/database.types'
import {
  REMINDER_MONTHS_KEY,
  REMINDER_TEMPLATE_KEY,
  DEFAULT_REMINDER_MONTHS,
  DEFAULT_REMINDER_TEMPLATE,
  addMonthsISO,
} from './reminder-config'
import { MEMBER_DISCOUNT_KEY, DEFAULT_MEMBER_DISCOUNT_PERCENT, effectiveClientPrice } from './pricing'
import {
  PRODUCT_IMAGE_BUCKET,
  productImageExtension,
  validateProductImageFile,
} from './product-images'

type Product = Database['public']['Tables']['products']['Row']
type Coupon = Database['public']['Tables']['coupons']['Row']
type Reminder = Database['public']['Tables']['reminders']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

/**
 * Checks if Supabase credentials are configured and not placeholders.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder') && !key.includes('placeholder')
}

/**
 * wishlists.user_id is a UUID column. Only real Supabase users have UUID ids;
 * demo/mock identities (emails, 'guest_user', short mock ids) must use the
 * local mock store — sending them to Postgres throws a UUID cast error and
 * the wishlist silently breaks.
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Wraps a promise with a timeout rejection to prevent infinite loading.
 */
function withTimeout(promise: Promise<any> | any, ms = 2500): Promise<any> {
  return Promise.race([
    promise,
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout de red con base de datos')), ms))
  ])
}

/**
 * Service to fetch all products in the catalog.
 */
export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode (no database configured): the mock catalog is the dataset.
    return mockDb.MOCK_PRODUCTS
  }
  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })
    )

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      return []
    }
    // Older rows (before the media migration) may not carry every new
    // structured field yet; normalize them for the UI instead of leaking
    // undefined values into forms and the catalog.
    return data.map((product: Product) => ({
      ...product,
      brand: product.brand ?? null,
      material: product.material ?? null,
      sku: product.sku ?? null,
      frame_shape: product.frame_shape ?? null,
      color: product.color ?? null,
      gallery_urls: Array.isArray(product.gallery_urls) ? product.gallery_urls : [],
      image_alt: product.image_alt ?? null,
    }))
  } catch (e) {
    // Database configured but the read failed (or timed out): propagate
    // the real error so screens show a connection problem instead of
    // demo products presented as if they were the real catalog.
    console.error('Error fetching products from Supabase:', e)
    throw e instanceof Error ? e : new Error('No se pudo leer el catálogo de la base de datos.')
  }
}

/**
 * Service to add a new product to the catalog (Admin/Staff only).
 */
export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single()
      
      if (!error && data) return data
      console.error('Error creating product in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase insert failed, falling back to mocks:', e)
    }
  }
  return mockDb.addMockProduct(product)
}

/**
 * Service to upload a product image. If Supabase storage is unavailable,
 * converts the file to base64 and returns it as a data URL.
 */
export async function uploadProductImage(file: File): Promise<string | null> {
  const validation = await validateProductImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const extension = productImageExtension(file)
      const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Math.random().toString(36).substring(2, 15)}_${Date.now()}`
      const filePath = `products/${unique}.${extension}`

      const { data, error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        })

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .getPublicUrl(filePath)

        return publicUrl
      }
      console.warn('Supabase storage upload error, trying base64 fallback:', error?.message)
    } catch (e) {
      console.warn('Supabase storage upload failed, trying base64 fallback:', e)
    }
  }

  // Local/demo fallback only: when Supabase is not connected, keep the photo
  // as a data URL so the form can be tested end to end. Real deployments
  // store the binary in Storage and only the URL in the database.
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      resolve(null)
    }
    reader.readAsDataURL(file)
  })
}

/** Uploads a set of product photos in order, stopping on the first error. */
export async function uploadProductImages(files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const url = await uploadProductImage(file)
    if (!url) throw new Error(`No se pudo subir la foto ${file.name}.`)
    urls.push(url)
  }
  return urls
}

/**
 * Service to update an existing product in the catalog (Admin/Staff only).
 */
export async function updateProduct(id: string, product: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single()
      
      if (!error && data) return data
      console.error('Error updating product in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase update failed:', e)
    }
  }
  // Mock fallback
  const existing = mockDb.MOCK_PRODUCTS.find(p => p.id === id)
  if (existing) {
    Object.assign(existing, product)
    return existing
  }
  throw new Error('Producto no encontrado')
}

/**
 * Service to delete a product from the catalog (Admin/Staff only).
 */
export async function deleteProduct(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (!error) return true
      console.error('Error deleting product in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase delete failed:', e)
    }
  }
  // Mock fallback
  const index = mockDb.MOCK_PRODUCTS.findIndex(p => p.id === id)
  if (index !== -1) {
    mockDb.MOCK_PRODUCTS.splice(index, 1)
    return true
  }
  return false;
}

/**
 * Service to fetch all sales (Staff/Admin only).
 */
export async function getSales(): Promise<(Sale & { customer_name?: string; seller_name?: string })[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode (no database configured): the mock sales are the dataset.
    return mockDb.MOCK_SALES
  }
  try {
    const supabase = createBrowserClient()
    // Joining profiles for customer and seller names
    const { data, error } = await withTimeout(
      supabase
        .from('sales')
        .select(`
          *,
          customer:profiles!sales_customer_id_fkey(full_name),
          seller:profiles!sales_seller_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
    )

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      return []
    }
    return data.map((sale: any) => ({
      ...sale,
      customer_id: sale.customer_id,
      customer_name: sale.customer?.full_name || 'Desconocido',
      seller_name: sale.seller?.full_name || 'Desconocido'
    }))
  } catch (e) {
    // Database configured but the read failed (or timed out): propagate
    // the real error. Showing demo sales as the day's real sales would
    // put invented money in front of the owner.
    console.error('Error fetching sales from Supabase:', e)
    throw e instanceof Error ? e : new Error('No se pudieron leer las ventas de la base de datos.')
  }
}

/**
 * Service to register a new transaction sale (Staff only).
 */
export interface CreateSaleOptions {
  customerId?: string | null
  couponId?: string | null
  discountApplied?: number
  notes?: string
}

export async function createSale(
  customerName: string,
  items: { productId: string; quantity: number }[],
  paidAmount?: number,
  paymentMethod?: 'cash' | 'card' | 'transfer',
  options?: CreateSaleOptions
): Promise<any> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()

      // Prices must come from the real catalog (Supabase), never from the
      // demo/mock list: a POS sale priced from mocks corrupts real totals.
      const catalog = await getProducts()

      // Member pricing at the counter: when the sale is linked to a
      // registered customer (profile role 'customer'), the unit price is
      // the client price — the product's special client_price when set, or
      // the general member discount over the visitor price. Walk-in sales
      // (no customerId, or a non-customer profile) keep visitor prices.
      let buyerIsCustomer = false
      if (options?.customerId) {
        try {
          const { data: buyer } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', options.customerId)
            .maybeSingle()
          buyerIsCustomer = buyer?.role === 'customer'
        } catch (roleErr) {
          console.error('Buyer role lookup failed; charging visitor price:', roleErr)
        }
      }
      const memberPct = buyerIsCustomer ? await getMemberDiscountPercent() : 0
      const priceOf = (productId: string) => {
        const product = catalog.find(p => p.id === productId)
        if (!product) return 0
        return buyerIsCustomer
          ? effectiveClientPrice(product.price, product.client_price, memberPct)
          : product.price
      }

      const grossTotal = items.reduce((acc, item) => {
        return acc + priceOf(item.productId) * item.quantity
      }, 0)
      // Coupon discount captured at the POS is part of the stored sale:
      // the recorded total is what the customer actually owes/pays.
      const discountApplied = Math.min(Math.max(0, options?.discountApplied || 0), grossTotal)
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

      // Attribute the sale to the registered customer and the signed-in
      // seller whenever they are known (walk-in sales keep them null).
      let sellerId: string | null = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        sellerId = user?.id || null
      } catch { /* seller attribution is best effort */ }

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_id: options?.customerId || null,
          seller_id: sellerId,
          coupon_id: options?.couponId || null,
          discount_applied: discountApplied,
          total,
          paid_amount: finalPaidAmount,
          pending_balance: pendingBalance,
          payment_method: paymentMethod || 'cash',
          status: statusVal,
          notes: options?.notes?.trim() || null
        }])
        .select()
        .single()
      
      if (!saleError && saleData) {
        const saleItemsToInsert = items.map(item => {
          return {
            sale_id: saleData.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: priceOf(item.productId)
          }
        })

        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsToInsert)
        if (itemsError) {
          // The sale row exists but its line items do not: surface it as
          // an error instead of reporting a clean registration.
          throw new Error(`La venta quedó registrada (id ${saleData.id}) pero no se pudieron guardar sus partidas: ${itemsError.message}`)
        }

        // Decrement stock for what was actually sold (grouped per product).
        // A stock failure is logged loudly but does not erase a completed
        // sale; the discrepancy stays visible in the error log.
        try {
          const qtyByProduct = new Map<string, number>()
          for (const item of items) {
            qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity)
          }
          for (const [productId, qty] of qtyByProduct) {
            const current = catalog.find(prod => prod.id === productId)
            if (!current) continue
            const { error: stockError } = await supabase
              .from('products')
              .update({ stock: Math.max(0, current.stock - qty) })
              .eq('id', productId)
            if (stockError) console.error('Stock decrement failed for', productId, stockError.message)
          }
        } catch (stockErr) {
          console.error('Stock decrement failed:', stockErr)
        }

        // Auto-create a review reminder for the configured period — only
        // for a sale linked to a real customer, and isolated so a reminder
        // failure can never drag a completed sale down with it.
        if (saleData.customer_id) {
          try {
            const cfg = await getReminderConfig()
            await supabase.from('reminders').insert([{
              customer_id: saleData.customer_id,
              next_suggested_visit: addMonthsISO(new Date(), cfg.months),
              status: 'pending'
            }])
          } catch (reminderError) {
            console.error('Reminder creation failed (sale kept):', reminderError)
          }
        }

        return { sale: saleData }
      }
      // Database configured and the insert failed: report the real error.
      // Registering the sale only in the in-memory mock list would make
      // the POS claim a sale that does not exist.
      throw new Error(`Error al registrar venta: ${saleError?.message || 'la base de datos no devolvió la venta creada.'}`)
    } catch (e) {
      console.error('Supabase sale registration failed:', e)
      throw e instanceof Error ? e : new Error('No se pudo registrar la venta en la base de datos.')
    }
  }
  // Demo mode (no database configured): local mock registration.
  return mockDb.addMockSale(customerName, items, paidAmount, paymentMethod)
}

/**
 * Service to fetch reminders (Staff/Admin only).
 */
export async function getReminders(): Promise<(Reminder & { customer_name?: string })[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode (no database configured): the mock reminders are the dataset.
    return mockDb.MOCK_REMINDERS
  }
  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('reminders')
        .select(`
          *,
          customer:profiles(full_name)
        `)
        .order('next_suggested_visit', { ascending: true })
    )

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      return []
    }
    return data.map((rem: any) => ({
      ...rem,
      customer_name: rem.customer?.full_name || 'Desconocido'
    }))
  } catch (e) {
    // Database configured but the read failed (or timed out): propagate
    // the real error instead of listing invented customers.
    console.error('Error fetching reminders from Supabase:', e)
    throw e instanceof Error ? e : new Error('No se pudieron leer los recordatorios de la base de datos.')
  }
}

/**
 * Service to fetch active coupons (All logged in users).
 */
export async function getCoupons(): Promise<Coupon[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('coupons')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      )
      
      if (!error && data) return data
      console.error('Error fetching coupons from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase coupons fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_COUPONS.filter(c => c.is_active)
}

/**
 * Service to fetch all lens materials.
 */
export async function getLensMaterials(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('lens_materials')
          .select('*')
          .order('price', { ascending: true })
      )
      if (!error && data) return data
      console.error('Error fetching lens materials from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase lens materials fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_LENS_MATERIALS
}

/**
 * Service to fetch all lens treatments.
 */
export async function getLensTreatments(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('lens_treatments')
          .select('*')
          .order('price', { ascending: true })
      )
      if (!error && data) return data
      console.error('Error fetching lens treatments from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase lens treatments fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_LENS_TREATMENTS
}

/**
 * Searches customers (profiles with role='customer') by name or username.
 */
export async function searchCustomers(query: string = ''): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      let q = supabase
        .from('profiles')
        .select(`
          *,
          customer_profiles(*)
        `)
        .eq('role', 'customer')
        .order('full_name', { ascending: true })

      if (query.trim()) {
        q = q.ilike('full_name', `%${query.trim()}%`)
      }

      const { data, error } = await withTimeout(q)
      if (!error && data) return data
      console.error('Error searching customers:', error?.message)
    } catch (e) {
      console.error('Customer search failed:', e)
    }
  }
  // Fallback
  const filtered = mockDb.MOCK_PROFILES
    .filter(p => p.role === 'customer')
    .map(p => {
      const cp = mockDb.MOCK_CUSTOMER_PROFILES.find(x => x.id === p.id)
      return { ...p, customer_profiles: cp || null }
    })
  if (query.trim()) {
    return filtered.filter(p => p.full_name.toLowerCase().includes(query.trim().toLowerCase()))
  }
  return filtered
}

/**
 * Fetches a single customer's full profile including clinical profile.
 */
export async function getCustomerById(id: string): Promise<any | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select(`*, customer_profiles(*)`)
          .eq('id', id)
          .single()
      )

      if (!error && data) return data
      console.error('Error fetching customer:', error?.message)
    } catch (e) {
      console.error('Customer fetch failed:', e)
    }
  }
  // Fallback
  const p = mockDb.MOCK_PROFILES.find(x => x.id === id)
  if (p) {
    const cp = mockDb.MOCK_CUSTOMER_PROFILES.find(x => x.id === id)
    return { ...p, customer_profiles: cp || null }
  }
  return null
}

/**
 * Fetches all clinical exams for a customer, newest first.
 */
export async function getCustomerExams(customerId: string): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('clinical_exams')
          .select(`
            *,
            examiner:profiles!clinical_exams_examiner_id_fkey(full_name)
          `)
          .eq('customer_id', customerId)
          .order('exam_date', { ascending: false })
      )

      if (!error && data) return data
      console.error('Error fetching exams:', error?.message)
    } catch (e) {
      console.error('Exam fetch failed:', e)
    }
  }
  // Fallback
  return mockDb.MOCK_CLINICAL_EXAMS.filter(e => e.customer_id === customerId).map(e => {
    const examiner = mockDb.MOCK_PROFILES.find(x => x.id === e.examiner_id)
    return { ...e, examiner: { full_name: examiner ? examiner.full_name : 'Optometrista' } }
  })
}

/**
 * Fetches all sales for a customer with product details and coupon info.
 */
export async function getCustomerSales(customerId: string): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('sales')
          .select(`
            *,
            coupon:coupons(code, discount_percent),
            seller:profiles!sales_seller_id_fkey(full_name),
            sale_items(
              id,
              quantity,
              price,
              lens_material_price,
              lens_material:lens_materials(name),
              sale_item_treatments(
                price,
                treatment:lens_treatments(name)
              ),
              product:products(name, category)
            )
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
      )

      if (!error && data) return data
      console.error('Error fetching customer sales:', error?.message)
    } catch (e) {
      console.error('Customer sales fetch failed:', e)
    }
  }
  // Fallback: rebuild the same item breakdown shape from the mock tables so
  // the customer file renders identically in demo mode.
  return mockDb.MOCK_SALES.filter(s => s.customer_id === customerId).map(s => ({
    ...s,
    sale_items: mockDb.MOCK_SALE_ITEMS.filter(i => i.sale_id === s.id).map((i: any) => {
      const product = mockDb.MOCK_PRODUCTS.find(p => p.id === i.product_id)
      const material = i.lens_material_id
        ? mockDb.MOCK_LENS_MATERIALS.find(m => m.id === i.lens_material_id)
        : null
      return {
        ...i,
        product: product ? { name: product.name, category: product.category } : null,
        lens_material: material ? { name: material.name } : null,
        sale_item_treatments: mockDb.MOCK_SALE_ITEM_TREATMENTS
          .filter(t => t.sale_item_id === i.id)
          .map(t => {
            const treatment = mockDb.MOCK_LENS_TREATMENTS.find(x => x.id === t.treatment_id)
            return { price: t.price, treatment: { name: treatment ? treatment.name : 'Tratamiento' } }
          }),
      }
    }),
  }))
}

/**
 * Fetches the latest clinical exam for the currently logged-in customer.
 */
export async function getMyLatestExam(): Promise<any | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('clinical_exams')
        .select('*')
        .eq('customer_id', user.id)
        .order('exam_date', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) return data
    } catch (e) {
      // No exam found
    }
  }
  return null
}

/**
 * Fetches all sales for the currently logged-in customer.
 */
export async function getMySales(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          coupon:coupons(code, discount_percent),
          sale_items(
            quantity,
            price,
            product:products(name, category)
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) return data
      console.error('Error fetching my sales:', error?.message)
    } catch (e) {
      console.error('My sales fetch failed:', e)
    }
  }
  return []
}

/**
 * Fetches the latest reminder for the currently logged-in customer.
 */
export async function getMyReminder(): Promise<any | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) return data
    } catch (e) {
      // No reminder found
    }
  }
  return null
}

let cachedProfiles: any[] | null = null

/**
 * Invalidates the staff profiles cache to force a reload from the database.
 */
export function invalidateProfilesCache() {
  cachedProfiles = null
}

/**
 * Service to fetch all users/profiles (Admin only).
 */
export async function getAllProfiles(): Promise<any[]> {
  if (cachedProfiles) {
    return cachedProfiles
  }

  if (!isSupabaseConfigured()) {
    // Demo mode (no database configured): local mock staff list, with the
    // localStorage persistence the demo has always used.
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem('optica_rayo_mock_profiles')
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          cachedProfiles = parsed
          return parsed
        } catch (err) {
          // ignore parsing errors
        }
      }
      // If not in localStorage, seed it
      localStorage.setItem('optica_rayo_mock_profiles', JSON.stringify(mockDb.MOCK_PROFILES))
    }
    return mockDb.MOCK_PROFILES
  }

  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true }),
      1500 // Short timeout, but a timeout is an ERROR now, not a cue to invent staff
    )

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      return []
    }
    cachedProfiles = data
    return data
  } catch (e) {
    // Database configured but the read failed (or timed out): propagate
    // the real error. The staff panel must never list invented people.
    console.error('Error fetching all profiles from Supabase:', e)
    throw e instanceof Error ? e : new Error('No se pudieron leer los perfiles de la base de datos.')
  }
}

/**
 * Checks if a phone number is already registered to a customer.
 */
export async function checkPhoneDuplicate(phone: string): Promise<boolean> {
  if (!phone || phone.trim().length < 7) return false
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('phone', phone.trim())
        .limit(1)

      if (!error && data && data.length > 0) return true
    } catch (e) {
      console.error('Error checking phone duplicate:', e)
    }
  }
  // Fallback
  return mockDb.MOCK_CUSTOMER_PROFILES.some(cp => cp.phone === phone.trim())
}

/**
 * Updates the workshop/lab status of a sale transaction.
 */
export async function updateSaleStatus(
  saleId: string, 
  newStatus: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado'
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('sales')
        .update({ status: newStatus })
        .eq('id', saleId)
      
      if (!error) return true
      console.error('Error updating sale status in Supabase:', error.message)
    } catch (e) {
      console.error('Failed to update sale status in Supabase:', e)
    }
  }
  return mockDb.updateMockSaleStatus(saleId, newStatus)
}

/**
 * Retrieves the user's wishlist from Supabase or mock database.
 */
export async function getWishlist(userId: string): Promise<string[]> {
  if (isSupabaseConfigured() && isUuid(userId)) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('wishlists')
          .select('product_id')
          .eq('user_id', userId)
      )
      if (!error && data) {
        return data.map((item: any) => item.product_id)
      }
    } catch (e) {
      console.error('Wishlist fetch error:', e)
    }
  }
  return mockDb.getMockWishlist(userId)
}

/**
 * Toggles a product in the user's wishlist.
 */
export async function toggleWishlistItem(userId: string, productId: string, active: boolean): Promise<void> {
  if (isSupabaseConfigured() && isUuid(userId)) {
    try {
      const supabase = createBrowserClient()
      if (active) {
        await withTimeout(
          supabase
            .from('wishlists')
            .upsert({ user_id: userId, product_id: productId })
        )
      } else {
        await withTimeout(
          supabase
            .from('wishlists')
            .delete()
            .eq('user_id', userId)
            .eq('product_id', productId)
        )
      }
      return
    } catch (e) {
      console.error('Wishlist toggle error:', e)
    }
  }

  if (active) {
    mockDb.addMockWishlistItem(userId, productId)
  } else {
    mockDb.removeMockWishlistItem(userId, productId)
  }
}

/**
 * Synchronizes local guest wishlist with database upon register or login.
 */
export async function syncWishlist(userId: string, productIds: string[]): Promise<void> {
  if (!userId || productIds.length === 0) return

  if (isSupabaseConfigured() && isUuid(userId)) {
    try {
      const supabase = createBrowserClient()
      const records = productIds.map(pid => ({ user_id: userId, product_id: pid }))
      await withTimeout(
        supabase
          .from('wishlists')
          .upsert(records, { onConflict: 'user_id,product_id' })
      )
      return
    } catch (e) {
      console.error('Wishlist sync error:', e)
    }
  }

  // Fallback to local mocks
  productIds.forEach(pid => {
    mockDb.addMockWishlistItem(userId, pid)
  })
}

/**
 * Service to submit a lens builder request from a client.
 */
export async function createLensRequest(request: {
  frameId?: string
  lensMaterialId?: string
  treatmentIds: string[]
  notes?: string
}): Promise<any> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const { data, error } = await supabase
        .from('lens_requests')
        .insert([{
          customer_id: user.id,
          frame_id: request.frameId || null,
          lens_material_id: request.lensMaterialId || null,
          treatment_ids: request.treatmentIds,
          notes: request.notes || null,
          status: 'pending'
        }])
        .select()
        .single()

      if (!error && data) return data
      console.error('Error creating lens request in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase lens request failed, falling back to mocks:', e)
    }
  }

  // Fallback
  const newReq = {
    id: 'req_' + Math.random().toString(36).substr(2, 9),
    customer_id: 'cust-1',
    frame_id: request.frameId,
    lens_material_id: request.lensMaterialId,
    treatment_ids: request.treatmentIds,
    notes: request.notes,
    status: 'pending' as const,
    created_at: new Date().toISOString()
  }
  mockDb.MOCK_LENS_REQUESTS.push(newReq)
  return newReq
}

/**
 * Service to fetch all lens requests (Staff view gets all, Client view gets customer_id filter).
 */
export async function getLensRequests(customerId?: string): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      let q = supabase
        .from('lens_requests')
        .select(`
          *,
          customer:profiles!lens_requests_customer_id_fkey(full_name, email),
          frame:products!lens_requests_frame_id_fkey(name, price),
          lens_material:lens_materials!lens_requests_lens_material_id_fkey(name, price)
        `)
        .order('created_at', { ascending: false })

      if (customerId) {
        q = q.eq('customer_id', customerId)
      }

      const { data, error } = await q
      if (!error && data) {
        // customer_profiles has no FK from lens_requests (its id IS the
        // profile id), so the phone is hydrated with a second query —
        // embedding it made PostgREST reject the whole request (PGRST200)
        // and the panel silently fell back to empty mocks.
        const ids = [...new Set(data.map((r: any) => r.customer_id).filter(Boolean))]
        let phones = new Map<string, string>()
        if (ids.length) {
          const { data: cps } = await supabase
            .from('customer_profiles')
            .select('id, phone')
            .in('id', ids)
          if (cps) phones = new Map(cps.map((cp: any) => [cp.id, cp.phone]))
        }
        return data.map((r: any) => ({
          ...r,
          customer_profiles: { phone: phones.get(r.customer_id) || '' },
        }))
      }
      console.error('Error fetching lens requests from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase lens requests fetch failed:', e)
    }
  }

  // Fallback mock
  return mockDb.MOCK_LENS_REQUESTS
    .filter(req => !customerId || req.customer_id === customerId)
    .map(req => {
      const cust = mockDb.MOCK_PROFILES.find(p => p.id === req.customer_id)
      const cp = mockDb.MOCK_CUSTOMER_PROFILES.find(p => p.id === req.customer_id)
      const prod = mockDb.MOCK_PRODUCTS.find(p => p.id === req.frame_id)
      const mat = mockDb.MOCK_LENS_MATERIALS.find(m => m.id === req.lens_material_id)
      return {
        ...req,
        customer: cust ? { full_name: cust.full_name, email: cust.email } : { full_name: 'Cliente Nuevo', email: '' },
        customer_profiles: cp ? { phone: cp.phone } : { phone: '' },
        frame: prod ? { name: prod.name, price: prod.price } : null,
        lens_material: mat ? { name: mat.name, price: mat.price } : null
      }
    })
}

/**
 * Service to update lens request status (Staff only).
 */
export async function updateLensRequestStatus(requestId: string, status: 'pending' | 'contacted' | 'completed'): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('lens_requests')
        .update({ status })
        .eq('id', requestId)
      
      if (!error) return true
    } catch (e) {
      console.error('Error updating lens request status in Supabase:', e)
    }
  }

  const req = mockDb.MOCK_LENS_REQUESTS.find(r => r.id === requestId)
  if (req) {
    req.status = status
    return true
  }
  return false
}

/**
 * Service to retrieve upcoming installments for a customer.
 */
export async function getCustomerInstallments(customerId?: string): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      let q = supabase
        .from('payment_installments')
        .select(`
          *,
          sale:sales!payment_installments_sale_id_fkey(total, paid_amount, pending_balance, customer_id)
        `)
        .order('due_date', { ascending: true })

      const { data, error } = await q
      if (!error && data) {
        if (customerId) {
          return data.filter((item: any) => item.sale?.customer_id === customerId)
        }
        return data
      }
      console.error('Error fetching payment installments from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase installments fetch failed:', e)
    }
  }

  // Fallback mock
  return mockDb.MOCK_PAYMENT_INSTALLMENTS
    .map(inst => {
      const sale = mockDb.MOCK_SALES.find(s => s.id === inst.sale_id)
      return {
        ...inst,
        sale
      }
    })
    .filter(inst => !customerId || inst.sale?.customer_id === customerId)
}

/**
 * Service to retrieve user notifications.
 */
export async function getMyNotifications(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) return data
    } catch (e) {
      console.error('Supabase notifications fetch failed:', e)
    }
  }
  return mockDb.MOCK_NOTIFICATIONS
}

/**
 * Service to mark notification as read.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      
      if (!error) return true
    } catch (e) {
      console.error('Supabase mark read failed:', e)
    }
  }
  
  const notif = mockDb.MOCK_NOTIFICATIONS.find(n => n.id === id)
  if (notif) {
    notif.is_read = true
    return true
  }
  return false
}




// ----------------------------------------------------
// App settings (editable business configuration)
// ----------------------------------------------------

const settingStorageKey = (key: string) => `optica_rayo_setting_${key}`

/**
 * Reads one app setting from Supabase (app_settings) with a localStorage
 * fallback used in demo mode.
 */
export async function getAppSetting(key: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase.from('app_settings').select('value').eq('key', key).single()
      )
      if (!error && data) return data.value as string
    } catch (e) {
      // fall through to local fallback
    }
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem(settingStorageKey(key))
  }
  return null
}

/**
 * Saves one app setting. When Supabase is configured the upsert is the
 * source of truth: its error is THROWN so the caller cannot report a
 * setting as saved when it is not in the database (previously the error
 * was swallowed and the value was mirrored to localStorage first, so on
 * the admin's own machine it looked saved while existing nowhere else).
 * localStorage is mirrored only after a successful real save; in demo
 * mode (no database configured) localStorage is the only store.
 */
export async function setAppSetting(key: string, value: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createBrowserClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      throw new Error(`No se pudo guardar la configuración: ${error.message}`)
    }
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(settingStorageKey(key), value)
  }
}

// ----------------------------------------------------
// Exam Review Reminders module
// ----------------------------------------------------

export interface ReminderConfig {
  months: number
  template: string
}

/** Reminder period (configurable, 6 months by default) + editable template. */
export async function getReminderConfig(): Promise<ReminderConfig> {
  const monthsRaw = await getAppSetting(REMINDER_MONTHS_KEY)
  const template = await getAppSetting(REMINDER_TEMPLATE_KEY)
  const months = parseInt(monthsRaw || '', 10)
  return {
    months: Number.isFinite(months) && months > 0 ? months : DEFAULT_REMINDER_MONTHS,
    template: template || DEFAULT_REMINDER_TEMPLATE,
  }
}

export async function saveReminderConfig(months: number, template: string): Promise<void> {
  await setAppSetting(REMINDER_MONTHS_KEY, String(months))
  await setAppSetting(REMINDER_TEMPLATE_KEY, template)
}

export interface DueReminder {
  id: string
  customer_id: string
  customer_name: string
  phone: string
  last_visit_date: string | null
  next_suggested_visit: string
  last_reminded_at: string | null
}

/**
 * Reminders that are due now or within the next 7 days, with the customer's
 * name and phone ready for the administrator's tray.
 */
export async function getDueReminders(): Promise<DueReminder[]> {
  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (!isSupabaseConfigured()) {
    // Demo mode (no database configured): the mock reminders are the dataset.
    return mockDb.MOCK_REMINDERS
      .filter(r => r.status === 'pending' && r.next_suggested_visit <= horizon)
      .sort((a, b) => a.next_suggested_visit.localeCompare(b.next_suggested_visit))
      .map(r => {
        const profile = mockDb.MOCK_PROFILES.find(p => p.id === r.customer_id)
        const cp = mockDb.MOCK_CUSTOMER_PROFILES.find(x => x.id === r.customer_id)
        return {
          id: r.id,
          customer_id: r.customer_id,
          customer_name: profile?.full_name || 'Cliente',
          phone: cp?.phone || '',
          last_visit_date: r.last_visit_date,
          next_suggested_visit: r.next_suggested_visit,
          last_reminded_at: (r as any).last_reminded_at ?? null,
        }
      })
  }

  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('reminders')
        .select('*, customer:profiles(full_name)')
        .eq('status', 'pending')
        .lte('next_suggested_visit', horizon)
        .order('next_suggested_visit', { ascending: true })
    )
    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      return []
    }
    const ids = data.map((r: any) => r.customer_id)
    const phoneById = new Map<string, string>()
    if (ids.length > 0) {
      const { data: cps, error: cpError } = await supabase
        .from('customer_profiles')
        .select('id, phone')
        .in('id', ids)
      if (cpError) {
        // Without the phones the tray would offer WhatsApp buttons that
        // dial nobody: treat it as the read failure it is.
        throw new Error(cpError.message)
      }
      cps?.forEach((cp: any) => phoneById.set(cp.id, cp.phone || ''))
    }
    return data.map((r: any) => ({
      id: r.id,
      customer_id: r.customer_id,
      customer_name: r.customer?.full_name || 'Cliente',
      phone: phoneById.get(r.customer_id) || '',
      last_visit_date: r.last_visit_date,
      next_suggested_visit: r.next_suggested_visit,
      last_reminded_at: r.last_reminded_at ?? null,
    }))
  } catch (e) {
    // Database configured but the read failed (or timed out): propagate
    // the real error. The tray must never offer to WhatsApp invented
    // customers at invented phone numbers.
    console.error('Error fetching due reminders from Supabase:', e)
    throw e instanceof Error ? e : new Error('No se pudieron leer los recordatorios vencidos de la base de datos.')
  }
}

/**
 * Marks a reminder as contacted: stamps last_reminded_at and rolls the
 * next suggested visit one full period forward, so the customer is not
 * reminded twice in the same cycle and never falls off the list.
 */
export async function markReminderContacted(reminderId: string, months: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: current } = await supabase
        .from('reminders')
        .select('next_suggested_visit')
        .eq('id', reminderId)
        .single()
      const base = current?.next_suggested_visit ? new Date(current.next_suggested_visit) : new Date()
      const { error } = await supabase
        .from('reminders')
        .update({
          last_reminded_at: new Date().toISOString(),
          next_suggested_visit: addMonthsISO(base, months),
        })
        .eq('id', reminderId)
      if (!error) return true
      console.error('Error marking reminder contacted:', error.message)
    } catch (e) {
      console.error('Mark reminder contacted failed:', e)
    }
  }

  const reminder = mockDb.MOCK_REMINDERS.find(r => r.id === reminderId)
  if (reminder) {
    ;(reminder as any).last_reminded_at = new Date().toISOString()
    reminder.next_suggested_visit = addMonthsISO(new Date(reminder.next_suggested_visit), months)
    return true
  }
  return false
}


// ----------------------------------------------------
// Member pricing (general discount percent for logged-in customers)
// ----------------------------------------------------

/** General member discount percent (default: the owner's 20% example). */
export async function getMemberDiscountPercent(): Promise<number> {
  const raw = await getAppSetting(MEMBER_DISCOUNT_KEY)
  const pct = parseFloat(raw || '')
  return Number.isFinite(pct) && pct >= 0 && pct <= 100
    ? pct
    : DEFAULT_MEMBER_DISCOUNT_PERCENT
}

export async function saveMemberDiscountPercent(percent: number): Promise<void> {
  await setAppSetting(MEMBER_DISCOUNT_KEY, String(percent))
}

// ----------------------------------------------------
// Low-stock alerts (the bell warns staff when a product's stock
// crosses at/below the configured threshold; the crossing itself is
// detected by the notify_low_stock trigger in the database, which
// reads this same app_settings key.)
// ----------------------------------------------------

export const LOW_STOCK_THRESHOLD_KEY = 'low_stock_threshold'
export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export async function getLowStockThreshold(): Promise<number> {
  const raw = await getAppSetting(LOW_STOCK_THRESHOLD_KEY)
  const n = parseInt(raw || '', 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOW_STOCK_THRESHOLD
}

export async function saveLowStockThreshold(threshold: number): Promise<void> {
  await setAppSetting(LOW_STOCK_THRESHOLD_KEY, String(Math.max(0, Math.floor(threshold))))
}

// ----------------------------------------------------
// Promotions (created ONLY by the administrator — owner / super_admin;
// sellers cannot create them. Customers see the ones currently in
// force on their dashboard.)
// ----------------------------------------------------

export interface Promotion {
  id: string
  title: string
  description: string | null
  discount_percent: number | null
  code: string | null
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export type PromotionInput = Omit<Promotion, 'id' | 'created_at'>

/** Today's date as YYYY-MM-DD in local time, for DATE column windows. */
function todayDateString(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * A promotion is in force when it is active and today falls inside its
 * date window; a NULL bound leaves that side of the window open.
 */
export function isPromotionInForce(
  promo: Pick<Promotion, 'is_active' | 'starts_at' | 'ends_at'>,
  today: string = todayDateString()
): boolean {
  if (!promo.is_active) return false
  if (promo.starts_at && promo.starts_at > today) return false
  if (promo.ends_at && promo.ends_at < today) return false
  return true
}

/**
 * Promotions currently in force — these are the ones a customer sees
 * on their dashboard after signing in.
 */
export async function getActivePromotions(): Promise<Promotion[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('promotions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      )

      if (!error && data) {
        return (data as Promotion[]).filter(p => isPromotionInForce(p))
      }
      console.error('Error fetching promotions from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase promotions fetch failed:', e)
    }
  }
  // No mock dataset for promotions: demo mode simply shows none.
  return []
}

/**
 * Every promotion regardless of state/window (admin management list).
 */
export async function getAllPromotions(): Promise<Promotion[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('promotions')
          .select('*')
          .order('created_at', { ascending: false })
      )

      if (!error && data) return data as Promotion[]
      console.error('Error fetching all promotions from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase promotions fetch failed:', e)
    }
  }
  return []
}

/**
 * Create a promotion (administrator only — enforced by RLS).
 */
export async function createPromotion(promotion: PromotionInput): Promise<Promotion> {
  if (isSupabaseConfigured()) {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('promotions')
      .insert([promotion])
      .select()
      .single()

    if (!error && data) return data as Promotion
    throw new Error(error?.message || 'No se pudo crear la promoción')
  }
  throw new Error('Base de datos no configurada')
}

/**
 * Update a promotion (administrator only — enforced by RLS).
 */
export async function updatePromotion(
  id: string,
  promotion: Partial<PromotionInput>
): Promise<Promotion> {
  if (isSupabaseConfigured()) {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('promotions')
      .update(promotion)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) return data as Promotion
    throw new Error(error?.message || 'No se pudo actualizar la promoción')
  }
  throw new Error('Base de datos no configurada')
}

/**
 * Activate/deactivate a promotion without touching its other fields.
 */
export async function setPromotionActive(id: string, isActive: boolean): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: isActive })
        .eq('id', id)

      if (!error) return true
      console.error('Error toggling promotion in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase promotion toggle failed:', e)
    }
  }
  return false
}

/**
 * Delete a promotion (administrator only — enforced by RLS).
 */
export async function deletePromotion(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)

      if (!error) return true
      console.error('Error deleting promotion in Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase promotion delete failed:', e)
    }
  }
  return false
}
