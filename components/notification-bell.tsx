'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Glasses,
  Info,
  Wallet,
} from 'lucide-react'
import { getMyNotifications, markNotificationRead } from '@/lib/services'
import { createClient as createBrowserClient } from '@/utils/supabase/client'

// Notification bell for the header (design system v2): staff alerts live
// here — with a red unread badge — instead of occupying the first screen
// of the admin panel. Same data source as the panel: the notifications
// table of the signed-in user via getMyNotifications() (fields: id,
// user_id, title, message, type, is_read, created_at; the record carries
// no link, so the destination is derived from `type`).
//
// Renders nothing for guests and customers.

type NotificationItem = {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

const STAFF_ROLES = ['seller', 'owner', 'super_admin', 'optometrist']
const PANEL_LIMIT = 8

const TYPE_CONFIG: Record<
  string,
  { label: string; href: string; chipBg: string; chipText: string; Icon: typeof Bell }
> = {
  payment_reminder: {
    label: 'Cobranza',
    href: '/payments',
    chipBg: 'bg-[#ffdad6]',
    chipText: 'text-[#ba1a1a]',
    Icon: Wallet,
  },
  appointment: {
    label: 'Cita',
    href: '/dashboard/appointments',
    chipBg: 'bg-[#e6f5fb]',
    chipText: 'text-[#0899c9]',
    Icon: CalendarDays,
  },
  lens_request: {
    label: 'Solicitud',
    href: '/dashboard/admin',
    chipBg: 'bg-[#fef3c7]',
    chipText: 'text-[#92400e]',
    Icon: Glasses,
  },
  general: {
    label: 'Aviso',
    href: '/dashboard/admin',
    chipBg: 'bg-[#dee8ff]',
    chipText: 'text-[#00357f]',
    Icon: Info,
  },
}

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.general
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMin = Math.floor((Date.now() - then) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

export default function NotificationBell({ role }: { role: string | null }) {
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const isStaff = !!role && STAFF_ROLES.includes(role)

  // Refresh on mount and on every route change (no polling).
  useEffect(() => {
    if (!isStaff) return
    let cancelled = false
    getMyNotifications()
      .then(data => {
        if (!cancelled) setNotifications((data ?? []) as NotificationItem[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isStaff, pathname])

  // Navigating (e.g. after tapping an item) closes the panel.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Close on outside click / Escape while open. (No fixed overlay: the
  // headers use backdrop-blur, which would trap a fixed layer inside
  // the header box.)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  if (!isStaff) return null

  const unreadCount = notifications.filter(n => !n.is_read).length
  const visible = notifications.slice(0, PANEL_LIMIT)

  const handleItemClick = (item: NotificationItem) => {
    if (!item.is_read) {
      // Optimistic: clear it locally; the service persists it and the
      // route change refetches anyway.
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
      )
      markNotificationRead(item.id).catch(() => {})
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    const unread = notifications.filter(n => !n.is_read)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      // No bulk service function exists: update the notifications table
      // directly with the browser client, scoped to the current user
      // (same scoping getMyNotifications uses).
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
      } else {
        // Mock mode (no Supabase session): per-item service calls.
        await Promise.all(unread.map(n => markNotificationRead(n.id)))
      }
    } catch {
      // The optimistic state stays; the next route change refetches.
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={unreadCount > 0 ? `Avisos, ${unreadCount} sin leer` : 'Avisos'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl transition hover:bg-[#dee8ff]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] cursor-pointer"
      >
        <Bell className="h-5 w-5 text-[#434653]" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ba1a1a] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-[72px] z-50 overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-[calc(100%+8px)] md:w-[360px]">
          <div className="flex items-center gap-2 border-b border-[#cbd5e1]/60 px-4 py-3">
            <h3 className="text-base font-semibold text-[#111c2d]">Avisos</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#ffdad6] px-2.5 py-0.5 text-xs font-bold text-[#ba1a1a]">
                {unreadCount} sin leer
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm font-medium text-[#737784]">
              Sin avisos por ahora.
            </p>
          ) : (
            <ul className="max-h-[55vh] divide-y divide-[#cbd5e1]/50 overflow-y-auto">
              {visible.map(n => {
                const cfg = typeConfig(n.type)
                const Icon = cfg.Icon
                return (
                  <li key={n.id}>
                    <Link
                      href={cfg.href}
                      onClick={() => handleItemClick(n)}
                      className={`flex min-h-12 items-start gap-3 px-4 py-3 transition hover:bg-[#dee8ff]/40 ${
                        n.is_read ? 'opacity-75' : 'bg-[#f0f3ff]'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.chipBg} ${cfg.chipText}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={`text-[11px] font-bold tracking-wide uppercase ${cfg.chipText}`}
                          >
                            {cfg.label}
                          </span>
                          <span className="shrink-0 text-[11px] font-medium text-[#737784]">
                            {relativeTime(n.created_at)}
                          </span>
                        </span>
                        <span className="block truncate text-sm font-semibold text-[#111c2d]">
                          {n.title}
                        </span>
                        <span className="line-clamp-2 block text-xs leading-relaxed font-medium text-[#434653]">
                          {n.message}
                        </span>
                      </span>
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ba1a1a]" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {unreadCount > 0 && (
            <div className="border-t border-[#cbd5e1]/60 p-2">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#00357f] transition hover:bg-[#dee8ff]/50 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar todas como leídas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
