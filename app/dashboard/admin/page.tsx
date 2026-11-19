'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ensureTodayAppointmentNotifications,
  getProducts,
  getSales,
  getLensRequests,
  updateLensRequestStatus,
  getDueReminders,
  searchCustomers,
  getBirthdayDismissals,
  dismissBirthday,
  getMessageTemplates,
  getMonthSales,
  getRecentExams,
  getRecentActivityEvents,
  logActivityEvent,
  type DueReminder,
  type MessageTemplates,
  type RecentExamActivity,
  type ActivityEventItem
} from '@/lib/services'
import { toWhatsAppNumber } from '@/lib/reminder-config'
import {
  buildBirthdayMessage,
  buildLensRequestReplyMessage,
  DEFAULT_BIRTHDAY_TEMPLATE,
  DEFAULT_LENS_REQUEST_REPLY_TEMPLATE
} from '@/lib/message-templates'
import { getProfileData } from '@/app/auth/actions'
import { isAdminRole } from '@/lib/roles'
import { ensureFixedPaymentNotifications } from '@/lib/expenses'
import { Database } from '@/types/database.types'
import ReminderTray from '@/components/reminder-tray'
import RecentActivity from '@/components/recent-activity'
import MonthSparkline from '@/components/sales-sparkline'
import {
  TrendingUp,
  Wallet,
  ArrowUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Trash2,
  BellRing,
  CalendarDays,
  Cake,
  Package,
  Users,
  ShieldCheck,
  Settings,
  Landmark,
  Receipt,
  PiggyBank
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

// Fecha local YYYY-MM-DD (sin corrimiento UTC) para comparar vencimientos.
const todayLocalISO = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string })[]>([])
  const [lensRequests, setLensRequests] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([])
  const [remindersError, setRemindersError] = useState(false)
  // Cumpleaños descartados («Eliminar»): llaves `customerId:año` de la
  // ocurrencia oculta. La fila solo sale cuando el servicio confirma el
  // guardado (patrón no optimista de la campanita).
  // Plantillas de mensajes de WhatsApp (fuente única en app_settings,
  // editables en Configuración → Mensajes): el «Felicitar» de cumpleaños
  // y la respuesta a solicitudes leen su texto de aquí, con el texto de
  // siempre como respaldo mientras cargan o si la lectura falla.
  const [msgTemplates, setMsgTemplates] = useState<MessageTemplates | null>(null)
  // Serie del mes en curso (días CON ventas, la misma de la pantalla
  // Finanzas → Ventas del mes) para la mini gráfica que vive DENTRO de
  // la mini tarjeta «Ventas del mes». Se carga aparte, sin bloquear el
  // panel; mientras carga o si falla, la mini gráfica muestra su línea
  // en cero.
  const [monthDays, setMonthDays] = useState<{ date: string; total: number }[]>([])
  // Fuentes extra de «Actividad reciente» (decisión del dueño,
  // 2026-11-18: la sección muestra TODA la actividad, no solo ventas):
  // exámenes nuevos y envíos registrados (recordatorios/felicitaciones).
  // Se cargan aparte y sin bloquear el panel; si una lectura falla, esa
  // fuente simplemente no aporta y la sección sigue con las demás.
  const [activityExams, setActivityExams] = useState<RecentExamActivity[]>([])
  const [activityEvents, setActivityEvents] = useState<ActivityEventItem[]>([])
  const [birthdayDismissals, setBirthdayDismissals] = useState<Set<string>>(new Set())
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [birthdayError, setBirthdayError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Secciones minimizables del panel: Recordatorios, Solicitudes y
  // Cumpleaños nacen minimizadas (orden del dueño); se expanden con clic.
  const [openSections, setOpenSections] = useState({ reminders: false, requests: false, birthdays: false })
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  const loadAllData = async () => {
    // Los recordatorios vencidos alimentan el contador en rojo de la
    // cabecera del bloque prioritario. Se cargan aparte y SIN bloquear el
    // panel: si la lectura falla se muestra el aviso en la cabecera, no se
    // inventa un conteo.
    getDueReminders()
      .then(reminders => {
        setDueReminders(reminders)
        setRemindersError(false)
      })
      .catch(() => setRemindersError(true))

    // Descartes de cumpleaños del ciclo: aparte y sin bloquear el panel;
    // si la lectura falla (p. ej. migración aún no aplicada) el servicio
    // ya degrada a «ninguno descartado» y la lista se ve como siempre.
    getBirthdayDismissals()
      .then(setBirthdayDismissals)
      .catch(() => {})

    // Plantillas de mensajes: aparte y sin bloquear el panel; si la
    // lectura falla, los botones usan el texto por defecto de siempre.
    getMessageTemplates()
      .then(setMsgTemplates)
      .catch(() => {})

    // Serie del mes para la mini gráfica de «Ventas del mes»: aparte y
    // sin bloquear el panel.
    const nowForMonth = new Date()
    getMonthSales(nowForMonth.getFullYear(), nowForMonth.getMonth() + 1)
      .then(detail => setMonthDays(detail.days))
      .catch(() => {})

    // Exámenes nuevos y envíos registrados para «Actividad reciente»:
    // aparte y sin bloquear el panel; los servicios ya degradan a []
    // si una lectura falla (p. ej. migración de activity_events aún
    // no aplicada), así que la sección simplemente sigue sin esa fuente.
    getRecentExams()
      .then(setActivityExams)
      .catch(() => {})
    getRecentActivityEvents()
      .then(setActivityEvents)
      .catch(() => {})

    try {
      setLoading(true)
      const [productsData, salesData, requestsData, customersData] = await Promise.all([
        getProducts(),
        getSales(),
        getLensRequests(),
        searchCustomers('')
      ])
      setProducts(productsData)
      setSales(salesData)
      setLensRequests(requestsData)
      setCustomers(customersData)
    } catch (e) {
      showFeedback('error', 'Error al cargar los datos del panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // El mosaico «Usuarios» solo existe para owner/super_admin (misma regla
  // que la navegación). El rol se lee del perfil; si falla, el mosaico
  // simplemente no aparece.
  useEffect(() => {
    getProfileData()
      .then(profile => {
        const admin = isAdminRole(profile.role)
        setIsAdmin(admin)
        // Aviso de pagos fijos por vencer/vencidos en la campanita: se
        // genera una sola vez al montar el panel (solo rol admin) y sin
        // bloquear el render; cualquier fallo es silencioso.
        if (admin) {
          ensureFixedPaymentNotifications().catch(() => {})
          // Avisos del día de las citas de HOY en la campanita (pedido
          // del dueño, 2026-11-19): mismo patrón ensure, sin bloquear
          // el render; la campanita también lo invoca al cargar.
          ensureTodayAppointmentNotifications().catch(() => {})
        }
      })
      .catch(() => setIsAdmin(false))
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  const handleUpdateStatus = async (id: string, status: 'pending' | 'contacted' | 'completed') => {
    const ok = await updateLensRequestStatus(id, status)
    if (ok) {
      showFeedback('success', 'Solicitud actualizada correctamente.')
      loadAllData()
    } else {
      showFeedback('error', 'No se pudo actualizar la solicitud.')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Calculate Today's Stats
  const todayStats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === todayStr)
    const total = todaySales.reduce((sum, s) => sum + s.total, 0)

    // Compare with yesterday
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
    const yesterdaySales = sales.filter(s => new Date(s.created_at).toDateString() === yesterdayStr)
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0)

    let dayDiffPct = 0
    if (yesterdayTotal > 0) {
      dayDiffPct = Math.round(((total - yesterdayTotal) / yesterdayTotal) * 100)
    }

    return {
      total,
      count: todaySales.length,
      diffPct: dayDiffPct
    }
  }, [sales])

  // Calculate Monthly Stats (+ promedio por venta del mes)
  const monthlyStats = useMemo(() => {
    const thisMonth = new Date().getMonth()
    const thisYear = new Date().getFullYear()
    const monthSales = sales.filter(s => {
      const d = new Date(s.created_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const total = monthSales.reduce((sum, s) => sum + s.total, 0)
    const count = monthSales.length
    const average = count > 0 ? total / count : 0

    // Compare with last month
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
    const lastMonthSales = sales.filter(s => {
      const d = new Date(s.created_at)
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
    })
    const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + s.total, 0)

    let monthDiffPct = 0
    if (lastMonthTotal > 0) {
      monthDiffPct = Math.round(((total - lastMonthTotal) / lastMonthTotal) * 100)
    }

    return {
      total,
      count,
      average,
      diffPct: monthDiffPct
    }
  }, [sales])

  // Total por cobrar: suma de todos los saldos pendientes de ventas.
  const pendingTotal = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)
  }, [sales])
  const pendingCount = useMemo(() => {
    return sales.filter(s => (s.pending_balance || 0) > 0).length
  }, [sales])

  // Recordatorios: vencidos = fecha sugerida anterior a hoy (la bandeja
  // incluye hoy + próximos 7 días).
  const overdueCount = useMemo(() => {
    const today = todayLocalISO()
    return dueReminders.filter(r => r.next_suggested_visit.slice(0, 10) < today).length
  }, [dueReminders])

  // Cumpleaños en los próximos 7 días (incluye hoy), desde
  // customer_profiles.date_of_birth de los clientes ya cargados.
  // occurrenceYear = año calendario de la ocurrencia mostrada (la
  // próxima): es la llave del descarte — descartarla NO oculta la del
  // año siguiente, que tiene otro año y reaparece sola.
  const upcomingBirthdays = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const result: { id: string; name: string; phone: string; dayLabel: string; daysUntil: number; occurrenceYear: number }[] = []
    for (const c of customers) {
      const dob: string | null = c.customer_profiles?.date_of_birth ?? null
      if (!dob) continue
      const parts = dob.split('T')[0].split('-').map(Number)
      if (parts.length !== 3 || !parts[1] || !parts[2]) continue
      let next = new Date(now.getFullYear(), parts[1] - 1, parts[2])
      if (next < startOfToday) {
        next = new Date(now.getFullYear() + 1, parts[1] - 1, parts[2])
      }
      const daysUntil = Math.round((next.getTime() - startOfToday.getTime()) / 86400000)
      if (daysUntil > 7) continue
      const occurrenceYear = next.getFullYear()
      if (birthdayDismissals.has(`${c.id}:${occurrenceYear}`)) continue
      result.push({
        id: c.id,
        name: c.full_name || 'Cliente',
        phone: c.customer_profiles?.phone || '',
        dayLabel: next.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
        daysUntil,
        occurrenceYear
      })
    }
    return result.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [customers, birthdayDismissals])

  // «Eliminar» de un cumpleaños: NO optimista — la fila sale solo cuando
  // el descarte quedó guardado; si falla, la fila se queda y se avisa.
  const handleDismissBirthday = async (b: { id: string; occurrenceYear: number }) => {
    if (dismissingId) return
    setDismissingId(b.id)
    setBirthdayError(null)
    try {
      const saved = await dismissBirthday(b.id, b.occurrenceYear)
      if (saved) {
        setBirthdayDismissals(prev => new Set(prev).add(`${b.id}:${b.occurrenceYear}`))
      } else {
        setBirthdayError('No se pudo quitar el cumpleaños. Inténtalo de nuevo.')
      }
    } catch {
      setBirthdayError('No se pudo quitar el cumpleaños. Inténtalo de nuevo.')
    } finally {
      setDismissingId(null)
    }
  }

  // «Configuración»: solo lo que se puede configurar (orden del dueño).
  // «Usuarios» y «Mensajes» solo existen para owner/super_admin (la página
  // de Mensajes es solo del administrador, como la de Usuarios).
  const quickAccess = [
    { label: 'Productos', href: '/dashboard/admin/products', icon: Package, chip: 'bg-[#e6f5fb] text-[#0899c9]' },
    ...(isAdmin
      ? [
          { label: 'Usuarios', href: '/dashboard/admin/users', icon: ShieldCheck, chip: 'bg-[#fef3c7] text-[#92400e]' },
          { label: 'Mensajes', href: '/dashboard/admin/mensajes', icon: MessageSquare, chip: 'bg-[#e2f9ee] text-[#00422b]' }
        ]
      : []),
    { label: 'Clientes', href: '/customers', icon: Users, chip: 'bg-[#dee8ff] text-[#00357f]' }
  ]

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
        }`}>
          {feedbackMsg.text}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs text-[#737784] font-bold">Recuperando información...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* FINANZAS: una sola tarjeta contenedora con mini tarjetas.
              Primera fila: Ventas hoy · Ventas del mes · Por cobrar.
              Segunda fila: Pagos · Utilidad del mes. */}
          <section className="anim-stagger-item bg-white rounded-[20px] or-shadow-card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </span>
              <h2 className="text-[17px] font-semibold text-[#111c2d]">Finanzas</h2>
            </div>

            {/* En móvil las mini tarjetas van como filas de ancho completo
                (icono a la izquierda; etiqueta, monto y comparación apilados):
                en 3 columnas los montos se cortaban contra el borde. En sm+
                vuelve la fila de 3 tarjetas verticales de siempre. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Ventas hoy — abre el detalle del día */}
              <Link
                href="/dashboard/admin/finanzas/hoy"
                className="bg-[#f9f9ff] hover:bg-[#eef3ff] rounded-[20px] p-3 transition-all active:scale-[0.98] flex items-center gap-3 sm:block"
              >
                <span className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-[#00357f] text-white flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </span>
                <span className="flex-1 min-w-0 sm:contents">
                  <p className="block text-[11px] font-bold text-[#434653] sm:mt-2">Ventas hoy</p>
                  <p className="block text-xl sm:text-2xl font-black tabular-nums whitespace-nowrap text-[#111c2d] mt-0.5">{formatPrice(todayStats.total)}</p>
                  <p className="mt-1 text-[10px] leading-tight font-semibold text-[#434653] flex items-center gap-1">
                    {todayStats.diffPct >= 0 ? (
                      <><ArrowUp className="w-3 h-3 text-[#00422b] shrink-0" /> +{todayStats.diffPct}% vs ayer</>
                    ) : (
                      <><TrendingDown className="w-3 h-3 text-[#ba1a1a] shrink-0" /> {todayStats.diffPct}% vs ayer</>
                    )}
                  </p>
                </span>
              </Link>

              {/* Ventas del mes — abre la gráfica y la tabla del mes.
                  Mini gráfica de línea a un ladito, DENTRO de la misma
                  tarjeta y sin hacerla más grande (corrección del dueño,
                  2026-11-18): en móvil va al final de la fila; en sm+ va
                  arriba a la derecha, junto al icono, en el espacio que
                  ya existía. Es solo la previa: la serie es la del mes
                  en curso (getMonthSales) y la tarjeta entera sigue
                  siendo el enlace al detalle del mes. */}
              <Link
                href="/dashboard/admin/finanzas/mes"
                className="bg-[#f9f9ff] hover:bg-[#eef3ff] rounded-[20px] p-3 transition-all active:scale-[0.98] flex items-center gap-3 sm:flex sm:flex-col sm:items-stretch sm:gap-0"
              >
                <span className="flex items-center justify-between shrink-0 sm:w-full">
                  <span className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-[#0899c9] text-white flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </span>
                  <span className="hidden sm:block w-20 h-6 shrink-0" aria-hidden="true">
                    <MonthSparkline days={monthDays} />
                  </span>
                </span>
                <span className="flex-1 min-w-0 sm:contents">
                  <p className="block text-[11px] font-bold text-[#434653] sm:mt-2">Ventas del mes</p>
                  <p className="block text-xl sm:text-2xl font-black tabular-nums whitespace-nowrap text-[#111c2d] mt-0.5">{formatPrice(monthlyStats.total)}</p>
                  <p className="mt-1 text-[10px] leading-tight font-semibold text-[#434653] flex items-center gap-1">
                    {monthlyStats.diffPct >= 0 ? (
                      <><ArrowUp className="w-3 h-3 text-[#00422b] shrink-0" /> +{monthlyStats.diffPct}% vs mes anterior</>
                    ) : (
                      <><TrendingDown className="w-3 h-3 text-[#ba1a1a] shrink-0" /> {monthlyStats.diffPct}% vs mes anterior</>
                    )}
                  </p>
                </span>
                <span className="sm:hidden w-14 h-6 shrink-0" aria-hidden="true">
                  <MonthSparkline days={monthDays} />
                </span>
              </Link>

              {/* Por cobrar — enlace a Pagos; semáforo: rojo suave si hay adeudo, verde si no */}
              <Link
                href="/payments"
                className={`rounded-[20px] p-3 transition-all active:scale-[0.98] flex items-center gap-3 sm:block ${pendingTotal > 0 ? 'bg-[#ffdad6]/60 hover:bg-[#ffdad6]/80' : 'bg-[#e2f9ee] hover:bg-[#d3f5e3]'}`}
              >
                <span className={`w-9 h-9 sm:w-7 sm:h-7 rounded-lg text-white flex items-center justify-center shrink-0 ${pendingTotal > 0 ? 'bg-[#ba1a1a]' : 'bg-[#00422b]'}`}>
                  <Wallet className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </span>
                <span className="flex-1 min-w-0 sm:contents">
                  <p className="block text-[11px] font-bold text-[#434653] sm:mt-2">Por cobrar</p>
                  <p className={`block text-xl sm:text-2xl font-black tabular-nums whitespace-nowrap mt-0.5 ${pendingTotal > 0 ? 'text-[#ba1a1a]' : 'text-[#00422b]'}`}>{formatPrice(pendingTotal)}</p>
                  <p className="mt-1 text-[10px] leading-tight font-semibold text-[#434653]">
                    {pendingTotal > 0 ? `${pendingCount} venta${pendingCount !== 1 ? 's' : ''} con saldo pendiente` : 'Todo cobrado, sin adeudos'}
                  </p>
                </span>
              </Link>
            </div>

            {/* Segunda fila: Pagos y Utilidad del mes */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
              <Link
                href="/dashboard/admin/finanzas/pagos"
                className="bg-[#f9f9ff] hover:bg-[#eef3ff] rounded-[20px] p-2.5 sm:p-3 transition-all active:scale-[0.98] flex items-center gap-2.5 min-h-[52px] min-w-0"
              >
                <span className="w-7 h-7 rounded-lg bg-[#fef3c7] text-[#92400e] flex items-center justify-center shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-[#111c2d] min-w-0">Pagos</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#737784] shrink-0" />
              </Link>
              <Link
                href="/dashboard/admin/finanzas/utilidad"
                className="bg-[#f9f9ff] hover:bg-[#eef3ff] rounded-[20px] p-2.5 sm:p-3 transition-all active:scale-[0.98] flex items-center gap-2.5 min-h-[52px] min-w-0"
              >
                <span className="w-7 h-7 rounded-lg bg-[#e2f9ee] text-[#00422b] flex items-center justify-center shrink-0">
                  <PiggyBank className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-[#111c2d] min-w-0">Utilidad del mes</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#737784] shrink-0" />
              </Link>
            </div>
          </section>

          {/* Configuración: Productos, Usuarios, Mensajes y Clientes.
              La sección completa vive dentro de una tarjeta blanca para
              que su contorno se vea sobre el fondo; los mosaicos internos
              usan el tono #f9f9ff para separarse del blanco de la tarjeta.
              Orden del dueño (2026-11-18): las CUATRO tarjetitas en UN
              solo renglón también en móvil — rejilla de 4 columnas en
              todos los anchos, con chip y etiqueta achicados para que
              ninguna palabra se corte a 360px. */}
          <section className="anim-stagger-item bg-white rounded-[20px] or-shadow-card p-4 sm:p-5" style={{ '--enter-delay': '60ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Configuración</h3>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
              {quickAccess.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="bg-[#f9f9ff] hover:bg-[#eef3ff] ring-1 ring-[#cbd5e1]/40 rounded-2xl sm:rounded-[20px] p-1.5 sm:p-3 flex flex-col items-center justify-center gap-1 sm:gap-2 min-h-[64px] sm:min-h-[76px] transition-all active:scale-95"
                  >
                    <span className={`w-[30px] h-[30px] sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${item.chip}`}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold leading-tight text-center text-[#111c2d]">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* PRIORIDAD N.º 1 DEL DUEÑO: recordatorios de revisión — vender hoy
              y avisar a los 6 meses «ya es tiempo de tu nuevo examen».
              Va inmediatamente después de Configuración, con el contador de
              vencidos en rojo sobre la cabecera; la sección nace minimizada. */}
          <section className="anim-stagger-item bg-white rounded-[20px] or-shadow-card p-4" style={{ '--enter-delay': '120ms' } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => toggleSection('reminders')}
              aria-expanded={openSections.reminders}
              className="w-full flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5 sm:h-[44px] sm:flex-nowrap sm:py-0 cursor-pointer text-left"
            >
              <span className={`max-sm:order-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${overdueCount > 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#dee8ff] text-[#00357f]'}`}>
                <BellRing className="w-4 h-4" />
              </span>
              <h3 className="max-sm:order-2 flex-1 min-w-0 truncate whitespace-nowrap text-sm font-semibold text-[#111c2d]">Recordatorios de revisión</h3>
              {/* Dictado del dueño (2026-11-18): en el celular el título se
                  cortaba («Recordat…») por compartir renglón con los dos
                  conteos; los conteos bajan a su propio renglón en móvil
                  (indentados bajo el título) y el título se ve completo.
                  En escritorio sobra ancho: todo en un renglón, como antes. */}
              {(remindersError || overdueCount > 0 || dueReminders.length > 0) && (
                <span className="flex items-center gap-1.5 max-sm:order-4 max-sm:w-full max-sm:pl-[42px]">
                  {remindersError ? (
                    <span className="min-w-0 truncate text-[11px] font-semibold text-[#92400e]">No se pudieron cargar los vencidos</span>
                  ) : (
                    <>
                      {overdueCount > 0 && (
                        <span className="shrink-0 whitespace-nowrap bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {overdueCount} vencido{overdueCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {dueReminders.length > 0 && (
                        <span className="shrink-0 whitespace-nowrap bg-[#fef3c7] text-[#92400e] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {dueReminders.length} por atender
                        </span>
                      )}
                    </>
                  )}
                </span>
              )}
              <ChevronDown className={`max-sm:order-3 w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${openSections.reminders ? 'rotate-180' : ''}`} />
            </button>
            {openSections.reminders && (
              <div className={`mt-4 ${overdueCount > 0 ? 'rounded-2xl ring-1 ring-[#ba1a1a]/25' : ''}`}>
                <ReminderTray />
              </div>
            )}
          </section>

          {/* Solicitudes de lentes armados — colapsable, nace minimizada */}
          <div className="anim-stagger-item bg-white p-4 rounded-[20px] or-shadow-card text-left" style={{ '--enter-delay': '180ms' } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => toggleSection('requests')}
              aria-expanded={openSections.requests}
              className="w-full h-[44px] flex items-center gap-2.5 cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-[#fef3c7] text-[#92400e] flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </span>
              <h3 className="flex-1 min-w-0 truncate whitespace-nowrap text-sm font-semibold text-[#111c2d]">Solicitudes de lentes armados</h3>
              {lensRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="shrink-0 whitespace-nowrap bg-[#dee8ff] text-[#00357f] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {lensRequests.filter(r => r.status === 'pending').length} pendientes
                </span>
              )}
              <ChevronDown className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${openSections.requests ? 'rotate-180' : ''}`} />
            </button>

            {openSections.requests && (lensRequests.length === 0 ? (
              <p className="text-xs text-[#737784] font-semibold py-6 text-center">Sin solicitudes de cotización.</p>
            ) : (
              <ul className="divide-y divide-[#cbd5e1]/30">
                {lensRequests.map(req => {
                  const customerPhone = req.customer_profiles?.phone || req.customer?.phone || ''
                  const customerName = req.customer?.full_name || 'Cliente'
                  const frameName = req.frame?.name || 'No seleccionado'
                  const materialName = req.lens_material?.name || 'No seleccionado'

                  // Construct pre-filled WhatsApp link. El texto sale de la
                  // plantilla editable (Configuración → Mensajes), con el
                  // texto de siempre como respaldo.
                  const cleanPhone = customerPhone.replace(/\D/g, '')
                  const waNumber = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`
                  const waMessage = encodeURIComponent(
                    buildLensRequestReplyMessage(
                      msgTemplates?.lensRequestReply ?? DEFAULT_LENS_REQUEST_REPLY_TEMPLATE,
                      {
                        nombre: customerName,
                        armazon: frameName,
                        mica: materialName,
                        notas: req.notes || ''
                      }
                    )
                  )
                  const waUrl = `https://wa.me/${waNumber}?text=${waMessage}`

                  return (
                    <li key={req.id} className={`py-3 min-h-[48px] ${req.status !== 'pending' ? 'opacity-75' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111c2d] truncate">{customerName}</p>
                          <p className="text-xs text-[#737784] font-medium truncate mt-0.5">
                            {frameName} · {materialName}{customerPhone ? ` · Tel: ${customerPhone}` : ''}
                          </p>
                          {req.notes && (
                            <p className="text-xs text-[#434653] italic truncate mt-0.5">“{req.notes}”</p>
                          )}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          req.status === 'pending' ? 'bg-[#fef3c7] text-[#92400e]' : req.status === 'contacted' ? 'bg-[#dee8ff] text-[#00357f]' : 'bg-[#e2f9ee] text-[#00422b]'
                        }`}>
                          {req.status === 'pending' ? 'Pendiente' : req.status === 'contacted' ? 'Contactado' : 'Completado'}
                        </span>
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <a
                            href={customerPhone ? waUrl : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleUpdateStatus(req.id, 'contacted')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold text-white transition-all active:scale-95 cursor-pointer ${
                              customerPhone ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 cursor-not-allowed'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Contactar por WhatsApp
                          </a>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'completed')}
                            className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] hover:bg-[#dee8ff]/30 text-[#00357f] text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                          >
                            Cerrar Orden
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ))}
          </div>

          {/* Cumpleaños próximos (7 días): felicitar también es vender */}
          <div className="anim-stagger-item bg-white p-4 rounded-[20px] or-shadow-card text-left" style={{ '--enter-delay': '240ms' } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => toggleSection('birthdays')}
              aria-expanded={openSections.birthdays}
              className="w-full h-[44px] flex items-center gap-2.5 cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-[#e6f5fb] text-[#0899c9] flex items-center justify-center shrink-0">
                <Cake className="w-4 h-4" />
              </span>
              <h3 className="flex-1 min-w-0 truncate whitespace-nowrap text-sm font-semibold text-[#111c2d]">Cumpleaños próximos</h3>
              {upcomingBirthdays.length > 0 && (
                <span className="shrink-0 whitespace-nowrap bg-[#dee8ff] text-[#00357f] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {upcomingBirthdays.length}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${openSections.birthdays ? 'rotate-180' : ''}`} />
            </button>

            {openSections.birthdays && (
              <>
                {birthdayError && (
                  <p className="mt-3 text-xs font-bold text-[#ba1a1a] bg-[#ffdad6]/60 border border-[#ba1a1a]/25 rounded-lg px-3 py-2">
                    {birthdayError}
                  </p>
                )}
                {upcomingBirthdays.length === 0 ? (
                  <p className="text-xs text-[#737784] font-semibold py-3 text-center">Sin cumpleaños esta semana.</p>
                ) : (
                  <ul className="divide-y divide-[#cbd5e1]/30">
                    {upcomingBirthdays.map(b => {
                      // Mismo mecanismo wa.me de la bandeja de recordatorios:
                      // número normalizado con toWhatsAppNumber y texto
                      // prellenado. Sin teléfono NO hay enlace: el botón va
                      // deshabilitado con el motivo en el título.
                      const waNumber = b.phone ? toWhatsAppNumber(b.phone) : null
                      const firstName = b.name.split(' ')[0] || b.name
                      // El texto sale de la plantilla editable
                      // (Configuración → Mensajes), con el texto de
                      // siempre como respaldo.
                      const waMessage = encodeURIComponent(
                        buildBirthdayMessage(
                          msgTemplates?.birthday ?? DEFAULT_BIRTHDAY_TEMPLATE,
                          { nombre: firstName }
                        )
                      )
                      const dismissing = dismissingId === b.id
                      return (
                        <li key={b.id} className="flex items-center gap-2 py-3 min-h-[48px]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#111c2d] truncate">{b.name}</p>
                            <p className="text-[11px] text-[#737784] font-medium mt-0.5">
                              {b.daysUntil === 0 ? '¡Cumple hoy!' : b.daysUntil === 1 ? 'Mañana' : `En ${b.daysUntil} días`}
                            </p>
                          </div>
                          <span className="shrink-0 bg-[#e6f5fb] text-[#0899c9] text-[11px] font-bold px-2 py-0.5 rounded-full capitalize">
                            {b.dayLabel}
                          </span>
                          {waNumber ? (
                            <a
                              href={`https://wa.me/${waNumber}?text=${waMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                // La felicitación queda asentada en
                                // «Actividad reciente» (activity_events)
                                // al tocar el botón; el registro es en
                                // segundo plano y NUNCA bloquea la
                                // apertura de WhatsApp.
                                void logActivityEvent('birthday_greeting', {
                                  customerId: b.id,
                                  description: `Felicitación de cumpleaños a ${b.name}`,
                                })
                              }}
                              className="shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Felicitar
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Este cliente no tiene teléfono registrado"
                              className="shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600/50 cursor-not-allowed"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Felicitar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDismissBirthday(b)}
                            disabled={!!dismissingId}
                            aria-label="Eliminar"
                            title="Eliminar"
                            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-[#ba1a1a] transition hover:bg-[#ffdad6]/60 disabled:opacity-60 cursor-pointer"
                          >
                            <Trash2 className={`w-4 h-4 ${dismissing ? 'animate-pulse opacity-60' : ''}`} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Actividad reciente — al final, nace minimizada igual que las
              demás secciones (corrección del dueño, 2026-11-18); el
              colapsable vive en el propio componente. Muestra TODA la
              actividad mezclada por fecha: ventas, exámenes nuevos,
              clientes nuevos (de los ya cargados) y envíos registrados */}
          <RecentActivity sales={sales} exams={activityExams} customers={customers} events={activityEvents} />

        </div>
      )}

    </main>
  )
}
