import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

/**
 * Global Navigation Bar with App Shell Architecture.
 * Renders a top navigation bar on desktop and a bottom navigation bar on mobile.
 * Optimized touch targets (minimum 44px) and visual hierarchy.
 */
export default async function Navbar() {
  const cookieStore = await cookies()
  const superadminSession = cookieStore.get('optica_rayo_superadmin_session')?.value

  let isAuthenticated = false
  let role: string | null = null
  let displayName = ''
  let initials = ''

  if (superadminSession === 'true') {
    isAuthenticated = true
    role = 'dev'
    displayName = 'Super Admin'
    initials = 'SA'
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      isAuthenticated = true
      role = user.user_metadata?.role || null
      displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      initials = displayName
        .split(' ')
        .map((word: string) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
  }

  // Setup navigation items based on roles
  const getNavLinks = () => {
    const links = [{ label: 'Catálogo', href: '/catalog', icon: 'catalog' }]
    if (isAuthenticated) {
      if (role === 'customer') {
        links.push({ label: 'Descuentos', href: '/dashboard/customer', icon: 'discounts' })
      }
      if (role === 'seller') {
        links.push({ label: 'Pacientes', href: '/customers', icon: 'patients' })
        links.push({ label: 'Ventas POS', href: '/dashboard/seller', icon: 'pos' })
      }
      if (role === 'owner' || role === 'dev') {
        links.push({ label: 'Panel', href: '/dashboard/admin', icon: 'admin' })
        links.push({ label: 'Pacientes', href: '/customers', icon: 'patients' })
        links.push({ label: 'POS', href: '/dashboard/seller', icon: 'pos' })
      }
    }
    return links
  }

  const navLinks = getNavLinks()

  // Render SVG icons dynamically
  const renderIcon = (type: string) => {
    switch (type) {
      case 'catalog':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )
      case 'discounts':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        )
      case 'patients':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      case 'pos':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )
      case 'admin':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <>
      {/* Desktop Top Navbar (Hidden on mobile) */}
      <nav className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-50 px-6 py-4 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-lg flex items-center justify-center shadow shadow-cyan-500/10">
              <svg className="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-black tracking-tight text-slate-100 group-hover:text-cyan-400 transition-colors">
              Óptica <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Rayo</span>
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="h-4 w-px bg-slate-800 mx-2" />

            {/* Auth Profile / Login */}
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex items-center gap-2.5 group/profile py-1"
                title={`Perfil de ${displayName}`}
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center shadow shadow-cyan-500/15 group-hover/profile:shadow-cyan-500/30 group-hover/profile:scale-105 transition-all duration-200">
                  <span className="text-[11px] font-black text-slate-950 select-none">
                    {initials}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover/profile:text-cyan-400 transition-colors">
                  Mi Perfil
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow shadow-cyan-500/10 transition-all duration-300"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Top Header (Minimalist for PWA view) */}
      <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-50 px-4 py-3 flex md:hidden justify-between items-center">
        <Link href="/" className="flex items-center gap-1.5">
          <div className="w-7.5 h-7.5 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-black tracking-tight text-slate-100">
            Óptica <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Rayo</span>
          </span>
        </Link>

        {/* Small Profile Quick Link */}
        {isAuthenticated ? (
          <Link href="/profile" className="flex items-center">
            <div className="w-7 h-7 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center border border-slate-900">
              <span className="text-[10px] font-black text-slate-950">
                {initials}
              </span>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-lg"
          >
            Entrar
          </Link>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar (App Shell style, h-16 + touch friendly >= 44px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900/60 flex md:hidden justify-around items-center h-16 pb-safe px-2 shadow-2xl">
        {navLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            {renderIcon(link.icon)}
            <span className="text-[9px] font-extrabold mt-1 tracking-tight select-none">
              {link.label}
            </span>
          </Link>
        ))}
        {isAuthenticated ? (
          <Link
            href="/profile"
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <span className="text-[8px] font-bold text-slate-300">
                {initials}
              </span>
            </div>
            <span className="text-[9px] font-extrabold mt-1 tracking-tight select-none">
              Perfil
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span className="text-[9px] font-extrabold mt-1 tracking-tight select-none">
              Login
            </span>
          </Link>
        )}
      </nav>
    </>
  )
}
