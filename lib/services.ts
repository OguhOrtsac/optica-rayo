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
 * Service to fetch all products in the catalog.
 */
export async function getProducts(): Promise<Product[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })
      
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
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:profiles!sales_customer_id_fkey(full_name),
          seller:profiles!sales_seller_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
      
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
export async function createSale(customerName: string, items: { productId: string; quantity: number }[]): Promise<any> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      
      // Step A: Find or create a temporary client profile
      // For this wizard, we mock creating a new profile.
      // In production, we register them on profiles and auth.
      // Below we execute the mock transaction as default since we don't have full profile sync details,
      // but if Supabase is connected we would insert into sales/sale_items.
      
      // Let's implement the live database transaction insert:
      const total = items.reduce((acc, item) => {
        const prod = mockDb.MOCK_PRODUCTS.find(p => p.id === item.productId)
        return acc + (prod ? prod.price * item.quantity : 0)
      }, 0)

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total }])
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
  return mockDb.addMockSale(customerName, items)
}

/**
 * Service to fetch reminders (Staff/Admin only).
 */
export async function getReminders(): Promise<(Reminder & { customer_name?: string })[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          customer:profiles(full_name)
        `)
        .order('next_suggested_visit', { ascending: true })
      
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
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (!error && data) return data
      console.error('Error fetching coupons from Supabase:', error?.message)
    } catch (e) {
      console.error('Supabase coupons fetch failed, falling back to mocks:', e)
    }
  }
  return mockDb.MOCK_COUPONS.filter(c => c.is_active)
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

      const { data, error } = await q
      if (!error && data) return data
      console.error('Error searching customers:', error?.message)
    } catch (e) {
      console.error('Customer search failed:', e)
    }
  }
  return []
}

/**
 * Fetches a single customer's full profile including clinical profile.
 */
export async function getCustomerById(id: string): Promise<any | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, customer_profiles(*)`)
        .eq('id', id)
        .single()

      if (!error && data) return data
      console.error('Error fetching customer:', error?.message)
    } catch (e) {
      console.error('Customer fetch failed:', e)
    }
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
      const { data, error } = await supabase
        .from('clinical_exams')
        .select(`
          *,
          examiner:profiles!clinical_exams_examiner_id_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('exam_date', { ascending: false })

      if (!error && data) return data
      console.error('Error fetching exams:', error?.message)
    } catch (e) {
      console.error('Exam fetch failed:', e)
    }
  }
  return []
}

/**
 * Fetches all sales for a customer with product details and coupon info.
 */
export async function getCustomerSales(customerId: string): Promise<any[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
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

      if (!error && data) return data
      console.error('Error fetching customer sales:', error?.message)
    } catch (e) {
      console.error('Customer sales fetch failed:', e)
    }
  }
  return []
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true })

      if (!error && data) return data
      console.error('Error fetching all profiles:', error?.message)
    } catch (e) {
      console.error('Supabase profiles fetch failed:', e)
    }
  }
  return []
}
