import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

/**
 * Creates a Supabase client with administrative privileges using the service_role key.
 * This client bypasses RLS and can register/modify users directly.
 * CRITICAL: Use ONLY inside Server Components, Server Actions, or API Route Handlers.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!serviceRoleKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Warning: SUPABASE_SERVICE_ROLE_KEY is missing. ' +
        'User registration and administrative auth creation actions will fail.'
      );
    }
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false // Prevents the active admin session from being closed or overwritten
    }
  })
}
