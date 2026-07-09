import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and API Route Handlers. Uses cookies to persist user sessions on the server.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing on Server Client. ' +
        'Using placeholder values.'
      );
    }
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })

  // Override auth if mock session is active to bypass database connection timeout
  const mockEmail = cookieStore.get('optica_rayo_mock_email')?.value
  const mockRole = cookieStore.get('optica_rayo_mock_role')?.value
  const mockName = cookieStore.get('optica_rayo_mock_name')?.value

  if (mockEmail) {
    const mockUser = {
      id: mockEmail === 'superadmin@opticarayo.com' 
        ? 'opt-1' 
        : (mockEmail === 'vendedora@opticarayo.com' ? 'sell-1' : 'cust-1'),
      email: mockEmail,
      user_metadata: {
        role: mockRole,
        full_name: mockName
      }
    }
    client.auth.getUser = async () => {
      return { data: { user: mockUser as any }, error: null }
    }
    client.auth.getSession = async () => {
      return { data: { session: { user: mockUser } as any }, error: null }
    }
  }

  return client
}
