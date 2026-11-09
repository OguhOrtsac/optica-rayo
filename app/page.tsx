import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

/**
 * Root page component.
 * Signed-in users go to their workspace; guests land on the public
 * storefront (the owner's model: anyone may browse the catalog without
 * an account, and sign-in is one tap away in the menu).
 */
export default async function HomePage() {
  const supabase = await createClient()

  // Read current active user session
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  redirect('/catalog')
}

