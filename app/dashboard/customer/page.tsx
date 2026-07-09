'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { logout } from '@/app/auth/actions'
import { 
  getCoupons, 
  getMyLatestExam, 
  getMySales, 
  getMyReminder,
  getCustomerInstallments,
  getMyNotifications,
  markNotificationRead,
  getProducts,
  getLensMaterials,
  getLensTreatments,
  createLensRequest
} from '@/lib/services'
import { getMySalesAction } from '@/app/customers/actions'
import { Database } from '@/types/database.types'
import { 
  User, 
  LogOut, 
  ChevronDown, 
  Eye, 
  Wallet, 
  Receipt, 
  Info, 
  Check, 
  X, 
  Edit3, 
  PlusCircle,
  Bell,
  Sliders,
  Calendar,
  AlertTriangle,
  Clock
} from 'lucide-react'

type Coupon = Database['public']['Tables']['coupons']['Row']

export default function CustomerDashboard() {
  const [userId, setUserId] = useState<string>('')
  const [fullName, setFullName] = useState('Cliente')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [latestExam, setLatestExam] = useState<any | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [reminder, setReminder] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Installments and Notifications
  const [installments, setInstallments] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false)

  // Builder States
  const [frames, setFrames] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<string[]>([])
  const [lensNotes, setLensNotes] = useState('')
  const [isSubmittingLensRequest, setIsSubmittingLensRequest] = useState(false)
  const [builderFeedback, setBuilderFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Accordion open state ('exam' | 'payments' | 'history' | 'builder' | null)
  const [openAccordion, setOpenAccordion] = useState<'exam' | 'payments' | 'history' | 'builder' | null>('exam')

  // Selected sale for receipt modal details
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null)

  // Editable glasses nickname states
  const [glassesNickname, setGlassesNickname] = useState('Mis lentes actuales')
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          setFullName(user.user_metadata?.full_name || 'Cliente')
          
          // Load local glasses nickname for this user
          const savedNickname = localStorage.getItem(`glasses_nickname_${user.id}`)
          if (savedNickname) {
            setGlassesNickname(savedNickname)
          }
        }

        const [
          couponsData, 
          examData, 
          salesData, 
          reminderData, 
          installmentsData, 
          notificationsData,
          productsData,
          materialsData,
          treatmentsData
        ] = await Promise.all([
          getCoupons(),
          getMyLatestExam(),
          getMySalesAction(),
          getMyReminder(),
          getCustomerInstallments(user?.id),
          getMyNotifications(),
          getProducts(),
          getLensMaterials(),
          getLensTreatments()
        ])

        setCoupons(couponsData)
        setLatestExam(examData)
        setSales(salesData)
        setReminder(reminderData)
        setInstallments(installmentsData)
        setNotifications(notificationsData)
        setFrames(productsData.filter((p: any) => p.category === 'frames'))
        setMaterials(materialsData)
        setTreatments(treatmentsData)
      } catch (err) {
        console.error('Error loading customer dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  // Handle Nickname Save
  const handleSaveNickname = () => {
    const trimmed = nicknameInput.trim()
    if (trimmed) {
      setGlassesNickname(trimmed)
      if (userId) {
        localStorage.setItem(`glasses_nickname_${userId}`, trimmed)
      }
    }
    setIsEditingNickname(false)
  }

  const handleSubmitLensRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFrameId) {
      setBuilderFeedback({ type: 'error', text: 'Por favor selecciona un armazón.' })
      return
    }
    try {
      setIsSubmittingLensRequest(true)
      setBuilderFeedback(null)
      const res = await createLensRequest({
        frameId: selectedFrameId,
        lensMaterialId: selectedMaterialId || undefined,
        treatmentIds: selectedTreatmentIds,
        notes: lensNotes
      })
      if (res) {
        setBuilderFeedback({ type: 'success', text: '¡Solicitud enviada con éxito! Nos comunicaremos contigo pronto.' })
        // Clear form
        setSelectedFrameId('')
        setSelectedMaterialId('')
        setSelectedTreatmentIds([])
        setLensNotes('')
        
        // Refresh notifications
        const notifs = await getMyNotifications()
        setNotifications(notifs)
      } else {
        setBuilderFeedback({ type: 'error', text: 'No se pudo enviar la solicitud.' })
      }
    } catch (e: any) {
      setBuilderFeedback({ type: 'error', text: e.message || 'Error al procesar la solicitud.' })
    } finally {
      setIsSubmittingLensRequest(false)
    }
  }

  const handleMarkNotificationRead = async (id: string) => {
    await markNotificationRead(id)
    const notifs = await getMyNotifications()
    setNotifications(notifs)
  }

  const handleTreatmentToggle = (tId: string, checked: boolean) => {
    if (checked) {
      setSelectedTreatmentIds(prev => [...prev, tId])
    } else {
      setSelectedTreatmentIds(prev => prev.filter(id => id !== tId))
    }
  }

  // Mathematics for payments
  const totalPurchased = useMemo(() => sales.reduce((sum, s) => sum + (s.total || 0), 0), [sales])
  const totalPaid = useMemo(() => sales.reduce((sum, s) => sum + (s.paid_amount || 0), 0), [sales])
  const pendingBalance = useMemo(() => sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0), [sales])
  const paymentProgressPercent = totalPurchased > 0 ? Math.round((totalPaid / totalPurchased) * 100) : 100

  // Format currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f9f9ff] text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-sm text-[#737784] font-medium">Cargando tu panel de salud...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Profile Overview Card (Glassmorphism design) */}
      <section className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 relative overflow-hidden">
        {/* Decorative subtle background gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#dee8ff] rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 z-10 w-full text-center sm:text-left">
          <div className="w-16 h-16 rounded-full bg-[#dee8ff] border border-[#cbd5e1] flex items-center justify-center font-black text-xl text-[#00357f] shrink-0">
            {fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 mt-1 space-y-1">
            <h1 className="text-xl font-extrabold text-[#111c2d]">{fullName}</h1>
            <p className="text-xs text-[#737784] font-semibold">
              ID Cliente: #{userId.slice(0, 6).toUpperCase()}
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dee8ff]/80 text-[#00357f] text-[9px] font-black uppercase tracking-wider border border-[#cbd5e1]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00357f] animate-pulse" />
                Cliente Activo
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 sm:mt-0 z-10 shrink-0">
          {/* Notification Bell Dropdown */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen)}
              className="relative p-2.5 rounded-xl border border-[#cbd5e1] hover:bg-[#dee8ff]/30 text-[#00357f] transition-all flex items-center justify-center cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ba1a1a] text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
            
            {isNotificationsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#cbd5e1] rounded-2xl shadow-xl p-4 space-y-3 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider border-b border-[#cbd5e1]/40 pb-2 flex items-center justify-between">
                  <span>Notificaciones</span>
                  <button 
                    onClick={() => setIsNotificationsDropdownOpen(false)}
                    className="text-[8px] text-[#737784] font-bold hover:underline"
                  >
                    Cerrar
                  </button>
                </h4>
                
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-[#737784] font-semibold text-center py-4">Sin notificaciones.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-2.5 rounded-lg border text-[10px] space-y-1 relative group transition-colors ${
                          n.is_read ? 'bg-white border-[#cbd5e1]/30 opacity-70' : 'bg-[#f0f3ff] border-[#b0c6ff]/45'
                        }`}
                      >
                        <p className="font-bold text-[#111c2d] pr-4">{n.title}</p>
                        <p className="text-[#434653] font-medium leading-relaxed">{n.message}</p>
                        {!n.is_read && (
                          <button 
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className="absolute right-1 top-1 text-[#00357f] hover:text-[#004aad] p-0.5 rounded cursor-pointer"
                            title="Marcar leído"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <form action={logout}>
            <button 
              type="submit"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a] transition-all text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </section>

      {/* Editable Glasses Nickname Section ("Lentes Actuales") */}
      <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 pt-0.5 text-left">
            <p className="text-[9px] font-black uppercase text-[#737784] tracking-wider mb-1">Mi Dispositivo Visual</p>
            
            {/* View State */}
            {!isEditingNickname ? (
              <div className="flex items-center gap-2 group">
                <h2 className="text-sm font-bold text-[#111c2d] truncate">{glassesNickname}</h2>
                <button 
                  onClick={() => {
                    setNicknameInput(glassesNickname)
                    setIsEditingNickname(true)
                  }}
                  className="p-1 rounded hover:bg-[#f0f3ff] text-[#737784] hover:text-[#00357f] transition-colors cursor-pointer"
                  title="Editar nombre"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Edit State */
              <div className="flex items-center gap-2 mt-1">
                <input 
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNickname()
                    if (e.key === 'Escape') setIsEditingNickname(false)
                  }}
                  className="flex-1 bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="text"
                  autoFocus
                />
                <button 
                  onClick={handleSaveNickname}
                  className="w-7 h-7 bg-[#00357f] text-white rounded-lg flex items-center justify-center hover:bg-[#004aad] transition-colors shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsEditingNickname(false)}
                  className="w-7 h-7 border border-[#cbd5e1] text-[#737784] rounded-lg flex items-center justify-center hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Accordions Container */}
      <div className="space-y-4">
        
        {/* Accordion 1: Último Examen */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <button 
            onClick={() => setOpenAccordion(openAccordion === 'exam' ? null : 'exam')}
            className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Eye className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#111c2d]">Último Examen de la Vista</h3>
                <p className="text-[11px] text-[#737784] mt-0.5 font-medium">
                  {latestExam ? `Realizado el ${formatDate(latestExam.exam_date)}` : 'Sin registros de exámenes'}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#737784] transition-transform duration-300 ${openAccordion === 'exam' ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 overflow-hidden ${openAccordion === 'exam' ? 'max-h-[1000px] border-t border-[#f0f3ff]' : 'max-h-0'}`}>
            <div className="p-5 text-left">
              {latestExam ? (
                <div className="space-y-4">
                  {/* Receta Grid */}
                  <div className="border border-[#cbd5e1]/40 rounded-xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-5 bg-[#f9f9ff] text-[9px] font-black uppercase text-[#737784] border-b border-[#cbd5e1]/40 text-center divide-x divide-[#cbd5e1]/30">
                      <div className="py-2.5">Ojo</div>
                      <div className="py-2.5">Esfera (SPH)</div>
                      <div className="py-2.5">Cilindro (CYL)</div>
                      <div className="py-2.5">Eje (AXIS)</div>
                      <div className="py-2.5">Adición</div>
                    </div>
                    {/* OD Row */}
                    <div className="grid grid-cols-5 bg-white text-xs text-[#111c2d] border-b border-[#cbd5e1]/45 text-center divide-x divide-[#cbd5e1]/30 items-center">
                      <div className="py-3 font-extrabold text-[#00357f]">OD <span className="block text-[8px] font-bold text-[#737784] uppercase">Derecho</span></div>
                      <div className="py-3 font-mono font-bold">{latestExam.od_sphere !== null ? (latestExam.od_sphere >= 0 ? '+' : '') + latestExam.od_sphere.toFixed(2) : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.od_cylinder !== null ? (latestExam.od_cylinder >= 0 ? '+' : '') + latestExam.od_cylinder.toFixed(2) : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.od_axis !== null ? `${latestExam.od_axis}°` : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.od_add !== null ? `+${latestExam.od_add.toFixed(2)}` : '--'}</div>
                    </div>
                    {/* OI Row */}
                    <div className="grid grid-cols-5 bg-[#f9f9ff] text-xs text-[#111c2d] text-center divide-x divide-[#cbd5e1]/30 items-center">
                      <div className="py-3 font-extrabold text-[#00668a]">OI <span className="block text-[8px] font-bold text-[#737784] uppercase">Izquierdo</span></div>
                      <div className="py-3 font-mono font-bold">{latestExam.oi_sphere !== null ? (latestExam.oi_sphere >= 0 ? '+' : '') + latestExam.oi_sphere.toFixed(2) : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.oi_cylinder !== null ? (latestExam.oi_cylinder >= 0 ? '+' : '') + latestExam.oi_cylinder.toFixed(2) : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.oi_axis !== null ? `${latestExam.oi_axis}°` : '--'}</div>
                      <div className="py-3 font-mono font-bold">{latestExam.oi_add !== null ? `+${latestExam.oi_add.toFixed(2)}` : '--'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-[#dee8ff]/30 border border-[#cbd5e1]/30 rounded-xl">
                    <Info className="w-4.5 h-4.5 text-[#00357f] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#434653] leading-relaxed font-medium">
                      Distancia Pupilar (DP): <strong>{latestExam.pd_distance || 'N/A'} mm</strong>. 
                      {latestExam.lens_type && ` Lente recomendado: ${latestExam.lens_type.toUpperCase()}.`}
                      {latestExam.treatment && ` Tratamientos sugeridos: ${latestExam.treatment}.`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#737784] font-semibold leading-relaxed">
                  Aún no cuentas con un diagnóstico oftálmico en nuestro sistema. Acude a Óptica Rayo para tu examen anual gratuito.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Accordion 2: Estado de Pagos */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <button 
            onClick={() => setOpenAccordion(openAccordion === 'payments' ? null : 'payments')}
            className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Wallet className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#111c2d]">Resumen de Pagos</h3>
                <div className="flex items-center gap-2 mt-0.5 font-medium">
                  <p className="text-[11px] text-[#737784]">Saldo pendiente: {formatPrice(pendingBalance)}</p>
                  {pendingBalance > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[8px] font-black uppercase">
                      Adeudo Activo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#737784] transition-transform duration-300 ${openAccordion === 'payments' ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${openAccordion === 'payments' ? 'max-h-[1000px] border-t border-[#f0f3ff]' : 'max-h-0'}`}>
            <div className="p-5 space-y-4 text-left">
              
              {/* Payment Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold text-[#737784]">
                  <span>Total Pagado: {formatPrice(totalPaid)}</span>
                  <span className="text-[#00357f] font-black">Monto Total: {formatPrice(totalPurchased)}</span>
                </div>
                <div className="w-full h-2.5 bg-[#f0f3ff] rounded-full overflow-hidden border border-[#cbd5e1]/40">
                  <div className="h-full bg-[#00357f] rounded-full transition-all duration-500" style={{ width: `${paymentProgressPercent}%` }}></div>
                </div>
                <p className="text-[10px] text-right text-[#737784] font-semibold">{paymentProgressPercent}% liquidado</p>
              </div>

              {/* Installments Schedule */}
              {installments.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider">Calendario de Pagos a Plazos</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {installments.map((inst, index) => (
                      <div key={inst.id || index} className="bg-[#f9f9ff] border border-[#cbd5e1]/45 p-3 rounded-xl flex justify-between items-center text-xs">
                        <div className="space-y-0.5 text-left">
                          <p className="font-bold text-[#111c2d]">Cuota #{inst.installment_number}</p>
                          <p className="text-[10px] text-[#737784] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#00357f]" /> Vence el {new Date(inst.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-mono font-black text-[#00357f]">{formatPrice(inst.amount)}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            inst.status === 'paid' ? 'bg-[#e2f9ee] text-[#00422b]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}>
                            {inst.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : pendingBalance > 0 ? (
                <div className="bg-[#f9f9ff] border border-[#cbd5e1]/45 rounded-xl p-4 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white border border-[#cbd5e1] rounded-xl flex flex-col items-center justify-center text-[#111c2d] shrink-0 shadow-sm">
                      <span className="text-[8px] font-black uppercase text-[#737784]">Mensual</span>
                      <span className="text-base font-black text-[#00357f] leading-none font-mono">15</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111c2d]">Adeudo de Compra</p>
                      <p className="text-[10px] text-[#737784] font-medium">Favor de liquidar en sucursal</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#ba1a1a] font-mono">{formatPrice(pendingBalance)}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#e8f5e9]/30 border border-emerald-500/20 p-4 rounded-xl text-center text-xs font-bold text-emerald-700">
                  ¡Felicidades! No cuentas con saldos pendientes. Tu cuenta está al corriente.
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Accordion 3: Historial de Compras */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <button 
            onClick={() => setOpenAccordion(openAccordion === 'history' ? null : 'history')}
            className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Receipt className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#111c2d]">Historial de Compras</h3>
                <p className="text-[11px] text-[#737784] mt-0.5 font-medium">
                  {sales.length} artículo{sales.length !== 1 ? 's' : ''} en tu historial
                </p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#737784] transition-transform duration-300 ${openAccordion === 'history' ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${openAccordion === 'history' ? 'max-h-[1000px] border-t border-[#f0f3ff]' : 'max-h-0'}`}>
            <div className="p-0 text-left">
              {sales.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#737784] font-semibold">
                  Aún no registras compras asociadas a tu cuenta.
                </div>
              ) : (
                <ul className="divide-y divide-[#cbd5e1]/30">
                  {sales.map((sale) => (
                    <li 
                      key={sale.id} 
                      onClick={() => setSelectedSaleDetail(sale)}
                      className="px-5 py-4 hover:bg-[#f9f9ff] transition-colors flex justify-between items-center gap-4 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-[#111c2d] mb-1 group-hover:text-[#00357f] transition-colors truncate">
                          {sale.sale_items?.map((i: any) => i.product?.name).join(', ') || 'Compra en Óptica'}
                        </p>
                        <p className="text-[10px] text-[#737784] font-medium">
                          Adquirido el {new Date(sale.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-xs text-[#00357f] font-mono">{formatPrice(sale.total)}</p>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          (sale.pending_balance || 0) > 0 
                            ? 'bg-[#ffdad6] text-[#ba1a1a]' 
                            : 'bg-[#49da9f]/20 text-[#00422b]'
                        }`}>
                          {(sale.pending_balance || 0) > 0 ? 'Con Adeudo' : 'Pagado'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Accordion 4: Armar mis Lentes (Constructor) */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <button 
            onClick={() => setOpenAccordion(openAccordion === 'builder' ? null : 'builder')}
            className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Sliders className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#111c2d]">Armar mis Lentes</h3>
                <p className="text-[11px] text-[#737784] mt-0.5 font-medium">Diseña tu combinación de armazón y micas preferidos</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#737784] transition-transform duration-300 ${openAccordion === 'builder' ? 'rotate-180' : ''}`} />
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${openAccordion === 'builder' ? 'max-h-[1200px] border-t border-[#f0f3ff]' : 'max-h-0'}`}>
            <form onSubmit={handleSubmitLensRequest} className="p-5 space-y-4 text-left">
              {builderFeedback && (
                <div className={`p-3.5 rounded-xl text-xs font-bold border ${
                  builderFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                }`}>
                  {builderFeedback.text}
                </div>
              )}

              {/* Step 1: Select Frame */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-[#434653] uppercase tracking-wider">1. Selecciona tu Armazón</label>
                <select 
                  value={selectedFrameId}
                  onChange={e => setSelectedFrameId(e.target.value)}
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs focus:border-[#00357f] outline-none"
                  required
                >
                  <option value="">-- Elige un armazón del catálogo --</option>
                  {frames.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({formatPrice(f.price)})</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Lens Material */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-[#434653] uppercase tracking-wider">2. Selecciona el Tipo de Mica</label>
                <select 
                  value={selectedMaterialId}
                  onChange={e => setSelectedMaterialId(e.target.value)}
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs focus:border-[#00357f] outline-none"
                >
                  <option value="">-- Sin mica (Solo armazón) --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (+{formatPrice(m.price)})</option>
                  ))}
                </select>
              </div>

              {/* Step 3: Choose Treatments */}
              {treatments.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-[#434653] uppercase tracking-wider">3. Agrega Tratamientos Extras</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#f0f3ff]/40 p-3.5 border border-[#cbd5e1]/20 rounded-xl">
                    {treatments.map(t => (
                      <label key={t.id} className="flex items-start gap-2.5 text-xs text-[#434653] font-medium cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedTreatmentIds.includes(t.id)}
                          onChange={e => handleTreatmentToggle(t.id, e.target.checked)}
                          className="rounded border-[#cbd5e1] text-[#00357f] mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-[#111c2d] block">{t.name}</span>
                          <span className="text-[10px] text-[#737784] font-mono">+{formatPrice(t.price)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Notes */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-[#434653] uppercase tracking-wider">Notas o Comentarios Adicionales</label>
                <textarea
                  rows={2}
                  value={lensNotes}
                  onChange={e => setLensNotes(e.target.value)}
                  placeholder="Ej. Graduación específica, color del tinte, etc."
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-3 text-xs focus:border-[#00357f] outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingLensRequest}
                  className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  {isSubmittingLensRequest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando solicitud...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Aceptar / Solicitar Cotización
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* Benefits Coupons Section */}
      {coupons.length > 0 && (
        <section className="space-y-4 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#737784] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00357f]" />
            Cupones Exclusivos de Cliente
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coupons.map((coupon) => (
              <div 
                key={coupon.id}
                className="bg-white border border-[#cbd5e1] rounded-2xl p-5 relative overflow-hidden shadow-sm"
              >
                {/* Visual tickets cutouts */}
                <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-[#f9f9ff] border border-[#cbd5e1] rounded-full" />
                <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-[#f9f9ff] border border-[#cbd5e1] rounded-full" />

                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-[#737784]">
                    <span className="bg-[#dee8ff] text-[#00357f] px-2 py-0.5 rounded">Descuento Especial</span>
                    <span>Vence: {new Date(coupon.valid_until).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="text-center py-2">
                    <span className="text-2xl font-black text-[#00357f] font-mono">
                      {coupon.discount_percent}% DE DESCUENTO
                    </span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-[#cbd5e1] flex flex-col items-center gap-1.5">
                    <span className="text-[8px] text-[#737784] font-black uppercase tracking-wider">Presentar en Sucursal</span>
                    <span className="text-xs font-black tracking-widest text-[#111c2d] select-all bg-[#f0f3ff] px-4 py-1.5 rounded-lg border border-[#cbd5e1] w-full text-center font-mono">
                      {coupon.code}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detailed Receipt Modal */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 bg-[#111c2d]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#cbd5e1] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-[#cbd5e1]/40 bg-[#f9f9ff] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-[#00357f] flex items-center gap-1.5 uppercase tracking-wider">
                  <Receipt className="w-4.5 h-4.5" /> Detalle del Recibo
                </h3>
                <span className="text-[9px] text-[#737784] font-mono">ID: {selectedSaleDetail.id.toUpperCase()}</span>
              </div>
              <button 
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1 rounded-lg hover:bg-[#dee8ff] text-[#737784] hover:text-[#111c2d] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-left">
              {/* Meta Date / Status */}
              <div className="flex justify-between items-center text-[10px] text-[#737784] font-semibold border-b border-[#cbd5e1]/30 pb-2">
                <span>Fecha: {new Date(selectedSaleDetail.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                  (selectedSaleDetail.pending_balance || 0) > 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#49da9f]/20 text-[#00422b]'
                }`}>
                  {(selectedSaleDetail.pending_balance || 0) > 0 ? 'Con Adeudo' : 'Pagado'}
                </span>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider">Productos Adquiridos</h4>
                <div className="space-y-2.5">
                  {selectedSaleDetail.sale_items?.map((item: any) => {
                    const baseFramePrice = item.price - (item.lens_material_price || 0) - (item.sale_item_treatments?.reduce((sum: number, t: any) => sum + t.price, 0) || 0)
                    return (
                      <div key={item.id} className="bg-[#f9f9ff] border border-[#cbd5e1]/30 p-3 rounded-xl space-y-2">
                        {/* Frame detail */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-[#111c2d]">{item.product?.name || 'Armazón / Lente'}</span>
                            <span className="text-[10px] text-[#737784] block font-mono">Cant: {item.quantity} x {formatPrice(baseFramePrice)}</span>
                          </div>
                          <span className="font-bold text-[#111c2d] font-mono">{formatPrice(baseFramePrice * item.quantity)}</span>
                        </div>

                        {/* Lens Material detail */}
                        {item.lens_material && (
                          <div className="flex justify-between items-center text-[10px] pl-3 border-l-2 border-[#cbd5e1] py-0.5">
                            <span className="text-[#434653] font-medium">Mica: {item.lens_material.name}</span>
                            <span className="text-[#111c2d] font-semibold font-mono">+{formatPrice((item.lens_material_price || 0) * item.quantity)}</span>
                          </div>
                        )}

                        {/* Treatments detail */}
                        {item.sale_item_treatments && item.sale_item_treatments.length > 0 && (
                          <div className="space-y-1 pl-3 border-l-2 border-[#cbd5e1] mt-1">
                            {item.sale_item_treatments.map((tr: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-[10px]">
                                <span className="text-[#434653] font-medium">Extra: {tr.treatment?.name || 'Tratamiento'}</span>
                                <span className="text-[#111c2d] font-semibold font-mono">+{formatPrice(tr.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Prescription Panel */}
              <div className="border-t border-b border-[#cbd5e1]/40 py-4 my-2">
                {selectedSaleDetail.sale_items?.some((i: any) => i.od_sphere !== null || i.oi_sphere !== null) ? (
                  <div className="space-y-2.5">
                    <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider">Receta Oftalmológica de la Venta</h4>
                    {selectedSaleDetail.sale_items?.filter((i: any) => i.od_sphere !== null || i.oi_sphere !== null).map((item: any) => (
                      <div key={item.id} className="space-y-2 bg-[#f0f3ff]/40 border border-[#cbd5e1]/20 p-2.5 rounded-lg">
                        <span className="text-[10px] font-black text-[#00357f] block truncate">{item.product?.name}</span>
                        
                        <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px] mt-1 border-t border-[#cbd5e1]/20 pt-1">
                          <span className="text-[8px] text-[#737784] font-black uppercase self-center">OJO</span>
                          <span className="text-[8px] text-[#737784] font-black uppercase">ESF</span>
                          <span className="text-[8px] text-[#737784] font-black uppercase">CIL</span>
                          <span className="text-[8px] text-[#737784] font-black uppercase">EJE</span>
                          <span className="text-[8px] text-[#737784] font-black uppercase">ADD</span>

                          <span className="font-bold text-[#00357f]">OD</span>
                          <span>{item.od_sphere ?? '—'}</span>
                          <span>{item.od_cylinder ?? '—'}</span>
                          <span>{item.od_axis ?? '—'}</span>
                          <span>{item.od_add ?? '—'}</span>

                          <span className="font-bold text-[#00357f]">OI</span>
                          <span>{item.oi_sphere ?? '—'}</span>
                          <span>{item.oi_cylinder ?? '—'}</span>
                          <span>{item.oi_axis ?? '—'}</span>
                          <span>{item.oi_add ?? '—'}</span>
                        </div>

                        <div className="flex justify-between items-center text-[9px] pt-1.5 mt-1 border-t border-[#cbd5e1]/20">
                          <span className="text-[#737784] font-bold">DISTANCIA PUPILAR (DIP):</span>
                          <span className="font-bold font-mono">{item.pd_distance ? `${item.pd_distance} mm` : 'No registrada'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#f0f3ff] border border-[#b0c6ff]/40 p-4 rounded-xl flex items-start gap-2.5">
                    <Info className="w-5 h-5 text-[#00357f] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#00357f] text-xs">Información de Graduación</p>
                      <p className="text-[10px] text-[#434653] font-medium leading-relaxed mt-1">
                        Tu graduación exacta está resguardada de forma segura en tu expediente en nuestra sucursal.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Totals */}
              <div className="bg-[#f9f9ff] border border-[#cbd5e1]/45 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-[#434653] font-medium">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatPrice(selectedSaleDetail.total / 1.16)}</span>
                </div>
                <div className="flex justify-between text-[#434653] font-medium">
                  <span>IVA (16%)</span>
                  <span className="font-mono">{formatPrice((selectedSaleDetail.total / 1.16) * 0.16)}</span>
                </div>
                {selectedSaleDetail.discount_applied > 0 && (
                  <div className="flex justify-between text-[#ba1a1a] font-medium">
                    <span>Descuento Aplicado</span>
                    <span className="font-mono">-{formatPrice(selectedSaleDetail.discount_applied)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-[#cbd5e1]/40 pt-2 font-black text-sm">
                  <span className="text-[#111c2d]">Total de Compra</span>
                  <span className="text-[#00357f] font-mono">{formatPrice(selectedSaleDetail.total)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#737784] font-semibold border-t border-dashed border-[#cbd5e1]/40 pt-2">
                  <span>Monto Pagado</span>
                  <span className="text-[#111c2d] font-mono">{formatPrice(selectedSaleDetail.paid_amount)}</span>
                </div>
                {selectedSaleDetail.pending_balance > 0 && (
                  <div className="flex justify-between text-[11px] font-black text-[#ba1a1a]">
                    <span>Saldo Pendiente</span>
                    <span className="font-mono">{formatPrice(selectedSaleDetail.pending_balance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-[#f9f9ff] border-t border-[#cbd5e1]/40 flex justify-end">
              <button 
                onClick={() => setSelectedSaleDetail(null)}
                className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-colors shadow-sm animate-none"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
