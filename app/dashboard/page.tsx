import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Core Dashboard Router (Server Component).
 * Resolves the authenticated user's role on the server and redirects
 * to `/dashboard/admin`, `/dashboard/seller`, or `/dashboard/customer`.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const role = user.user_metadata?.role || 'customer'

  // Route depending on role permissions
  if (role === 'owner' || role === 'dev') {
    redirect('/dashboard/admin')
  }
  
  if (role === 'seller') {
    redirect('/dashboard/seller')
  }

  // Default fallback route for customers
  redirect('/dashboard/customer')
}
