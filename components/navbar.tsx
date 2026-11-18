import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import MobileBottomNav from './mobile-bottom-nav'
import ScrollNavEffect from './scroll-nav'
import MainMenu, { type MainMenuItem, type MainMenuLink } from './main-menu'
import NotificationBell from './notification-bell'
import { dashboardHrefForRole, normalizeRole, roleLabel } from '@/lib/roles'

/**
 * Global Navigation Bar with App Shell Architecture.
 * Renders a top navigation bar on desktop and a bottom navigation bar on mobile.
 * Optimized touch targets (minimum 44px) and visual hierarchy.
 */
export default async function Navbar() {
  let isAuthenticated = false
  let role: string | null = null
  let displayName = ''
  let initials = ''

  {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      isAuthenticated = true
      role = normalizeRole(user.user_metadata?.role || null)
      displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      initials = displayName
        .split(' ')
        .map((word: string) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
  }

  // Setup navigation items based on the canonical role model.
  // La hamburguesa se ordena por CATEGORÍAS (orden del dueño, 2026-11-18):
  // los grupos Ventas, Finanzas y Configuración son desplegables y el
  // resto de destinos quedan como entradas directas. La visibilidad se
  // aplica por entrada, como siempre: un grupo solo se construye si trae
  // al menos una entrada visible para el rol (Ventas es de staff;
  // Finanzas, de administrador; en Configuración, Productos y Clientes
  // son de staff y Usuarios, Mensajes y Configurar horario solo del
  // administrador).
  // La barra inferior móvil lleva el trabajo diario: Inicio · Realizar
  // Venta · Registrar Pago · Realizar examen · Agenda (el Perfil vive
  // aquí en la hamburguesa, como «Mi perfil»). «Agenda» (staff) y
  // «Agendar examen gratis» (pública) son destinos distintos, con
  // etiqueta e icono distintos.
  const getNavItems = (): MainMenuItem[] => {
    if (!isAuthenticated) {
      return [
        { label: 'Catálogo', href: '/catalog', icon: 'catalog' },
        { label: 'Agendar examen gratis', href: '/agendar', icon: 'agendar' },
      ]
    }
    if (role === 'customer') {
      return [
        { label: 'Agendar examen gratis', href: '/agendar', icon: 'agendar' },
      ]
    }
    if (role === 'optometrist') {
      return [
        { label: 'Agenda', href: '/dashboard/appointments', icon: 'agenda' },
      ]
    }
    if (role === 'seller' || role === 'owner' || role === 'super_admin') {
      const isAdmin = role === 'owner' || role === 'super_admin'
      const items: MainMenuItem[] = [
        { label: 'Catálogo', href: '/catalog', icon: 'catalog' },
        { label: 'Agenda', href: '/dashboard/appointments', icon: 'agenda' },
        {
          label: 'Ventas',
          icon: 'store',
          links: [
            { label: 'Realizar venta', href: '/dashboard/seller', icon: 'pos' },
            { label: 'Historial de ventas', href: '/dashboard/seller/historial', icon: 'history' },
          ],
        },
      ]
      if (isAdmin) {
        items.push({
          label: 'Finanzas',
          icon: 'wallet',
          links: [
            { label: 'Ventas de hoy', href: '/dashboard/admin/finanzas/hoy', icon: 'coins' },
            { label: 'Ventas del mes', href: '/dashboard/admin/finanzas/mes', icon: 'calendarRange' },
            { label: 'Pagos', href: '/dashboard/admin/finanzas/pagos', icon: 'calendarClock' },
            { label: 'Utilidad del mes', href: '/dashboard/admin/finanzas/utilidad', icon: 'trendingUp' },
          ],
        })
      }
      const configLinks: MainMenuLink[] = [
        { label: 'Productos', href: '/dashboard/admin/products', icon: 'products' },
        ...(isAdmin ? [{ label: 'Usuarios', href: '/dashboard/admin/users', icon: 'users' } as MainMenuLink] : []),
        { label: 'Clientes', href: '/customers', icon: 'clients' },
        ...(isAdmin ? [{ label: 'Mensajes', href: '/dashboard/admin/mensajes', icon: 'messages' } as MainMenuLink] : []),
        ...(isAdmin ? [{ label: 'Configurar horario', href: '/dashboard/admin/horario', icon: 'calendarClock' } as MainMenuLink] : []),
      ]
      items.push({ label: 'Configuración', icon: 'settings', links: configLinks })
      if (isAdmin) {
        items.push({ label: 'Promociones', href: '/dashboard/admin/promotions', icon: 'promotions' })
        items.push({ label: 'Gastos', href: '/dashboard/admin/expenses', icon: 'expenses' })
        items.push({ label: 'Reportes', href: '/dashboard/admin/reports', icon: 'reports' })
      }
      return items
    }
    return []
  }

  const navItems = getNavItems()

  // The DESKTOP bar has no bottom navigation to lean on, so it shows the
  // full set (primary + secondary). The hamburger keeps only the
  // secondary set above — on mobile the bottom bar owns the primaries.
  const getDesktopLinks = (): { label: string; href: string }[] => {
    if (!isAuthenticated) {
      return [
        { label: 'Catálogo', href: '/catalog' },
        { label: 'Agendar examen gratis', href: '/agendar' },
      ]
    }
    const home = { label: 'Inicio', href: dashboardHrefForRole(role) }
    if (role === 'customer') {
      return [home, { label: 'Catálogo', href: '/catalog' }, { label: 'Agendar examen gratis', href: '/agendar' }]
    }
    if (role === 'optometrist') {
      return [
        { label: 'Pacientes', href: '/customers' },
        { label: 'Catálogo', href: '/catalog' },
        { label: 'Agenda', href: '/dashboard/appointments' },
      ]
    }
    if (role === 'seller' || role === 'owner' || role === 'super_admin') {
      const links = [
        home,
        { label: 'Clientes', href: '/customers' },
        { label: 'Registrar Pago', href: '/payments' },
        { label: 'Realizar Venta', href: '/dashboard/seller' },
        { label: 'Catálogo', href: '/catalog' },
        { label: 'Agenda', href: '/dashboard/appointments' },
        { label: 'Productos', href: '/dashboard/admin/products' },
      ]
      if (role === 'owner' || role === 'super_admin') {
        links.push({ label: 'Promociones', href: '/dashboard/admin/promotions' })
        links.push({ label: 'Gastos', href: '/dashboard/admin/expenses' })
        links.push({ label: 'Reportes', href: '/dashboard/admin/reports' })
        links.push({ label: 'Usuarios', href: '/dashboard/admin/users' })
      }
      return links
    }
    return []
  }

  const desktopLinks = getDesktopLinks()

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
      case 'payment':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
      case 'users':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <>
      <ScrollNavEffect />
      {/* Desktop Top Navbar (Hidden on mobile) */}
      <nav className="site-nav w-full bg-[#f9f9ff]/90 backdrop-blur-md border-b border-[#c3c6d5] sticky top-0 z-50 px-6 h-16 hidden md:block shadow-sm">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex min-h-11 items-center gap-2 group rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]">
            <div className="w-8 h-8 rounded-full bg-[#d9e2ff] flex items-center justify-center text-[#00357f] font-bold overflow-hidden">
              {initials || "OR"}
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#00357f] transition-colors">
              Óptica <span className="text-[#0899c9]">Rayo</span>
            </span>
            {/* Logo oficial (ojo) DESPUÉS del nombre (orden del dueño
                2026-11-18), a la altura de la letra: h-6 no crece el
                alto de la barra ni el tamaño del texto. */}
            <img src="/logo-eye.png" alt="" aria-hidden className="h-6 w-auto shrink-0" />
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6 h-full">
            <div className="flex gap-4 h-full items-center">
              {desktopLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#434653] transition-colors hover:bg-[#dee8ff]/40 hover:text-[#00357f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="h-4 w-px bg-[#c3c6d5] mx-2" />

            {/* Auth Profile / Login */}
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex min-h-11 items-center gap-2.5 group/profile rounded-xl px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                title={`Perfil de ${displayName}`}
              >
                <span className="text-right leading-tight">
                  <span className="block text-xs font-bold text-[#434653] group-hover/profile:text-[#00357f] transition-colors">
                    {displayName}
                  </span>
                  <span className="block text-[10px] font-semibold text-[#5d606f]">
                    {roleLabel(role)}
                  </span>
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-[#00357f] hover:bg-[#00509e] text-white font-bold text-xs px-5 py-2 rounded-full transition-all duration-300 active:scale-95 min-h-11 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
              >
                Entrar o crear cuenta
              </Link>
            )}

            {/* Staff notification bell, hasta la derecha (renders nothing for guests/customers) */}
            <NotificationBell role={role} />
          </div>
        </div>
      </nav>

      {/* Mobile Top Header (Minimalist for PWA view) — orden del dueño
          2026-11-18: hamburguesa a la izquierda, marca centrada y
          campanita hasta la derecha. El botón de iniciales que llevaba
          al perfil salió de la barra: el Perfil vive en este menú
          hamburguesa («Mi perfil»). La rejilla 1fr/auto/1fr mantiene la marca centrada
          aunque un lado vaya vacío (la campanita no se pinta para
          invitados ni clientes). */}
      <header className="site-nav relative w-full bg-[#f9f9ff]/95 backdrop-blur border-b border-[#c3c6d5] sticky top-0 z-50 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] grid grid-cols-[1fr_auto_1fr] items-center md:hidden shadow-sm">
        <div className="flex items-center justify-start">
          <MainMenu
            items={navItems}
            isAuthenticated={isAuthenticated}
            displayName={displayName}
            initials={initials}
          />
        </div>

        <Link href="/" className="flex min-h-11 items-center justify-center gap-2 justify-self-center rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]">
          <span className="text-xl font-extrabold tracking-tight text-[#00357f]">
            Óptica <span className="text-[#0899c9]">Rayo</span>
          </span>
          {/* Logo oficial (ojo) DESPUÉS del nombre (orden del dueño
              2026-11-18), a la altura de la letra: h-6 no crece el
              alto de la barra ni el tamaño del texto. El conjunto
              nombre+ojo sigue centrado (justify-center). */}
          <img src="/logo-eye.png" alt="" aria-hidden className="h-6 w-auto shrink-0" />
        </Link>

        <div className="flex items-center justify-end">
          {/* Staff notification bell (renders nothing for guests/customers) */}
          <NotificationBell role={role} />
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav isAuthenticated={isAuthenticated} role={role} initials={initials} />
    </>
  )
}
