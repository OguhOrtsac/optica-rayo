import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { dashboardHrefForRole, normalizeRole } from '@/lib/roles'

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

  const role = normalizeRole(user.user_metadata?.role || 'customer')
  redirect(dashboardHrefForRole(role))
}
