import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { dashboardHrefForRole, normalizeRole } from '@/lib/roles'

/**
 * Global Next.js Proxy.
 * Standardizes authentication, handles cookies, and enforces RBAC.
 * Includes bypass logic for the temporal Super Admin session.
 */
export async function proxy(request: NextRequest) {
  // 1. Refresh active Supabase session cookies first
  let response = await updateSession(request)

  const { pathname } = request.nextUrl
  
  // Read local Super Admin bypass session cookie
  const superadminSession = request.cookies.get('optica_rayo_superadmin_session')?.value

  // CASE A: Mock Bypass is active
  if (superadminSession === 'true') {
    const mockRole = request.cookies.get('optica_rayo_mock_role')?.value || 'owner'

    const normalizedMockRole = normalizeRole(mockRole)

    // Root-level dashboard redirection based on the canonical role.
    if (pathname === '/login' || pathname === '/' || pathname === '/change-password' || pathname === '/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = dashboardHrefForRole(normalizedMockRole)
      return NextResponse.redirect(url)
    }

    // Role-based path protections for mock sessions
    if (pathname.startsWith('/dashboard/admin')) {
      if (!['owner', 'super_admin'].includes(normalizedMockRole)) {
        const url = request.nextUrl.clone()
        url.pathname = dashboardHrefForRole(normalizedMockRole)
        return NextResponse.redirect(url)
      }
    }

    if (pathname.startsWith('/dashboard/seller')) {
      if (!['owner', 'seller', 'super_admin'].includes(normalizedMockRole)) {
        const url = request.nextUrl.clone()
        url.pathname = dashboardHrefForRole(normalizedMockRole)
        return NextResponse.redirect(url)
      }
    }

    if (pathname.startsWith('/dashboard/customer') && normalizedMockRole !== 'customer') {
      const url = request.nextUrl.clone()
      url.pathname = dashboardHrefForRole(normalizedMockRole)
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/customers') && normalizedMockRole === 'customer') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/customer'
      return NextResponse.redirect(url)
    }

    return response
  }

  // CASE B: Standard Supabase Auth Flow
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  // Create client instance dedicated to this request
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Fetch authenticated user data
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated requests away from protected routes
  if (!user) {
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/change-password') || pathname.startsWith('/profile') || pathname.startsWith('/customers')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return response
  }

  const userRole = normalizeRole(user.user_metadata?.role || 'customer')
  const temporalPasswordChanged = user.user_metadata?.temporal_password_changed ?? true

  if (!temporalPasswordChanged) {
    // Forced change password flow
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/profile') || pathname.startsWith('/customers') || pathname === '/' || pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/change-password'
      return NextResponse.redirect(url)
    }
  } else {
    // Lock access to /change-password if already updated
    if (pathname.startsWith('/change-password')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Role-based route protection
  if (pathname.startsWith('/customers')) {
    if (!['owner', 'seller', 'super_admin', 'optometrist'].includes(userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/dashboard/admin')) {
    if (!['owner', 'super_admin'].includes(userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/dashboard/seller')) {
    if (!['owner', 'seller', 'super_admin'].includes(userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Redirect authenticated user away from login page
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
