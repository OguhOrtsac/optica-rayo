import { createBrowserClient } from '@supabase/ssr'

let clientSingleton: any = null

/**
 * Creates a Supabase client for use in Client Components.
 * Fallbacks are provided to ensure the application builds successfully
 * even if environment variables are not yet configured.
 */
export function createClient() {
  if (clientSingleton) return clientSingleton

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
        'Using placeholder values to prevent runtime crashes during initial UI construction.'
      );
    }
  }

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey)

  // Client-side mock session support to bypass database connection timeout
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split('; ').reduce((acc: any, c) => {
      const [name, val] = c.split('=')
      if (name) {
        acc[name] = val
      }
      return acc
    }, {})

    const mockEmail = cookies['optica_rayo_mock_email'] ? decodeURIComponent(cookies['optica_rayo_mock_email']) : null
    const mockRole = cookies['optica_rayo_mock_role'] ? decodeURIComponent(cookies['optica_rayo_mock_role']) : null
    const mockName = cookies['optica_rayo_mock_name'] ? decodeURIComponent(cookies['optica_rayo_mock_name']) : null

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
  }

  clientSingleton = client
  return clientSingleton
}
