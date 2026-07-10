'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileBottomNavProps {
  isAuthenticated: boolean
  role: string | null
  initials: string
}

export default function MobileBottomNav({ isAuthenticated, role, initials }: MobileBottomNavProps) {
  const pathname = usePathname()

  if (!isAuthenticated) {
    return null
  }

  // Define navigation links based on user role
  const getLinks = () => {
    // Customer view
    if (role === 'customer') {
      return [
        { label: 'Inicio', href: '/dashboard/customer', icon: 'home' },
        { label: 'Catálogo', href: '/catalog', icon: 'catalog' },
        { label: 'Perfil', href: '/profile', icon: 'profile' }
      ]
    }

    // Staff view (owner, seller, dev)
    const homeHref = (role === 'owner' || role === 'dev') ? '/dashboard/admin' : '/dashboard/seller'
    return [
      { label: 'Inicio', href: homeHref, icon: 'home' },
      { label: 'Registrar Pago', href: '/payments', icon: 'payment' },
      { label: 'Clientes', href: '/customers', icon: 'patients' },
      { label: 'Realizar Venta', href: '/dashboard/seller', icon: 'pos' },
      { label: 'Perfil', href: '/profile', icon: 'profile' }
    ]
  }

  const links = getLinks()

  // Render SVG icons dynamically
  const renderIcon = (type: string) => {
    switch (type) {
      case 'home':
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        )
      case 'catalog':
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )
      case 'patients':
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      case 'payment':
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        )
      case 'pos':
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )
      case 'profile':
        return (
          <div className="w-6 h-6 rounded-full bg-[#dee8ff] dark:bg-slate-800 border border-[#c3c6d5] dark:border-slate-700 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-black text-[#00357f] dark:text-slate-350">
              {initials}
            </span>
          </div>
        )
      default:
        return null
    }
  }

  // Checks if a link is active.
  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f9f9ff] dark:bg-slate-950 border-t border-[#cbd5e1] dark:border-slate-900/60 flex md:hidden justify-around items-center h-20 pb-safe px-2 shadow-lg rounded-t-2xl">
      {links.map(link => {
        const active = isActive(link.href)
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition-all duration-300 ${
              active 
                ? 'text-[#00357f] dark:text-cyan-400 scale-105 font-black' 
                : 'text-[#5d606f] dark:text-slate-400 hover:text-[#00357f] font-semibold'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-[#dee8ff]/50 dark:bg-slate-900' : ''}`}>
              {renderIcon(link.icon)}
            </div>
            <span className="text-[8px] mt-0.5 tracking-tight select-none">
              {link.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
