'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  getProducts, 
  getSales, 
  getLensRequests, 
  updateLensRequestStatus, 
  getMyNotifications, 
  markNotificationRead 
} from '@/lib/services'
import { Database } from '@/types/database.types'
import ReminderTray from '@/components/reminder-tray'
import RecentActivity from '@/components/recent-activity'
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  ArrowUp,
  Plus, 
  UserPlus, 
  TrendingDown,
  ChevronRight,
  MessageSquare,
  Check,
  Bell,
  Clock,
  CalendarDays
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string })[]>([])
  const [lensRequests, setLensRequests] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [productsData, salesData, requestsData, notificationsData] = await Promise.all([
        getProducts(),
        getSales(),
        getLensRequests(),
        getMyNotifications()
      ])
      setProducts(productsData)
      setSales(salesData)
      setLensRequests(requestsData)
      setNotifications(notificationsData)
    } catch (e) {
      showFeedback('error', 'Error al cargar los datos del panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
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

  const handleMarkNotificationRead = async (id: string) => {
    const ok = await markNotificationRead(id)
    if (ok) {
      loadAllData()
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

  // Calculate Monthly Stats
  const monthlyStats = useMemo(() => {
    const thisMonth = new Date().getMonth()
    const thisYear = new Date().getFullYear()
    const monthSales = sales.filter(s => {
      const d = new Date(s.created_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const total = monthSales.reduce((sum, s) => sum + s.total, 0)
    
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
      diffPct: monthDiffPct
    }
  }, [sales])

  // Get Pending Balances
  const pendingCollections = useMemo(() => {
    return sales
      .filter(s => (s.pending_balance !== undefined ? s.pending_balance : 0) > 0)
      .slice(0, 5)
  }, [sales])

  // Total por cobrar: suma de todos los saldos pendientes (la lista de
  // Cobranza solo muestra los primeros 5; la cifra es sobre el total).
  const pendingTotal = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)
  }, [sales])
  const pendingCount = useMemo(() => {
    return sales.filter(s => (s.pending_balance || 0) > 0).length
  }, [sales])

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

          {/* Fila de cifras: superficie teñida e icono en pastilla de color */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Ventas de hoy — azul */}
            <div className="anim-stagger-item bg-[#dee8ff] border border-[#00357f]/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111c2d]">Ventas de hoy</p>
                  <p className="text-3xl font-black font-mono text-[#111c2d] mt-2">{formatPrice(todayStats.total)}</p>
                </div>
                <span className="w-11 h-11 rounded-2xl bg-[#00357f] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <TrendingUp className="w-5 h-5" />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#434653] flex items-center gap-1">
                {todayStats.diffPct >= 0 ? (
                  <><ArrowUp className="w-3.5 h-3.5 text-[#00422b]" /> +{todayStats.diffPct}% vs ayer</>
                ) : (
                  <><TrendingDown className="w-3.5 h-3.5 text-[#ba1a1a]" /> {todayStats.diffPct}% vs ayer</>
                )}
              </p>
            </div>

            {/* Ventas del mes — celeste */}
            <div className="anim-stagger-item bg-[#e6f5fb] border border-[#0899c9]/15 rounded-2xl p-5 shadow-sm" style={{ '--enter-delay': '70ms' } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111c2d]">Ventas del mes</p>
                  <p className="text-3xl font-black font-mono text-[#111c2d] mt-2">{formatPrice(monthlyStats.total)}</p>
                </div>
                <span className="w-11 h-11 rounded-2xl bg-[#0899c9] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CalendarDays className="w-5 h-5" />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#434653] flex items-center gap-1">
                {monthlyStats.diffPct >= 0 ? (
                  <><ArrowUp className="w-3.5 h-3.5 text-[#00422b]" /> +{monthlyStats.diffPct}% vs mes anterior</>
                ) : (
                  <><TrendingDown className="w-3.5 h-3.5 text-[#ba1a1a]" /> {monthlyStats.diffPct}% vs mes anterior</>
                )}
              </p>
            </div>

            {/* Por cobrar — rojo suave si hay adeudo, verde si está todo cobrado */}
            <div className={`anim-stagger-item border rounded-2xl p-5 shadow-sm ${pendingTotal > 0 ? 'bg-[#ffdad6]/70 border-[#ba1a1a]/15' : 'bg-[#e2f9ee] border-[#00422b]/10'}`} style={{ '--enter-delay': '140ms' } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111c2d]">Por cobrar</p>
                  <p className={`text-3xl font-black font-mono mt-2 ${pendingTotal > 0 ? 'text-[#ba1a1a]' : 'text-[#00422b]'}`}>{formatPrice(pendingTotal)}</p>
                </div>
                <span className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm ${pendingTotal > 0 ? 'bg-[#ba1a1a]' : 'bg-emerald-600'}`}>
                  <Wallet className="w-5 h-5" />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#434653]">
                {pendingTotal > 0 ? `${pendingCount} venta${pendingCount !== 1 ? 's' : ''} con saldo pendiente` : 'Todo cobrado, sin adeudos'}
              </p>
            </div>

          </section>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Cobranza Pendiente (5 cols) */}
          <div className="anim-stagger-item md:col-span-12 lg:col-span-5 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left flex flex-col gap-4" style={{ '--enter-delay': '180ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Cobranza pendiente</h3>
              {pendingCount > 0 && (
                <span className="ml-auto shrink-0 bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold px-2.5 py-1 rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>

            {pendingCollections.length === 0 ? (
              <p className="text-sm text-[#434653] font-medium py-2">Sin adeudos pendientes hoy.</p>
            ) : (
              <ul className="divide-y divide-[#cbd5e1]/30">
                {pendingCollections.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3 min-h-[48px]">
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-[#111c2d] truncate">{s.customer_name || 'Cliente'}</p>
                      <p className="text-xs text-[#434653] font-medium mt-0.5">
                        {s.payment_method === 'transfer' ? 'Transferencia' : s.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-[#ba1a1a] font-mono">{formatPrice(s.pending_balance)}</p>
                      <p className="text-[10px] text-[#ba1a1a] font-bold uppercase tracking-wider mt-0.5">Adeudo</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/customers"
              className="mt-auto w-full py-2.5 border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ffdad6]/50 text-center rounded-xl font-bold text-xs transition-all active:scale-[0.98] block"
            >
              Ver todos los adeudos
            </Link>
          </div>

          {/* Notifications Panel (6 cols) */}
          <div className="anim-stagger-item md:col-span-12 lg:col-span-7 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left flex flex-col gap-4" style={{ '--enter-delay': '220ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </span>
              <h3 className="text-base font-semibold text-[#111c2d]">Alertas del sistema</h3>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="ml-auto shrink-0 bg-[#ba1a1a] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {notifications.filter(n => !n.is_read).length} nuevas
                </span>
              )}
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {notifications.length === 0 ? (
                <p className="text-xs text-[#737784] font-semibold py-6 text-center">Sin notificaciones pendientes.</p>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-3 rounded-xl border transition-all text-xs flex justify-between items-start gap-3 ${
                      n.is_read ? 'bg-white border-[#cbd5e1]/40 opacity-70' : 'bg-[#f0f3ff] border-[#b0c6ff]/45 shadow-sm'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        {n.type === 'payment_reminder' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#ba1a1a]" />
                        ) : (
                          <Bell className="w-3.5 h-3.5 text-[#00357f]" />
                        )}
                        <span className="font-bold text-[#111c2d]">{n.title}</span>
                      </div>
                      <p className="text-[11px] text-[#434653] font-medium leading-relaxed">{n.message}</p>
                      <p className="text-[9px] text-[#737784] font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(n.created_at).toLocaleDateString('es-MX')} {new Date(n.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <button 
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className="p-1 rounded bg-white hover:bg-[#dee8ff] border border-[#cbd5e1] text-[#00357f] hover:text-[#004aad] transition-all active:scale-90 cursor-pointer"
                        title="Marcar como leído"
                      >
                        <Check className="w-3.5 h-3.5 font-bold" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Lens Builder Requests Panel (6 cols) */}
          <div className="anim-stagger-item md:col-span-12 lg:col-span-7 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left flex flex-col gap-4" style={{ '--enter-delay': '260ms' } as React.CSSProperties}>
            <div className="flex items-center gap-3">
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

            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {lensRequests.length === 0 ? (
                <p className="text-xs text-[#737784] font-semibold py-6 text-center">Sin solicitudes de cotización.</p>
              ) : (
                lensRequests.map(req => {
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
                    <div 
                      key={req.id} 
                      className={`p-3 rounded-xl border transition-all text-xs space-y-2.5 ${
                        req.status === 'pending' ? 'bg-[#f0f3ff] border-[#b0c6ff]/45 shadow-sm' : 'bg-white border-[#cbd5e1]/40 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#111c2d]">{customerName}</p>
                          <span className="text-[9px] text-[#737784] font-mono">Tel: {customerPhone || 'Sin teléfono'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          req.status === 'pending' ? 'bg-[#fef3c7] text-[#92400e]' : req.status === 'contacted' ? 'bg-[#dee8ff] text-[#00357f]' : 'bg-[#e2f9ee] text-[#00422b]'
                        }`}>
                          {req.status === 'pending' ? 'Pendiente' : req.status === 'contacted' ? 'Contactado' : 'Completado'}
                        </span>
                      </div>

                      <div className="bg-white border border-[#cbd5e1]/20 p-2 rounded-lg text-[10px] space-y-1">
                        <p className="text-[#434653]"><strong className="text-[#111c2d]">Armazón:</strong> {frameName}</p>
                        <p className="text-[#434653]"><strong className="text-[#111c2d]">Mica:</strong> {materialName}</p>
                        {req.notes && (
                          <p className="text-[#434653] italic"><strong className="text-[#111c2d] not-italic">Notas:</strong> "{req.notes}"</p>
                        )}
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex gap-2">
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
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Exam Review Reminders (12 cols) */}
          <div className="anim-stagger-item md:col-span-12 lg:col-span-5" style={{ '--enter-delay': '300ms' } as React.CSSProperties}>
            <ReminderTray />
          </div>

          {/* Recent Activity Section (12 cols) — tabla extraída a components/recent-activity.tsx */}
          <RecentActivity sales={sales} />

          </div>
        </div>
      )}

    </main>
  )
}
