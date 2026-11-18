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
import {
  BIRTHDAY_TEMPLATE_KEY,
  CATALOG_INQUIRY_TEMPLATE_KEY,
  LENS_REQUEST_REPLY_TEMPLATE_KEY,
  PAYMENT_REMINDER_TEMPLATE_KEY,
  MESSAGE_TEMPLATE_DEFAULTS,
  type MessageTemplateKey,
} from './message-templates'
import { MEMBER_DISCOUNT_KEY, DEFAULT_MEMBER_DISCOUNT_PERCENT, effectiveClientPrice } from './pricing'
import { getAgendaScheduleSummary } from './appointments'
import { getPeriodPayments } from './expenses'
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
  // True when the POS composed the sale at visitor prices and the buyer was
  // only resolved/linked at checkout (typed name matched or minimal profile
  // created on the fly): the recorded sale must keep the prices actually
  // charged on screen, not re-price as a member sale after the fact.
  chargeAsWalkIn?: boolean
}

export async function createSale(
  customerName: string,
  items: { productId: string; quantity: number; complements?: { name: string; price: number }[] }[],
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
          buyerIsCustomer = !options?.chargeAsWalkIn && buyer?.role === 'customer'
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

      // Complements (free-text add-ons per product, price 0 = «Gratis»)
      // are charged per unit of their parent product, like lens options.
      const complementsTotalOf = (item: { complements?: { name: string; price: number }[] }) =>
        (item.complements || []).reduce((a, c) => a + Math.max(0, c.price || 0), 0)
      const grossTotal = items.reduce((acc, item) => {
        return acc + (priceOf(item.productId) + complementsTotalOf(item)) * item.quantity
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
        // Rollback for the line-item steps below: if any item insert
        // fails, the just-created sale row is deleted again (its items
        // cascade through the sale_items FK) so a failed registration
        // never leaves a ghost sale behind — an order with totals but
        // no products, which is exactly what the 2026-11-18 live test
        // produced. The caller still receives the real insert error.
        const rollbackSale = async () => {
          const { error: deleteError } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleData.id)
          if (deleteError) {
            console.error(`Rollback of sale ${saleData.id} failed:`, deleteError.message)
          }
        }

        // EVERY row of each insert carries EXACTLY the same keys. The
        // previous single bulk insert mixed 4-key product rows with
        // 7-key complement rows and PostgREST rejects heterogeneous
        // bulk inserts (PGRST102 «All object keys must match») — which
        // is why not even the base products were saved.
        const productItemsToInsert: any[] = items.map(item => {
          return {
            sale_id: saleData.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: priceOf(item.productId),
            is_complement: false,
            complement_name: null,
            complement_for: null
          }
        })
        // Each complement persists as its own sale_items row (product_id
        // NULL, is_complement) so it shows in the POS history, the
        // customer's purchases and the customer file.
        const complementItemsToInsert: any[] = []
        for (const item of items) {
          const parentName = catalog.find(p => p.id === item.productId)?.name || 'Producto'
          for (const c of item.complements || []) {
            if (!c.name?.trim()) continue
            complementItemsToInsert.push({
              sale_id: saleData.id,
              product_id: null,
              quantity: item.quantity,
              price: Math.max(0, c.price || 0),
              is_complement: true,
              complement_name: c.name.trim(),
              complement_for: parentName
            })
          }
        }

        // Items are inserted in TWO steps — base products first, then
        // complements — so a complement failure can never take the
        // sale's products down with it in a single bulk insert. Either
        // step failing rolls the whole sale back (see rollbackSale).
        if (productItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('sale_items').insert(productItemsToInsert)
          if (itemsError) {
            await rollbackSale()
            throw new Error(`No se pudieron guardar las partidas de la venta: ${itemsError.message}`)
          }
        }
        if (complementItemsToInsert.length > 0) {
          const { error: complementsError } = await supabase.from('sale_items').insert(complementItemsToInsert)
          if (complementsError) {
            await rollbackSale()
            throw new Error(`No se pudieron guardar los complementos de la venta: ${complementsError.message}`)
          }
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
              is_complement,
              complement_name,
              complement_for,
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
            is_complement,
            complement_name,
            complement_for,
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
      const { data, error } = await supabase
        .from('sales')
        .update({ status: newStatus })
        .eq('id', saleId)
        .select('id')

      // An UPDATE blocked by RLS returns NO error but touches 0 rows: the
      // sale keeps its old status while the UI used to report success (the
      // owner caught this: «Listo para entrega» never became «Entregado»).
      // Success now requires proof that the row actually changed.
      if (!error && data && data.length > 0) return true
      if (!error) {
        console.error('Error updating sale status: 0 rows updated (possible RLS block) for sale', saleId)
      } else {
        console.error('Error updating sale status in Supabase:', error.message)
      }
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

// ----------------------------------------------------
// WhatsApp message templates («Mensajes» page)
// ----------------------------------------------------

/** Every editable WhatsApp template, already resolved against defaults. */
export interface MessageTemplates {
  reminder: string
  birthday: string
  catalogInquiry: string
  lensRequestReply: string
  paymentReminder: string
}

/**
 * One editable WhatsApp template: the value saved in app_settings, or the
 * built-in default (the text the app always used) when nothing is saved.
 */
export async function getMessageTemplate(key: MessageTemplateKey): Promise<string> {
  const saved = await getAppSetting(key)
  return saved || MESSAGE_TEMPLATE_DEFAULTS[key]
}

/** All editable WhatsApp templates at once (the «Mensajes» page). */
export async function getMessageTemplates(): Promise<MessageTemplates> {
  const [reminder, birthday, catalogInquiry, lensRequestReply, paymentReminder] =
    await Promise.all([
      getMessageTemplate(REMINDER_TEMPLATE_KEY),
      getMessageTemplate(BIRTHDAY_TEMPLATE_KEY),
      getMessageTemplate(CATALOG_INQUIRY_TEMPLATE_KEY),
      getMessageTemplate(LENS_REQUEST_REPLY_TEMPLATE_KEY),
      getMessageTemplate(PAYMENT_REMINDER_TEMPLATE_KEY),
    ])
  return { reminder, birthday, catalogInquiry, lensRequestReply, paymentReminder }
}

/**
 * Saves one WhatsApp template to app_settings. Goes through setAppSetting,
 * so a real database error is THROWN and the caller can show it — a
 * template is never reported as saved when it is not. The reminder
 * template saved here is the same `reminder_template` key the Reminders
 * tray modal edits (one source, two doors).
 */
export async function saveMessageTemplate(key: MessageTemplateKey, value: string): Promise<void> {
  await setAppSetting(key, value)
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
// Business data (the optical shop's public identity: name,
// address, contact and opening hours). Edited only by
// administrators (owner / super_admin) from the profile page;
// stored as individual app_settings keys, reusing the existing
// 'business_whatsapp' key that the catalog and booking pages
// already read.
// ----------------------------------------------------

export const BUSINESS_NAME_KEY = 'business_name'
export const BUSINESS_ADDRESS_KEY = 'business_address'
export const BUSINESS_CITY_KEY = 'business_city'
export const BUSINESS_STATE_KEY = 'business_state'
export const BUSINESS_COUNTRY_KEY = 'business_country'
export const BUSINESS_PHONE_KEY = 'business_phone'
export const BUSINESS_EMAIL_KEY = 'business_email'
export const BUSINESS_SCHEDULE_KEY = 'business_schedule'
export const BUSINESS_WHATSAPP_KEY = 'business_whatsapp'

export const DEFAULT_BUSINESS_NAME = 'Óptica Rayo'
// LEGACY: the hand-typed opening-hours text ('business_schedule' key /
// this default). Since «Configurar horario» (2026-11-18) the real
// schedule is the per-day structure in lib/appointments
// (`agenda_schedule`), and BusinessSettings.schedule is the summary
// GENERATED from it — the old key is no longer read nor written.

export interface BusinessSettings {
  name: string
  address: string
  city: string
  state: string
  country: string
  phone: string
  whatsapp: string
  email: string
  schedule: string
}

/** Business data with sensible defaults for the fields never saved yet. */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const [name, address, city, state, country, phone, whatsapp, email, schedule] =
    await Promise.all([
      getAppSetting(BUSINESS_NAME_KEY),
      getAppSetting(BUSINESS_ADDRESS_KEY),
      getAppSetting(BUSINESS_CITY_KEY),
      getAppSetting(BUSINESS_STATE_KEY),
      getAppSetting(BUSINESS_COUNTRY_KEY),
      getAppSetting(BUSINESS_PHONE_KEY),
      getAppSetting(BUSINESS_WHATSAPP_KEY),
      getAppSetting(BUSINESS_EMAIL_KEY),
      // The opening hours are NOT a business field anymore: they are the
      // summary generated from «Configurar horario» (per-day schedule),
      // so every screen of the app states the same hours.
      getAgendaScheduleSummary().catch(() => ''),
    ])
  return {
    name: name || DEFAULT_BUSINESS_NAME,
    address: address || '',
    city: city || '',
    state: state || '',
    country: country || '',
    phone: phone || '',
    whatsapp: whatsapp || '',
    email: email || '',
    schedule: schedule || '',
  }
}

/** Saves every business field; a failed save throws (see setAppSetting). */
export async function updateBusinessSettings(data: BusinessSettings): Promise<void> {
  await setAppSetting(BUSINESS_NAME_KEY, data.name.trim())
  await setAppSetting(BUSINESS_ADDRESS_KEY, data.address.trim())
  await setAppSetting(BUSINESS_CITY_KEY, data.city.trim())
  await setAppSetting(BUSINESS_STATE_KEY, data.state.trim())
  await setAppSetting(BUSINESS_COUNTRY_KEY, data.country.trim())
  await setAppSetting(BUSINESS_PHONE_KEY, data.phone.trim())
  await setAppSetting(BUSINESS_WHATSAPP_KEY, data.whatsapp.trim())
  await setAppSetting(BUSINESS_EMAIL_KEY, data.email.trim())
  // data.schedule is NOT saved: the opening hours live in «Configurar
  // horario» (per-day `agenda_schedule`) and this field is only the
  // generated summary for display.
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


// ----------------------------------------------------
// Finanzas — cifras del dueño (definiciones del 2026-11-18)
// ----------------------------------------------------
//
// Pantallas /dashboard/admin/finanzas/*. Las cifras salen SIEMPRE
// de la base real: si la base no está configurada o falla, el error
// sube a la pantalla (nada de números inventados). Las ventas se
// agrupan por su created_at en hora LOCAL del navegador, igual que
// las tarjetas del panel (Ventas hoy / Ventas del mes).
//
// Definiciones aplicadas al pie:
//  DÍA:  vendido = Σ total · cobrado = Σ paid_amount ·
//        por cobrar = Σ pending_balance (cobrado + por cobrar =
//        vendido por construcción de la venta).
//  MES:  adeudo = Σ pending_balance ACTUAL de las ventas del mes;
//        cobrado de ventas del mes = venta total − adeudo (la
//        ecuación cuadra siempre); abonos de meses anteriores =
//        cuotas con payment_date en el mes cuya venta nació antes
//        del mes; total caja = cobrado de ventas del mes + TODAS
//        las cuotas recibidas en el mes.
//  UTILIDAD (caja): ingresos = Σ paid_amount de ventas creadas en
//        el rango + Σ cuotas con payment_date en el rango; pagos =
//        gastos del día del rango + fijos prorrateados (regla de
//        Reportes, vía getPeriodPayments); adeudos generados =
//        Σ pending_balance de ventas creadas en el rango;
//        utilidad = ingresos − pagos.

function finRound2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Postgres NUMERIC can arrive as string through PostgREST. */
function finAmount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Local YYYY-MM-DD key of a Date (never UTC). */
function finLocalDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** ISO instant of a local day's 00:00. dateISO is YYYY-MM-DD local. */
function finDayStartISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1).toISOString()
}

/** ISO instant of the local 00:00 of the day AFTER dateISO. */
function finNextDayStartISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, (d || 1) + 1).toISOString()
}

