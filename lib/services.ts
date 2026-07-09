import { createClient as createBrowserClient } from '@/utils/supabase/client'
import * as mockDb from './mocks'
import { Database } from '@/types/database.types'

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
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
      )
      
      if (!error && data) return data
      console.error('Error fetching products from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_PRODUCTS
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
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `products/${fileName}`

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file)

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath)
        
        return publicUrl
      }
      console.warn('Supabase storage upload error, trying base64 fallback:', error?.message)
    } catch (e) {
      console.warn('Supabase storage upload failed, trying base64 fallback:', e)
    }
  }

  // Fallback: Convert to Base64 data URL
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
  if (isSupabaseConfigured()) {
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
      
      if (!error && data) {
        return data.map((sale: any) => ({
          ...sale,
          customer_name: sale.customer?.full_name || 'Desconocido',
          seller_name: sale.seller?.full_name || 'Desconocido'
        }))
      }
      console.error('Error fetching sales from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase sales fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_SALES
}

/**
 * Service to register a new transaction sale (Staff only).
 */
export async function createSale(
  customerName: string, 
  items: { productId: string; quantity: number }[],
  paidAmount?: number,
  paymentMethod?: 'cash' | 'card' | 'transfer'
): Promise<any> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      
      const total = items.reduce((acc, item) => {
        const prod = mockDb.MOCK_PRODUCTS.find(p => p.id === item.productId)
        return acc + (prod ? prod.price * item.quantity : 0)
      }, 0)

      const finalPaidAmount = paidAmount !== undefined ? paidAmount : total
      const pendingBalance = Math.max(0, total - finalPaidAmount)

      // Status computation for workshop
      let statusVal: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado' = 'Cotizacion'
      if (finalPaidAmount >= total) {
        statusVal = 'Listo_Entrega'
      } else if (finalPaidAmount > 0) {
        statusVal = 'Anticipo_Pagado'
      }

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          total,
          paid_amount: finalPaidAmount,
          pending_balance: pendingBalance,
          payment_method: paymentMethod || 'cash',
          status: statusVal
        }])
        .select()
        .single()
      
      if (!saleError && saleData) {
        const saleItemsToInsert = items.map(item => {
          const prod = mockDb.MOCK_PRODUCTS.find(p => p.id === item.productId)
          return {
            sale_id: saleData.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: prod ? prod.price : 0
          }
        })

        await supabase.from('sale_items').insert(saleItemsToInsert)
        
        // Auto-create a reminder for 12 months
        await supabase.from('reminders').insert([{
          customer_id: saleData.customer_id || 'some-id',
          next_suggested_visit: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }])

        return { sale: saleData }
      }
      console.error('Error registering sale in Supabase:', saleError?.message)
    } catch (e) {
      console.error('Supabase sale registration failed, falling back to mocks:', e)
    }
  }
  return mockDb.addMockSale(customerName, items, paidAmount, paymentMethod)
}

/**
 * Service to fetch reminders (Staff/Admin only).
 */
export async function getReminders(): Promise<(Reminder & { customer_name?: string })[]> {
  if (isSupabaseConfigured()) {
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
      
      if (!error && data) {
        return data.map((rem: any) => ({
          ...rem,
          customer_name: rem.customer?.full_name || 'Desconocido'
        }))
      }
      console.error('Error fetching reminders from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase reminders fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_REMINDERS
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
              quantity,
              price,
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
  // Fallback
  return mockDb.MOCK_SALES.filter(s => s.customer_id === customerId)
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

/**
 * Service to fetch all users/profiles (Admin only).
 */
export async function getAllProfiles(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true })
      )

      if (!error && data) return data
      console.error('Error fetching all profiles:', error?.message)
    } catch (e) {
      console.error('Supabase profiles fetch failed:', e)
    }
  }
  // Fallback
  return mockDb.MOCK_PROFILES
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
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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
  
  if (isSupabaseConfigured()) {
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
          customer_profiles!lens_requests_customer_id_fkey(phone),
          frame:products!lens_requests_frame_id_fkey(name, price),
          lens_material:lens_materials!lens_requests_lens_material_id_fkey(name, price)
        `)
        .order('created_at', { ascending: false })

      if (customerId) {
        q = q.eq('customer_id', customerId)
      }

      const { data, error } = await q
      if (!error && data) {
        // Hydrate treatments manually if needed or map values
        return data
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


