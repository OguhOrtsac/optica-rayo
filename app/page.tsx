import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

/**
 * Root page component.
 * Performs a server-side check of the active user session and redirects
 * to either the Dashboard or the Login screen accordingly.
 */
export default async function HomePage() {
  const supabase = await createClient()
  
  // Read current active user session
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  redirect('/login')
}