export interface FinanceSaleRow {
  id: string
  created_at: string
  /** HH:MM en hora local. */
  time_label: string
  /** YYYY-MM-DD en hora local. */
  date_label: string
  customer_name: string
  /** Descripción de los artículos («2 × Armazón …, 1 × …»). */
  description: string
  total: number
  paid_amount: number
  pending_balance: number
  status: Sale['status']
}

/**
 * Sales created inside [startISO, endISO) with customer name and an
 * item description, newest first. Throws on any database failure.
 */
async function fetchFinanceSales(startISO: string, endISO: string): Promise<FinanceSaleRow[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id, created_at, total, paid_amount, pending_balance, status,
      customer:profiles!sales_customer_id_fkey(full_name)
    `)
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const sales = (data ?? []) as any[]
  if (sales.length === 0) return []

  // Item descriptions for the whole batch in one read.
  const { data: itemsData, error: itemsError } = await supabase
    .from('sale_items')
    .select(`
      sale_id, quantity, is_complement, complement_name,
      product:products(name),
      lens_material:lens_materials(name),
      sale_item_treatments(treatment:lens_treatments(name))
    `)
    .in('sale_id', sales.map(s => s.id))

  if (itemsError) throw new Error(itemsError.message)

  const descriptionBySale = new Map<string, string[]>()
  for (const item of (itemsData ?? []) as any[]) {
    if (item.is_complement) {
      const arr = descriptionBySale.get(item.sale_id) ?? []
      arr.push(`Complemento: ${item.complement_name ?? 'Complemento'}`)
      descriptionBySale.set(item.sale_id, arr)
      continue
    }
    const parts: string[] = [`${item.quantity ?? 1} × ${item.product?.name ?? 'Producto'}`]
    if (item.lens_material?.name) parts.push(item.lens_material.name)
    for (const t of item.sale_item_treatments ?? []) {
      if (t.treatment?.name) parts.push(t.treatment.name)
    }
    const line = parts.join(' · ')
    const arr = descriptionBySale.get(item.sale_id) ?? []
    arr.push(line)
    descriptionBySale.set(item.sale_id, arr)
  }

  return sales.map(sale => {
    const created = new Date(sale.created_at)
    return {
      id: sale.id,
      created_at: sale.created_at,
      time_label: created.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      date_label: finLocalDateKey(created),
      customer_name: sale.customer?.full_name || 'Cliente sin nombre',
      description: (descriptionBySale.get(sale.id) ?? []).join(' · ') || 'Sin artículos registrados',
      total: finAmount(sale.total),
      paid_amount: finAmount(sale.paid_amount),
      pending_balance: finAmount(sale.pending_balance),
      status: sale.status,
    }
  })
}

export interface DaySalesDetail {
  /** YYYY-MM-DD local del día consultado. */
  date: string
  sales: FinanceSaleRow[]
  /** Σ total de las ventas del día. */
  soldTotal: number
  /** Σ paid_amount de esas ventas (lo que entró a caja por ellas). */
  collectedTotal: number
  /** Σ pending_balance de esas ventas. */
  pendingTotal: number
}

/**
 * Detail of one local day: every sale created that day plus the
 * three figures of the owner's equation (cobrado + por cobrar =
 * vendido).
 */
export async function getDaySalesDetail(dateISO: string): Promise<DaySalesDetail> {
  if (!isSupabaseConfigured()) throw new Error('Base de datos no configurada')
  const sales = await fetchFinanceSales(finDayStartISO(dateISO), finNextDayStartISO(dateISO))
  return {
    date: dateISO,
    sales,
    soldTotal: finRound2(sales.reduce((sum, s) => sum + s.total, 0)),
    collectedTotal: finRound2(sales.reduce((sum, s) => sum + s.paid_amount, 0)),
    pendingTotal: finRound2(sales.reduce((sum, s) => sum + s.pending_balance, 0)),
  }
}

export interface MonthSalesDetail {
  year: number
  /** 1-12 */
  month: number
  /** Solo los días CON ventas, en orden: la gráfica salta los días
   *  sin actividad en vez de bajar a cero. */
  days: { day: number; date: string; total: number }[]
  sales: FinanceSaleRow[]
  /** Σ total de las ventas del mes. */
  salesTotal: number
  /** Σ pending_balance ACTUAL de las ventas del mes. */
  monthDebt: number
  /** salesTotal − monthDebt (así la ecuación del mes siempre cuadra). */
  collectedFromMonthSales: number
  /** Cuotas recibidas en el mes por ventas de meses anteriores. */
  priorMonthsCollected: number
  /** Σ TODAS las cuotas (payment_installments) recibidas en el mes. */
  monthInstallmentsTotal: number
  /** collectedFromMonthSales + monthInstallmentsTotal. */
  cashTotal: number
}

/**
 * One month of sales: daily series (only days with sales), the full
 * sale list and the owner's month figures. month is 1-12.
 */
export async function getMonthSales(year: number, month: number): Promise<MonthSalesDetail> {
  if (!isSupabaseConfigured()) throw new Error('Base de datos no configurada')
  const supabase = createBrowserClient()
  const monthStart = new Date(year, month - 1, 1)
  const nextMonthStart = new Date(year, month, 1)
  const startISO = monthStart.toISOString()
  const endISO = nextMonthStart.toISOString()

  const sales = await fetchFinanceSales(startISO, endISO)
  const salesTotal = finRound2(sales.reduce((sum, s) => sum + s.total, 0))
  const monthDebt = finRound2(sales.reduce((sum, s) => sum + s.pending_balance, 0))
  const collectedFromMonthSales = finRound2(salesTotal - monthDebt)

  const byDay = new Map<string, { day: number; date: string; total: number }>()
  for (const sale of sales) {
    const entry = byDay.get(sale.date_label) ?? {
      day: Number(sale.date_label.slice(8, 10)),
      date: sale.date_label,
      total: 0,
    }
    entry.total = finRound2(entry.total + sale.total)
    byDay.set(sale.date_label, entry)
  }
  const days = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Installments actually received inside the month (payment_date),
  // split by whether their sale was born before this month.
  const { data: instData, error: instError } = await supabase
    .from('payment_installments')
    .select(`
      amount_paid, payment_date,
      sale:sales!payment_installments_sale_id_fkey(created_at)
    `)
    .gte('payment_date', startISO)
    .lt('payment_date', endISO)

  if (instError) throw new Error(instError.message)

  let monthInstallmentsTotal = 0
  let priorMonthsCollected = 0
  for (const inst of (instData ?? []) as any[]) {
    const amount = finAmount(inst.amount_paid)
    monthInstallmentsTotal = finRound2(monthInstallmentsTotal + amount)
    const saleCreated = inst.sale?.created_at ? new Date(inst.sale.created_at) : null
    if (saleCreated && saleCreated.getTime() < monthStart.getTime()) {
      priorMonthsCollected = finRound2(priorMonthsCollected + amount)
    }
  }

  return {
    year,
    month,
    days,
    sales,
    salesTotal,
    monthDebt,
    collectedFromMonthSales,
    priorMonthsCollected,
    monthInstallmentsTotal,
    cashTotal: finRound2(collectedFromMonthSales + monthInstallmentsTotal),
  }
}

export interface CashUtility {
  /** YYYY-MM-DD local, inclusivo. */
  from: string
  /** YYYY-MM-DD local, inclusivo. */
  to: string
  /** paid_amount de ventas creadas en el rango + cuotas del rango. */
  income: number
  incomeFromSales: number
  incomeFromInstallments: number
  /** Gastos del día del rango + fijos prorrateados. */
  payments: number
  dailyExpensesTotal: number
  fixedProrated: number
  fixedMonthlyTotal: number
  /** Σ pending_balance de las ventas creadas en el rango. */
  debtsGenerated: number
  /** income − payments (criterio de caja del dueño). */
  utility: number
}

/**
 * Cash utility for a local date range [fromISO, toISO] (both
 * YYYY-MM-DD, inclusive), with the owner's cash definitions.
 */
export async function getCashUtility(fromISO: string, toISO: string): Promise<CashUtility> {
  if (!isSupabaseConfigured()) throw new Error('Base de datos no configurada')
  const supabase = createBrowserClient()
  const startISO = finDayStartISO(fromISO)
  const endISO = finNextDayStartISO(toISO)

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('paid_amount, pending_balance')
    .gte('created_at', startISO)
    .lt('created_at', endISO)

  if (salesError) throw new Error(salesError.message)

  let incomeFromSales = 0
  let debtsGenerated = 0
  for (const sale of (salesData ?? []) as any[]) {
    incomeFromSales = finRound2(incomeFromSales + finAmount(sale.paid_amount))
    debtsGenerated = finRound2(debtsGenerated + finAmount(sale.pending_balance))
  }

  const { data: instData, error: instError } = await supabase
    .from('payment_installments')
    .select('amount_paid')
    .gte('payment_date', startISO)
    .lt('payment_date', endISO)

  if (instError) throw new Error(instError.message)

  let incomeFromInstallments = 0
  for (const inst of (instData ?? []) as any[]) {
    incomeFromInstallments = finRound2(incomeFromInstallments + finAmount(inst.amount_paid))
  }

  // Money out lives in lib/expenses (same proration rule as Reports).
  const periodPayments = await getPeriodPayments(fromISO, toISO)

  const income = finRound2(incomeFromSales + incomeFromInstallments)
  return {
    from: fromISO,
    to: toISO,
    income,
    incomeFromSales,
    incomeFromInstallments,
    payments: periodPayments.total,
    dailyExpensesTotal: periodPayments.dailyExpensesTotal,
    fixedProrated: periodPayments.fixedProrated,
    fixedMonthlyTotal: periodPayments.fixedMonthlyTotal,
    debtsGenerated,
    utility: finRound2(income - periodPayments.total),
  }
}

/**
 * Deletes one of the signed-in user's own notifications (bell «Borrar»).
 * Success requires proof the row is gone: a DELETE blocked by RLS returns
 * no error but removes 0 rows, so the deleted rows are selected back.
 */
export async function deleteMyNotification(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
      if (!error && data && data.length > 0) return true
      if (!error) console.error('deleteMyNotification: 0 rows deleted (possible RLS block) for', id)
      return false
    } catch (e) {
      console.error('Supabase notification delete failed:', e)
      return false
    }
  }
  const idx = mockDb.MOCK_NOTIFICATIONS.findIndex(n => n.id === id)
  if (idx >= 0) {
    mockDb.MOCK_NOTIFICATIONS.splice(idx, 1)
    return true
  }
  return false
}

// ----------------------------------------------------
// Birthday dismissals (panel «Cumpleaños próximos» → «Eliminar»)
// ----------------------------------------------------
// Dismissing a birthday hides ONLY the occurrence being shown (its
// calendar year); next year's occurrence reappears on its own. The
// table arrives with migration 20261118_birthday_dismissals.sql — until
// it is applied, reads degrade silently to «nothing dismissed» (the
// list behaves exactly as before) and a dismissal reports failure, so
// the row stays put instead of pretending it was hidden forever.

const birthdayDismissalKey = (customerId: string, occurrenceYear: number) =>
  `${customerId}:${occurrenceYear}`

// Demo mode (no Supabase): dismissals live for the session only.
const MOCK_BIRTHDAY_DISMISSALS = new Set<string>()

/**
 * Keys (`customerId:occurrenceYear`) of the birthdays dismissed for the
 * current cycle. The panel's 7-day window can straddle New Year, so
 * both this year's and next year's occurrences are read.
 */
export async function getBirthdayDismissals(): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const year = new Date().getFullYear()
      const { data, error } = await supabase
        .from('birthday_dismissals')
        .select('customer_id, occurrence_year')
        .in('occurrence_year', [year, year + 1])
      if (!error && data) {
        return new Set(
          (data as any[]).map(r => birthdayDismissalKey(r.customer_id, r.occurrence_year))
        )
      }
      if (error) {
        console.error('Supabase birthday dismissals fetch failed (¿migración 20261118 aplicada?):', error.message)
      }
    } catch (e) {
      console.error('Supabase birthday dismissals fetch failed:', e)
    }
    return new Set()
  }
  return new Set(MOCK_BIRTHDAY_DISMISSALS)
}

/**
 * Persists the dismissal of one birthday occurrence. Returns true only
 * when the row is proven stored (selected back), mirroring
 * deleteMyNotification: an RLS block or a missing table must surface as
 * failure so the UI keeps the row and warns, never as a silent hide.
 */
export async function dismissBirthday(customerId: string, occurrenceYear: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('birthday_dismissals')
        .insert([{ customer_id: customerId, occurrence_year: occurrenceYear }])
        .select('customer_id')
      if (!error && data && data.length > 0) return true
      if (!error) console.error('dismissBirthday: 0 rows inserted (possible RLS block) for', customerId, occurrenceYear)
      return false
    } catch (e) {
      console.error('Supabase birthday dismiss failed:', e)
      return false
    }
  }
  MOCK_BIRTHDAY_DISMISSALS.add(birthdayDismissalKey(customerId, occurrenceYear))
  return true
}

// ---------------------------------------------------------------------------
// Actividad reciente del panel (decisión del dueño, 2026-11-18): la
// sección ya no muestra solo ventas — mezcla TODA la actividad de la
// óptica, más reciente primero:
//   · Ventas            → de `sales` (getSales, como siempre).
//   · Exámenes nuevos   → de `clinical_exams` (getRecentExams, aquí).
//   · Clientes nuevos   → de `profiles` (el panel ya los carga).
//   · Recordatorios enviados y felicitaciones de cumpleaños → de
//     `activity_events` (getRecentActivityEvents, aquí): se envían por
//     WhatsApp con un toque y no vivían en ninguna tabla, así que
//     logActivityEvent() deja el rastro al tocar el botón.
//
// Degradación: si la migración de `activity_events` aún no se aplica,
// la lectura devuelve «sin eventos» y el registro devuelve false, sin
// lanzar — la sección sigue con las demás fuentes y el envío por
// WhatsApp NUNCA se bloquea por el registro.
// ---------------------------------------------------------------------------

export type ActivityEventType = 'reminder_sent' | 'birthday_greeting'

export interface RecentExamActivity {
  id: string
  customer_id: string
  customer_name: string | null
  created_at: string
}

export interface ActivityEventItem {
  id: string
  type: string
  customer_id: string | null
  customer_name: string | null
  description: string
  created_at: string
}

// Demo mode (no Supabase): los envíos registrados viven en memoria,
// solo durante la sesión, igual que los descartes de cumpleaños.
const MOCK_ACTIVITY_EVENTS: ActivityEventItem[] = []

/**
 * Resuelve nombres de perfiles por id en una sola consulta (sin joins:
 * así la lectura no depende del nombre exacto de las llaves foráneas).
 * Cualquier fallo deja el mapa vacío y la UI usa su texto de respaldo.
 */
async function resolveProfileNames(supabase: any, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (unique.length === 0) return names
  try {
    const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unique)
    if (!error && data) {
      for (const p of data as any[]) {
        if (p?.id && p?.full_name) names.set(p.id, p.full_name)
      }
    }
  } catch (e) {
    console.error('resolveProfileNames failed:', e)
  }
  return names
}

/**
 * Exámenes más recientes (de `clinical_exams`, por su created_at), con
 * el nombre del cliente listo para la lista de actividad. Ante
 * cualquier fallo de lectura devuelve []: la sección se queda con las
 * demás fuentes en vez de romperse.
 */
export async function getRecentExams(limit = 15): Promise<RecentExamActivity[]> {
  if (!isSupabaseConfigured()) {
    // Demo mode: los exámenes mock traen exam_date pero no created_at;
    // se usa la fecha del examen como fecha de la actividad.
    return [...mockDb.MOCK_CLINICAL_EXAMS]
      .map((e: any) => ({
        id: e.id,
        customer_id: e.customer_id,
        customer_name: mockDb.MOCK_PROFILES.find(p => p.id === e.customer_id)?.full_name ?? null,
        created_at: e.created_at ?? e.exam_date,
      }))
      .filter(e => !!e.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  }
  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('clinical_exams')
        .select('id, customer_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
    )
    if (error) {
      console.error('Error fetching recent exams:', error.message)
      return []
    }
    if (!data) return []
    const names = await resolveProfileNames(supabase, (data as any[]).map(e => e.customer_id))
    return (data as any[]).map(e => ({
      id: e.id,
      customer_id: e.customer_id,
      customer_name: names.get(e.customer_id) ?? null,
      created_at: e.created_at,
    }))
  } catch (e) {
    console.error('Error fetching recent exams:', e)
    return []
  }
}

/**
 * Envíos registrados en `activity_events` (recordatorios y
 * felicitaciones), más recientes primero, con el nombre del cliente.
 * Si la tabla aún no existe (migración sin aplicar) o la lectura
 * falla, devuelve [] en silencio: la actividad sigue con ventas,
 * exámenes y clientes nuevos.
 */
export async function getRecentActivityEvents(limit = 15): Promise<ActivityEventItem[]> {
  if (!isSupabaseConfigured()) {
    return [...MOCK_ACTIVITY_EVENTS]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  }
  try {
    const supabase = createBrowserClient()
    const { data, error } = await withTimeout(
      supabase
        .from('activity_events')
        .select('id, type, customer_id, description, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
    )
    if (error) {
      console.error('Supabase activity events fetch failed (¿migración 20261118 aplicada?):', error.message)
      return []
    }
    if (!data) return []
    const names = await resolveProfileNames(supabase, (data as any[]).map(e => e.customer_id))
    return (data as any[]).map(e => ({
      id: e.id,
      type: e.type,
      customer_id: e.customer_id ?? null,
      customer_name: e.customer_id ? (names.get(e.customer_id) ?? null) : null,
      description: e.description,
      created_at: e.created_at,
    }))
  } catch (e) {
    console.error('Supabase activity events fetch failed:', e)
    return []
  }
}

/**
 * Registra un envío en `activity_events` (lo llaman el botón WhatsApp
 * de cada recordatorio y el «Felicitar» de cumpleaños, al tocarse).
 * NUNCA lanza ni bloquea: devuelve true si el evento quedó guardado y
 * false si no — el envío por WhatsApp sigue su curso en ambos casos.
 */
export async function logActivityEvent(
  type: ActivityEventType,
  opts: { customerId?: string | null; description: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    MOCK_ACTIVITY_EVENTS.unshift({
      id: `mock-event-${Date.now()}`,
      type,
      customer_id: opts.customerId ?? null,
      customer_name: opts.customerId
        ? (mockDb.MOCK_PROFILES.find(p => p.id === opts.customerId)?.full_name ?? null)
        : null,
      description: opts.description,
      created_at: new Date().toISOString(),
    })
    return true
  }
  try {
    const supabase = createBrowserClient()
    let actorId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      actorId = user?.id ?? null
    } catch {
      // Sin sesión legible el evento se guarda igual, sin actor.
    }
    const { error } = await supabase.from('activity_events').insert([{
      type,
      customer_id: opts.customerId ?? null,
      description: opts.description,
      actor_id: actorId,
    }])
    if (error) {
      console.error('logActivityEvent insert failed (¿migración 20261118 aplicada?):', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('logActivityEvent failed:', e)
    return false
  }
}
