'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Glasses,
  LogIn,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  TicketPercent,
  UserRound,
  X,
} from 'lucide-react'

export interface MainMenuLink {
  label: string
  href: string
  icon: 'catalog' | 'agenda' | 'agendar' | 'products' | 'users' | 'promotions' | 'expenses' | 'reports'
}

// Iconos por destino — «Agenda» (la del staff) y «Agendar examen gratis»
// (la pública) son destinos distintos y llevan iconos distintos.
const ICONS = {
  catalog: Glasses,
  agenda: CalendarDays,
  agendar: CalendarPlus,
  products: Package,
  users: ShieldCheck,
  promotions: TicketPercent,
  expenses: Receipt,
  reports: BarChart3,
}

interface MainMenuProps {
  links: MainMenuLink[]
  isAuthenticated: boolean
  displayName: string
  initials: string
}

/**
 * Mobile-first hamburger menu. Desktop keeps the horizontal bar; this menu
 * gives phones and guests the same destinations with 48px touch targets.
 */
export default function MainMenu({ links, isAuthenticated, displayName, initials }: MainMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open ])

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="menu-principal-movil"
        aria-label={open ? 'Cerrar menú principal' : 'Abrir menú principal'}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#00357f] shadow-sm transition hover:bg-[#dee8ff]/50 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="menu-principal-movil"
          className="absolute inset-x-3 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="border-b border-[#e7eeff] bg-[#f9f9ff] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Menú principal</p>
            <p className="mt-0.5 text-sm font-bold text-[#111c2d]">
              {isAuthenticated ? `Hola, ${displayName}` : 'Explora Óptica Rayo'}
            </p>
          </div>

          <nav aria-label="Navegación principal móvil" className="p-2">
            {links.map(link => {
              const Icon = ICONS[link.icon]
              const active = pathname === link.href
              return (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
                    active
                      ? 'bg-[#dee8ff] text-[#00357f]'
                      : 'text-[#434653] hover:bg-[#f0f3ff] active:bg-[#dee8ff]/70 hover:text-[#00357f]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              )
            })}

            {isAuthenticated ? (
              <Link
                href="/profile"
                className="mt-1 flex min-h-12 items-center gap-3 rounded-xl border-t border-[#e7eeff] px-3 py-3 text-sm font-bold text-[#434653] transition hover:bg-[#f0f3ff] hover:text-[#00357f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d9e2ff] text-[10px] font-black text-[#00357f]">
                  {initials || 'OR'}
                </span>
                <span>Mi perfil</span>
                <UserRound className="ml-auto h-4 w-4 text-[#737784]" />
              </Link>
            ) : (
              <div className="mt-2 border-t border-[#e7eeff] p-1 pt-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00357f] px-3 text-sm font-bold text-white transition hover:bg-[#004aad] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
                >
                  <LogIn className="h-4 w-4" /> Entrar o crear cuenta
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
