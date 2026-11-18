'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  Coins,
  Glasses,
  History,
  LogIn,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TicketPercent,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'

export type MainMenuIcon =
  | 'catalog' | 'agenda' | 'agendar' | 'products' | 'users' | 'promotions'
  | 'expenses' | 'reports' | 'pos' | 'history' | 'clients' | 'messages'
  | 'store' | 'wallet' | 'coins' | 'calendarRange' | 'calendarClock'
  | 'trendingUp' | 'settings'

export interface MainMenuLink {
  label: string
  href: string
  icon: MainMenuIcon
}

// Un grupo del menú: categoría con submenú desplegable (Ventas,
// Finanzas, Configuración). El grupo solo se construye si trae al
// menos una entrada visible para el rol.
export interface MainMenuGroup {
  label: string
  icon: MainMenuIcon
  links: MainMenuLink[]
}

export type MainMenuItem = MainMenuLink | MainMenuGroup

export function isMenuGroup(item: MainMenuItem): item is MainMenuGroup {
  return (item as MainMenuGroup).links !== undefined
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
  pos: ShoppingCart,
  history: History,
  clients: Users,
  messages: MessageSquare,
  store: Store,
  wallet: Wallet,
  coins: Coins,
  calendarRange: CalendarRange,
  calendarClock: CalendarClock,
  trendingUp: TrendingUp,
  settings: Settings,
}

interface MainMenuProps {
  items: MainMenuItem[]
  isAuthenticated: boolean
  displayName: string
  initials: string
}

/**
 * Mobile-first hamburger menu. Desktop keeps the horizontal bar; this menu
 * gives phones and guests the same destinations with 48px touch targets.
 * Desde el 2026-11-18 el cajón se ordena por CATEGORÍAS (orden del dueño):
 * Ventas, Finanzas y Configuración son grupos desplegables en acordeón
 * (uno abierto a la vez; el que contiene la ruta activa nace abierto) y
 * el resto de destinos quedan como entradas directas.
 */
export default function MainMenu({ items, isAuthenticated, displayName, initials }: MainMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const groupWithActiveRoute = (list: MainMenuItem[]): string | null => {
    for (const item of list) {
      if (isMenuGroup(item) && item.links.some(link => link.href === pathname)) {
        return item.label
      }
    }
    return null
  }

  const [openGroup, setOpenGroup] = useState<string | null>(() => groupWithActiveRoute(items))

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Si la ruta activa cae en un grupo, ese grupo nace abierto.
  useEffect(() => {
    const active = groupWithActiveRoute(items)
    if (active) setOpenGroup(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open ])

  const renderLink = (link: MainMenuLink, nested = false) => {
    const Icon = ICONS[link.icon]
    const active = pathname === link.href
    if (nested) {
      return (
        <Link
          key={`${link.label}-${link.href}`}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-11 items-center gap-2.5 py-2 pl-[52px] pr-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
            active
              ? 'bg-[#dee8ff] text-[#00357f]'
              : 'text-[#434653] hover:bg-[#f0f3ff] active:bg-[#dee8ff]/70 hover:text-[#00357f]'
          }`}
        >
          <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#00357f]' : 'text-[#00509e]'}`} />
          <span>{link.label}</span>
        </Link>
      )
    }
    return (
      <Link
        key={`${link.label}-${link.href}`}
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-12 items-center gap-3 border-b border-[#e7eeff] px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
          active
            ? 'bg-[#dee8ff] text-[#00357f]'
            : 'text-[#434653] hover:bg-[#f0f3ff] active:bg-[#dee8ff]/70 hover:text-[#00357f]'
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? 'bg-white text-[#00357f]' : 'bg-[#eef3ff] text-[#00509e]'}`}>
          <Icon className="h-5 w-5 shrink-0" />
        </span>
        <span>{link.label}</span>
      </Link>
    )
  }

  const renderGroup = (group: MainMenuGroup) => {
    const Icon = ICONS[group.icon]
    const expanded = openGroup === group.label
    const containsActive = group.links.some(link => link.href === pathname)
    return (
      <div key={`grupo-${group.label}`} className="border-b border-[#e7eeff]">
        <button
          type="button"
          onClick={() => setOpenGroup(expanded ? null : group.label)}
          aria-expanded={expanded}
          className={`flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
            containsActive
              ? 'text-[#00357f]'
              : 'text-[#434653] hover:bg-[#f0f3ff] hover:text-[#00357f]'
          }`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${containsActive ? 'bg-[#dee8ff] text-[#00357f]' : 'bg-[#eef3ff] text-[#00509e]'}`}>
            <Icon className="h-5 w-5 shrink-0" />
          </span>
          <span className="flex-1">{group.label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#5d606f] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="pb-1.5">
            {group.links.map(link => renderLink(link, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="menu-principal-movil"
        aria-label={open ? 'Cerrar menú principal' : 'Abrir menú principal'}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#c3c6d5] bg-white text-[#00357f] shadow-sm transition hover:bg-[#dee8ff]/50 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="menu-principal-movil"
          className="absolute inset-x-3 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#c3c6d5] bg-white shadow-[0_16px_40px_rgba(0,53,127,0.16)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="border-b border-[#e7eeff] bg-[#f9f9ff] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#5d606f]">Menú principal</p>
            <p className="mt-0.5 text-sm font-bold text-[#111c2d]">
              {isAuthenticated ? `Hola, ${displayName}` : 'Explora Óptica Rayo'}
            </p>
          </div>

          <nav aria-label="Navegación principal móvil" className="p-2">
            {items.map(item => (isMenuGroup(item) ? renderGroup(item) : renderLink(item)))}

            {isAuthenticated ? (
              <Link
                href="/profile"
                className="mt-1 flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#434653] transition hover:bg-[#f0f3ff] hover:text-[#00357f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d9e2ff] text-[10px] font-black text-[#00357f]">
                  {initials || 'OR'}
                </span>
                <span>Mi perfil</span>
                <UserRound className="ml-auto h-4 w-4 text-[#5d606f]" />
              </Link>
            ) : (
              <div className="mt-2 p-1 pt-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00357f] px-3 text-sm font-bold text-white transition hover:bg-[#00509e] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
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
