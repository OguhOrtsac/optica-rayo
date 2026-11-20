'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Coins,
  Eye,
  Glasses,
  History,
  Home,
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
  | 'trendingUp' | 'settings' | 'home' | 'exam' | 'orders'

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
  home: Home,
  exam: Eye,
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
  orders: ClipboardList,
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

// Color por tipo de destino (dictado del dueño, 2026-11-18: el menú «se
// veía muy sin vida»): cada grupo y cada entrada directa lleva su tono
// en el chip del icono — fondo suave (~12% del tono) e icono en el tono
// medio, paleta sobria. Las SUBENTRADAS heredan el color de su grupo
// (chip más chico), por eso el mapa solo manda en grupos y directas;
// los tonos de iconos que hoy solo viven como subentrada quedan como
// referencia de su familia por si algún día suben a entrada directa.
interface MenuColor {
  bg: string
  fg: string
}

const ICON_COLORS: Record<MainMenuIcon, MenuColor> = {
  home: { bg: '#dee8ff', fg: '#00357f' }, // Inicio: azul de marca
  exam: { bg: '#e6f7fb', fg: '#0899c9' }, // Realizar examen: cian de acento (familia Agenda)
  catalog: { bg: '#e0f2fe', fg: '#0284c7' }, // Catálogo: celeste
  agenda: { bg: '#e6f7fb', fg: '#0899c9' }, // Agenda: cian de acento
  agendar: { bg: '#e6f7fb', fg: '#0899c9' }, // Agendar: cian de acento
  store: { bg: '#d1fae5', fg: '#047857' }, // Grupo Ventas: verde esmeralda
  wallet: { bg: '#ede9fe', fg: '#6d28d9' }, // Grupo Finanzas: violeta
  settings: { bg: '#dee8ff', fg: '#00357f' }, // Grupo Configuración: azul de marca
  promotions: { bg: '#fef3c7', fg: '#b45309' }, // Promociones: ámbar
  expenses: { bg: '#ffe4e6', fg: '#be123c' }, // Gastos: rosa/rojo suave
  reports: { bg: '#e0e7ff', fg: '#4338ca' }, // Reportes: índigo
  pos: { bg: '#d1fae5', fg: '#047857' },
  history: { bg: '#d1fae5', fg: '#047857' },
  orders: { bg: '#d1fae5', fg: '#047857' },
  coins: { bg: '#ede9fe', fg: '#6d28d9' },
  calendarRange: { bg: '#ede9fe', fg: '#6d28d9' },
  calendarClock: { bg: '#ede9fe', fg: '#6d28d9' },
  trendingUp: { bg: '#ede9fe', fg: '#6d28d9' },
  products: { bg: '#dee8ff', fg: '#00357f' },
  users: { bg: '#dee8ff', fg: '#00357f' },
  clients: { bg: '#dee8ff', fg: '#00357f' },
  messages: { bg: '#dee8ff', fg: '#00357f' },
}

// «Mi perfil»: neutro cálido, distinto de los tonos de trabajo.
const PROFILE_COLOR: MenuColor = { bg: '#efe7da', fg: '#6f6152' }

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
 * el resto de destinos quedan como entradas directas. El mismo día el
 * dueño pidió COLOR por tipo en los chips y un cajón MÁS PEQUEÑO: el
 * menú es un cajón lateral de `min(84vw, 320px)` sobre fondo oscurecido
 * que se cierra al tocar fuera (además de la X, Escape y al navegar).
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

  // Con el cajón abierto, la página de atrás no se mueve.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open ])

  // `color` es el tono del chip en entradas directas (el de su propio
  // icono) y el del panel/encabezado en los grupos. En la entrada
  // directa activa la pastilla de marca manda en el renglón y el chip
  // pasa a blanco, conservando su icono en su color. Las SUBENTRADAS
  // ya no usan `color` para su letra ni su icono: van en negro
  // (#111c2d) por dictado del dueño (2026-11-19, ver la rama nested).
  const renderLink = (link: MainMenuLink, color: MenuColor, nested = false) => {
    const Icon = ICONS[link.icon]
    const active = pathname === link.href
    if (nested) {
      // El panel del grupo expandido conserva el tinte suave de su
      // grupo (dictado 2026-11-18, ver renderGroup), pero la LETRA y
      // el ICONO de cada subentrada van en NEGRO — el texto principal
      // de la app, #111c2d — también en la activa (dictado del dueño,
      // 2026-11-19: con todo en el color fuerte del grupo «se pierde
      // todo en el mismo color»). La activa se sigue distinguiendo
      // por su pastilla blanca con sombra.
      return (
        <Link
          key={`${link.label}-${link.href}`}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          style={{ color: '#111c2d' }}
          className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
            active ? 'bg-white shadow-sm' : 'hover:bg-white/60 active:bg-white/80'
          }`}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: active ? '#ffffff' : 'rgba(255,255,255,0.65)', color: '#111c2d' }}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </span>
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
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: active ? '#ffffff' : color.bg, color: color.fg }}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </span>
        <span>{link.label}</span>
      </Link>
    )
  }

  const renderGroup = (group: MainMenuGroup) => {
    const Icon = ICONS[group.icon]
    const color = ICON_COLORS[group.icon]
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
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: color.bg, color: color.fg }}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </span>
          <span className="flex-1">{group.label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#5d606f] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div
            className="mx-2 mb-2 space-y-0.5 rounded-2xl p-1.5"
            style={{ backgroundColor: color.bg }}
          >
            {group.links.map(link => renderLink(link, color, true))}
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

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] md:hidden">
            {/* Fondo oscurecido: tocarlo cierra el cajón. El panel va en
                un portal para que el oscurecido cubra también la barra
                inferior, que vive fuera del encabezado. */}
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
            />
            <div
              id="menu-principal-movil"
              role="dialog"
              aria-modal="true"
              aria-label="Menú principal"
              className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col overflow-hidden rounded-r-3xl bg-white shadow-[16px_0_40px_rgba(0,20,50,0.28)] animate-in slide-in-from-left duration-200"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#e7eeff] bg-[#f9f9ff] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#5d606f]">Menú principal</p>
                  <p className="mt-0.5 text-sm font-bold text-[#111c2d]">
                    {isAuthenticated ? `Hola, ${displayName}` : 'Explora Óptica Rayo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú principal"
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[#00357f] transition hover:bg-[#dee8ff]/60 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Navegación principal móvil" className="flex-1 overflow-y-auto p-2">
                {items.map(item => (isMenuGroup(item) ? renderGroup(item) : renderLink(item, ICON_COLORS[item.icon])))}

                {isAuthenticated ? (
                  <Link
                    href="/profile"
                    className="mt-1 flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#434653] transition hover:bg-[#f0f3ff] hover:text-[#00357f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                      style={{ backgroundColor: PROFILE_COLOR.bg, color: PROFILE_COLOR.fg }}
                    >
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
          </div>,
          document.body,
        )}
    </div>
  )
}
