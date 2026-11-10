'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  getProducts,
  getSales,
  getLensRequests,
  updateLensRequestStatus,
  getDueReminders,
  searchCustomers,
  type DueReminder
} from '@/lib/services'
import { getProfileData } from '@/app/auth/actions'
import { isAdminRole } from '@/lib/roles'
import { Database } from '@/types/database.types'
import ReminderTray from '@/components/reminder-tray'
import RecentActivity from '@/components/recent-activity'
import {
  TrendingUp,
  Wallet,
  ArrowUp,
  Plus,
  UserPlus,
  TrendingDown,
  ChevronRight,
  MessageSquare,
  BellRing,
  CalendarDays,
  Cake,
  Glasses,
  Package,
  Users,
  ShieldCheck,
  LayoutGrid,
  DollarSign
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      .then(profile => setIsAdmin(isAdminRole(profile.role)))
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
  const upcomingBirthdays = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const result: { id: string; name: string; phone: string; dayLabel: string; daysUntil: number }[] = []
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
      result.push({
        id: c.id,
        name: c.full_name || 'Cliente',
        phone: c.customer_profiles?.phone || '',
        dayLabel: next.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
        daysUntil
      })
    }
    return result.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [customers])

  const quickAccess = [
    { label: 'Catálogo', href: '/catalog', icon: Glasses, chip: 'bg-[#dee8ff] text-[#00357f]' },
    { label: 'Productos', href: '/dashboard/admin/products', icon: Package, chip: 'bg-[#e6f5fb] text-[#0899c9]' },
    ...(isAdmin
      ? [{ label: 'Usuarios', href: '/dashboard/admin/users', icon: ShieldCheck, chip: 'bg-[#fef3c7] text-[#92400e]' }]
      : []),
    { label: 'Agenda', href: '/dashboard/appointments', icon: CalendarDays, chip: 'bg-[#e2f9ee] text-[#00422b]' },
    { label: 'Pagos', href: '/payments', icon: Wallet, chip: 'bg-[#ffdad6] text-[#ba1a1a]' },
    { label: 'Clientes', href: '/customers', icon: Users, chip: 'bg-[#dee8ff] text-[#00357f]' }
  ]

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-5">
        <div>
          <h1 className="text-2xl md:text-[28px] font-extrabold text-[#00357f] tracking-tight">Resumen General</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">Bienvenido, aquí está el estado de la óptica hoy.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Link
            href="/dashboard/seller"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-3 bg-[#00357f] hover:bg-[#004aad] text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Venta
          </Link>
          <Link
            href="/customers/new"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-3 border border-[#cbd5e1] bg-white hover:bg-[#dee8ff]/30 text-[#00357f] rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </Link>
          <Link
            href="/dashboard/appointments"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-3 border border-[#cbd5e1] bg-white hover:bg-[#dee8ff]/30 text-[#00357f] rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            Agenda
          </Link>
        </div>
      </div>

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

          {/* Tarjetas compactas: 2×2 en móvil, 4 en fila en escritorio */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Ventas hoy — azul */}
            <div className="anim-stagger-item bg-[#dee8ff] border border-[#00357f]/10 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#00357f] text-white flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </span>
                <p className="text-xs font-bold text-[#434653]">Ventas hoy</p>
              </div>
              <p className="text-2xl font-black font-mono text-[#111c2d] mt-2">{formatPrice(todayStats.total)}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#434653] flex items-center gap-1">
                {todayStats.diffPct >= 0 ? (
                  <><ArrowUp className="w-3 h-3 text-[#00422b]" /> +{todayStats.diffPct}% vs ayer</>
                ) : (
                  <><TrendingDown className="w-3 h-3 text-[#ba1a1a]" /> {todayStats.diffPct}% vs ayer</>
                )}
              </p>
            </div>

            {/* Ventas mes — celeste */}
            <div className="anim-stagger-item bg-[#e6f5fb] border border-[#0899c9]/15 rounded-2xl p-4 shadow-sm" style={{ '--enter-delay': '70ms' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#0899c9] text-white flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </span>
                <p className="text-xs font-bold text-[#434653]">Ventas mes</p>
              </div>
              <p className="text-2xl font-black font-mono text-[#111c2d] mt-2">{formatPrice(monthlyStats.total)}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#434653] flex items-center gap-1">
                {monthlyStats.diffPct >= 0 ? (
                  <><ArrowUp className="w-3 h-3 text-[#00422b]" /> +{monthlyStats.diffPct}% vs mes anterior</>
                ) : (
                  <><TrendingDown className="w-3 h-3 text-[#ba1a1a]" /> {monthlyStats.diffPct}% vs mes anterior</>
                )}
              </p>
            </div>

            {/* Promedio por venta (del mes) — azul pálido */}
            <div className="anim-stagger-item bg-white border border-[#cbd5e1] rounded-2xl p-4 shadow-sm" style={{ '--enter-delay': '140ms' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </span>
                <p className="text-xs font-bold text-[#434653]">Promedio por venta</p>
              </div>
              <p className="text-2xl font-black font-mono text-[#111c2d] mt-2">{formatPrice(monthlyStats.average)}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#737784]">
                {monthlyStats.count} venta{monthlyStats.count !== 1 ? 's' : ''} este mes
              </p>
            </div>

            {/* Por cobrar — enlace a Pagos; rojo suave si hay adeudo, verde si no */}
            <Link
              href="/payments"
              className={`anim-stagger-item block border rounded-2xl p-4 shadow-sm transition-all active:scale-[0.98] ${pendingTotal > 0 ? 'bg-[#ffdad6]/70 border-[#ba1a1a]/15' : 'bg-[#e2f9ee] border-[#00422b]/10'}`}
              style={{ '--enter-delay': '210ms' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2">
                <span className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 ${pendingTotal > 0 ? 'bg-[#ba1a1a]' : 'bg-emerald-600'}`}>
                  <Wallet className="w-4 h-4" />
                </span>
                <p className="text-xs font-bold text-[#434653]">Por cobrar</p>
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#737784] shrink-0" />
              </div>
              <p className={`text-2xl font-black font-mono mt-2 ${pendingTotal > 0 ? 'text-[#ba1a1a]' : 'text-[#00422b]'}`}>{formatPrice(pendingTotal)}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#434653]">
                {pendingTotal > 0 ? `${pendingCount} venta${pendingCount !== 1 ? 's' : ''} con saldo pendiente` : 'Todo cobrado, sin adeudos'}
              </p>
            </Link>

          </section>

          {/* Accesos rápidos en mosaico */}
          <section className="anim-stagger-item" style={{ '--enter-delay': '260ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Accesos rápidos</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {quickAccess.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="bg-white border border-[#cbd5e1] rounded-2xl p-3 shadow-sm flex flex-col items-center justify-center gap-2 min-h-[76px] transition-all active:scale-95"
                  >
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.chip}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold text-[#111c2d]">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* PRIORIDAD N.º 1 DEL DUEÑO: recordatorios de revisión — vender hoy
              y avisar a los 6 meses «ya es tiempo de tu nuevo examen».
              Va inmediatamente después de los accesos rápidos, con el
              contador de vencidos en rojo sobre la cabecera. */}
          <section className="anim-stagger-item space-y-3" style={{ '--enter-delay': '300ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3 px-1">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overdueCount > 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#dee8ff] text-[#00357f]'}`}>
                <BellRing className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#111c2d]">Recordatorios de revisión</h3>
                <p className={`text-xs font-semibold ${remindersError ? 'text-[#92400e]' : overdueCount > 0 ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
                  {remindersError
                    ? 'No se pudieron cargar los vencidos'
                    : overdueCount > 0
                      ? `${overdueCount} vencido${overdueCount !== 1 ? 's' : ''} · ${dueReminders.length} por atender`
                      : dueReminders.length > 0
                        ? `${dueReminders.length} por atender en los próximos 7 días`
                        : 'Sin vencimientos próximos'}
                </p>
              </div>
              {!remindersError && overdueCount > 0 && (
                <span className="ml-auto shrink-0 bg-[#ba1a1a] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {overdueCount} vencidos
                </span>
              )}
              {!remindersError && overdueCount === 0 && dueReminders.length > 0 && (
                <span className="ml-auto shrink-0 bg-[#dee8ff] text-[#00357f] text-xs font-bold px-2.5 py-1 rounded-full">
                  {dueReminders.length}
                </span>
              )}
            </div>
            <div className={overdueCount > 0 ? 'rounded-2xl ring-1 ring-[#ba1a1a]/25' : undefined}>
              <ReminderTray />
            </div>
          </section>

          {/* Solicitudes de lentes armados — compacta, filas en vez de tarjetas */}
          <div className="anim-stagger-item bg-white p-4 sm:p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left" style={{ '--enter-delay': '340ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-[#fef3c7] text-[#92400e] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Solicitudes de lentes armados</h3>
              {lensRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-auto shrink-0 bg-[#fef3c7] text-[#92400e] text-xs font-bold px-2.5 py-1 rounded-full">
                  {lensRequests.filter(r => r.status === 'pending').length} pendientes
                </span>
              )}
            </div>

            {lensRequests.length === 0 ? (
              <p className="text-xs text-[#737784] font-semibold py-6 text-center">Sin solicitudes de cotización.</p>
            ) : (
              <ul className="divide-y divide-[#cbd5e1]/30">
                {lensRequests.map(req => {
                  const customerPhone = req.customer_profiles?.phone || req.customer?.phone || ''
                  const customerName = req.customer?.full_name || 'Cliente'
                  const frameName = req.frame?.name || 'No seleccionado'
                  const materialName = req.lens_material?.name || 'No seleccionado'

                  // Construct pre-filled WhatsApp link
                  const cleanPhone = customerPhone.replace(/\D/g, '')
                  const waNumber = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`
                  const waMessage = encodeURIComponent(
                    `Hola *${customerName}*, recibimos tu diseño de lentes en el portal de *Optica Rayo* 🕶️.\n\n` +
                    `- Armazón: *${frameName}*\n` +
                    `- Mica: *${materialName}*\n` +
                    `${req.notes ? `- Notas: _"${req.notes}"_\n` : ''}\n` +
                    `¿Te gustaría que agendemos tu visita para confirmar la graduación y cerrar tu orden?`
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
            )}
          </div>

          {/* Cumpleaños próximos (7 días): felicitar también es vender */}
          <div className="anim-stagger-item bg-white p-4 sm:p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left" style={{ '--enter-delay': '380ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-[#e6f5fb] text-[#0899c9] flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Cumpleaños próximos</h3>
              {upcomingBirthdays.length > 0 && (
                <span className="ml-auto shrink-0 bg-[#e6f5fb] text-[#0899c9] text-xs font-bold px-2.5 py-1 rounded-full">
                  {upcomingBirthdays.length}
                </span>
              )}
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-[#737784] font-semibold py-3 text-center">Sin cumpleaños esta semana.</p>
            ) : (
              <ul className="divide-y divide-[#cbd5e1]/30">
                {upcomingBirthdays.map(b => {
                  const cleanPhone = b.phone.replace(/\D/g, '')
                  const waNumber = cleanPhone ? (cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`) : ''
                  const firstName = b.name.split(' ')[0] || b.name
                  const waMessage = encodeURIComponent(
                    `¡Hola ${firstName}! 🎂 En *Óptica Rayo* queremos desearte un muy feliz cumpleaños. ¡Que tengas un excelente día!`
                  )
                  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : '#'
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-3 min-h-[48px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111c2d] truncate">{b.name}</p>
                        <p className="text-xs text-[#737784] font-medium mt-0.5">
                          {b.daysUntil === 0 ? '¡Cumple hoy!' : b.daysUntil === 1 ? 'Mañana' : `En ${b.daysUntil} días`}
                        </p>
                      </div>
                      <span className="shrink-0 bg-[#e6f5fb] text-[#0899c9] text-xs font-bold px-2.5 py-1 rounded-full capitalize">
                        {b.dayLabel}
                      </span>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-bold text-white transition-all ${
                          waNumber ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer' : 'bg-emerald-600/50 cursor-not-allowed'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Felicitar
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Actividad reciente — al final */}
          <RecentActivity sales={sales} />

        </div>
      )}

    </main>
  )
}
