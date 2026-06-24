import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

/**
 * Global Navigation Bar.
 * Renders server-side, fetching role and session to present dynamic links.
 * Shows a profile avatar (initials) that links to /profile for all authenticated users.
 * Supports both standard Supabase auth and the Super Admin cookie bypass.
 */
export default async function Navbar() {
  const cookieStore = await cookies()
  const superadminSession = cookieStore.get('optica_rayo_superadmin_session')?.value

  let isAuthenticated = false
  let role: string | null = null
  let displayName = ''
  let initials = ''

  if (superadminSession === 'true') {
    // Super Admin bypass - no Supabase session exists
    isAuthenticated = true
    role = 'dev'
    displayName = 'Super Admin'
    initials = 'SA'
  } else {
    // Standard Supabase auth
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

  return (
    <nav className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between relative">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-lg flex items-center justify-center shadow shadow-cyan-500/10">
            <svg
              className="w-5 h-5 text-slate-950"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight text-slate-100 group-hover:text-cyan-400 transition-colors">
            Óptica <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Rayo</span>
          </span>
        </Link>

        {/* Mobile Menu Toggle (Pure CSS trigger) */}
        <label
          htmlFor="mobile-menu-checkbox"
          className="md:hidden flex items-center justify-center p-2 text-slate-400 hover:text-slate-100 cursor-pointer select-none"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </label>
        
        <input
          type="checkbox"
          id="mobile-menu-checkbox"
          className="hidden peer"
        />

        {/* Navigation Links */}
        <div className="hidden peer-checked:flex md:flex flex-col md:flex-row items-stretch md:items-center gap-4 absolute md:relative top-full left-0 w-full md:w-auto bg-slate-950 md:bg-transparent border-b border-slate-900 md:border-b-0 py-4 md:py-0 px-6 md:px-0 transition-all duration-300 md:top-auto md:left-auto">
          
          <Link
            href="/catalog"
            className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
          >
            Catálogo
          </Link>

          {/* Role-Specific Navigation Links */}
          {isAuthenticated && (
            <>
              {role === 'customer' && (
                <Link
                  href="/dashboard/customer"
                  className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                >
                  Mis Descuentos
                </Link>
              )}
              {role === 'seller' && (
                <>
                  <Link
                    href="/customers"
                    className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                  >
                    Pacientes
                  </Link>
                  <Link
                    href="/dashboard/seller"
                    className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                  >
                    Terminal POS
                  </Link>
                </>
              )}
              {(role === 'owner' || role === 'dev') && (
                <>
                  <Link
                    href="/dashboard/admin"
                    className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                  >
                    Administración
                  </Link>
                  <Link
                    href="/customers"
                    className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                  >
                    Pacientes
                  </Link>
                  <Link
                    href="/dashboard/seller"
                    className="text-sm font-semibold text-slate-350 hover:text-cyan-400 py-1.5 transition-colors"
                  >
                    POS
                  </Link>
                </>
              )}
            </>
          )}

          {/* Auth Section: Profile Avatar or Login Button */}
          <div className="h-px bg-slate-900 my-2 md:hidden" />
          
          {isAuthenticated ? (
            <Link
              href="/profile"
              className="flex items-center gap-2.5 group/profile py-1"
              title={`Perfil de ${displayName}`}
            >
              {/* Avatar Circle with Initials */}
              <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center shadow shadow-cyan-500/15 group-hover/profile:shadow-cyan-500/30 group-hover/profile:scale-110 transition-all duration-200">
                <span className="text-[11px] font-black text-slate-950 select-none leading-none">
                  {initials}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover/profile:text-cyan-400 transition-colors md:hidden">
                Mi Perfil
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl text-center shadow shadow-cyan-500/10 transition-all duration-300"
            >
              Iniciar Sesión
            </Link>
          )}

        </div>
      </div>
    </nav>
  )
}
