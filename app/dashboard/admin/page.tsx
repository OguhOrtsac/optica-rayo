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
import { 
  TrendingUp, 
  Wallet, 
  AlertTriangle, 
  Activity, 
  ArrowUp, 
  Plus, 
  UserPlus, 
  TrendingDown,
  ChevronRight,
  MessageSquare,
  Check,
  Bell,
  Clock
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

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Resumen General</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">Bienvenido, aquí está el estado de la óptica hoy.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Link 
            href="/dashboard/seller"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-3 bg-[#00357f] hover:bg-[#004aad] text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Venta
          </Link>
          <Link 
            href="/customers/new"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-3 border border-[#cbd5e1] bg-white hover:bg-[#dee8ff]/30 text-[#00357f] rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Sales Summary Bento Column (8 cols) */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Sales of the Day */}
            <div className="bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Ventas del Día</p>
                  <h2 className="text-3xl font-black text-[#111c2d] mt-2 font-mono">{formatPrice(todayStats.total)}</h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#49da9f]/10 flex items-center justify-center text-[#00422b]">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-1">
                {todayStats.diffPct >= 0 ? (
                  <span className="text-xs font-bold text-[#00422b] flex items-center gap-0.5">
                    <ArrowUp className="w-3.5 h-3.5" /> +{todayStats.diffPct}% vs ayer
                  </span>
                ) : (
                  <span className="text-xs font-bold text-[#ba1a1a] flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {todayStats.diffPct}% vs ayer
                  </span>
                )}
              </div>
            </div>

            {/* Sales of the Month */}
            <div className="bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#737784]">Ventas del Mes</p>
                  <h2 className="text-3xl font-black text-[#111c2d] mt-2 font-mono">{formatPrice(monthlyStats.total)}</h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#dee8ff] flex items-center justify-center text-[#00357f]">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-1">
                {monthlyStats.diffPct >= 0 ? (
                  <span className="text-xs font-bold text-[#00422b] flex items-center gap-0.5">
                    <ArrowUp className="w-3.5 h-3.5" /> +{monthlyStats.diffPct}% vs mes anterior
                  </span>
                ) : (
                  <span className="text-xs font-bold text-[#ba1a1a] flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {monthlyStats.diffPct}% vs mes anterior
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* Alerts / Cobranza Column (4 cols) */}
          <div className="md:col-span-4 bg-[#ffdad6] p-6 rounded-2xl border border-[#ffdad6]/40 shadow-sm flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
                <h3 className="text-sm font-extrabold text-[#93000a] uppercase tracking-wider">Cobranza Pendiente</h3>
              </div>
              
              <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                {pendingCollections.length === 0 ? (
                  <p className="text-xs text-[#93000a]/80 font-bold py-2">Sin adeudos pendientes hoy.</p>
                ) : (
                  pendingCollections.map(s => (
                    <div key={s.id} className="bg-white p-3 rounded-xl border border-[#cbd5e1]/45 flex justify-between items-center shadow-sm">
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-[#111c2d] truncate">{s.customer_name || 'Cliente'}</p>
                        <p className="text-[9px] text-[#737784] font-bold uppercase tracking-wider mt-0.5">
                          {s.payment_method === 'transfer' ? 'Transferencia' : s.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-[#ba1a1a] font-mono">{formatPrice(s.pending_balance)}</p>
                        <p className="text-[8px] text-[#ba1a1a] font-black uppercase tracking-widest mt-0.5">Adeudo</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Link 
              href="/dashboard/admin/customers"
              className="w-full py-2.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white text-center rounded-xl font-bold text-xs transition-colors shadow-sm block uppercase"
            >
              Ver todos los adeudos
            </Link>
          </div>

          {/* Notifications Panel (6 cols) */}
          <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#cbd5e1]/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-1.5">
                <Bell className="w-4 h-4" /> Alertas del Sistema
              </h3>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="bg-[#ba1a1a] text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
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
                        className="p-1 rounded bg-white hover:bg-[#dee8ff] border border-[#cbd5e1] text-[#00357f] hover:text-[#004aad] transition-colors cursor-pointer"
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
          <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#cbd5e1]/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Solicitudes de Lentes Armados
              </h3>
              {lensRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-[#00357f] text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
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
                          req.status === 'pending' ? 'bg-[#dee8ff] text-[#00357f]' : req.status === 'contacted' ? 'bg-amber-100 text-amber-800' : 'bg-[#e2f9ee] text-[#00422b]'
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
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold text-white transition-colors cursor-pointer ${
                              customerPhone ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 cursor-not-allowed'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Contactar por WhatsApp
                          </a>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'completed')}
                            className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] hover:bg-[#dee8ff]/30 text-[#00357f] text-[10px] font-bold transition-colors cursor-pointer"
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

          {/* Recent Activity Section (12 cols) */}
          <div className="md:col-span-12 bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#00357f] mb-4">Actividad Reciente</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#cbd5e1]/65 text-[#737784] font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Detalle</th>
                    <th className="py-3 px-4">Fecha/Hora</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-medium">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#737784] font-bold">Sin actividad registrada.</td>
                    </tr>
                  ) : (
                    sales.slice(0, 5).map(s => (
                      <tr key={s.id} className="border-b border-[#cbd5e1]/30 hover:bg-[#f9f9ff] transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#dee8ff] text-[#00357f] font-bold text-[10px]">
                            <Activity className="w-3 h-3" /> Venta
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#111c2d] font-bold">{s.customer_name || 'Cliente'}</td>
                        <td className="py-3.5 px-4 text-[#434653]">Venta registrada por {s.seller_name || 'Personal'}</td>
                        <td className="py-3.5 px-4 text-[#737784] text-xs font-mono">
                          {new Date(s.created_at).toLocaleDateString('es-MX')} {new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[#00357f] font-black font-mono">{formatPrice(s.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </main>
  )
}
