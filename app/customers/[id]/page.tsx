'use client'

import * as React from 'react'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getCustomerSales } from '@/lib/services'
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Phone, 
  Calendar, 
  Briefcase, 
  HeartHandshake, 
  Eye, 
  ShoppingBag,
  AlertTriangle,
  PlusCircle,
  TrendingDown
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id: customerId } = React.use(params)

  const [customer, setCustomer] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'exams' | 'sales'>('profile')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [custData, examsData, salesData] = await Promise.all([
        getCustomerById(customerId),
        getCustomerExams(customerId),
        getCustomerSales(customerId),
      ])

      if (!custData) {
        setError('El cliente no fue encontrado o no existe.')
      } else {
        setCustomer(custData)
        setExams(examsData)
        setSales(salesData)
      }
    } catch (err: any) {
      setError(`Error al cargar los datos: ${err.message || 'Error inesperado.'}`)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getInitials = (name: string) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'P'

  const calculateAge = (dob: string) => {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatExamValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '--'
    const num = typeof val === 'number' ? val : parseFloat(val)
    if (isNaN(num)) return '--'
    return (num >= 0 ? '+' : '') + num.toFixed(2)
  }

  const formatAddValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '--'
    const num = typeof val === 'number' ? val : parseFloat(val)
    if (isNaN(num)) return '--'
    return `+${num.toFixed(2)}`
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando expediente del cliente...</p>
      </main>
    )
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-[#ba1a1a]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#111c2d]">{error || 'Expediente no disponible'}</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-[#00357f] hover:underline">
            Volver a la lista de clientes
          </Link>
        </div>
      </main>
    )
  }

  const cp = customer.customer_profiles || {}
  const age = calculateAge(cp.date_of_birth)

  // Calculations for total debt
  const totalPending = sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Back and Header */}
      <div className="space-y-4">
        <Link href="/dashboard/admin/customers" className="inline-flex items-center gap-2 text-xs font-bold text-[#737784] hover:text-[#00357f] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Clientes
        </Link>

        {/* Customer Profile Header Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-[#dee8ff] text-[#00357f] rounded-full flex items-center justify-center font-black text-xl select-none">
            {getInitials(customer.full_name)}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
            <h1 className="text-2xl font-black text-[#111c2d] leading-none">{customer.full_name}</h1>
            <p className="text-xs text-[#737784] font-medium">
              @{customer.email?.replace('@opticarayo.com', '')}
              {age !== null && ` · ${age} años`}
              {cp.occupation && ` · ${cp.occupation}`}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {cp.blood_type && cp.blood_type !== 'NS' && (
                <span className="bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#ffdad6]">
                  Tipo: {cp.blood_type}
                </span>
              )}
              <span className="bg-[#dee8ff]/60 text-[#00357f] text-[10px] font-bold px-2 py-0.5 rounded">
                Alta: {new Date(customer.created_at).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
              </span>
              {totalPending > 0 && (
                <span className="bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                  Saldo pendiente: {formatPrice(totalPending)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#cbd5e1] bg-white rounded-t-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <User className="w-4 h-4" />
          Expediente
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'exams'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <Eye className="w-4 h-4" />
          Historial Clínico
          {exams.length > 0 && (
            <span className="ml-1 bg-[#dee8ff] text-[#00357f] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {exams.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'sales'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Ventas y Compras
          {sales.length > 0 && (
            <span className="ml-1 bg-[#dee8ff] text-[#00357f] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {sales.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="flex justify-between items-center border-b border-[#f0f3ff] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Datos Generales</h3>
                <span className="text-[10px] bg-[#49da9f]/20 text-[#00422b] px-2 py-0.5 rounded font-black uppercase">
                  CRM Activo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Teléfono</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.phone || 'No registrado'}</span>
                </div>
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Fecha de Nacimiento</span>
                  <span className="text-sm font-bold text-[#111c2d]">{formatDate(cp.date_of_birth)}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Dirección</span>
                  <span className="text-sm font-bold text-[#111c2d] leading-normal">{cp.address || 'No registrada'}</span>
                </div>
              </div>

              {/* WHATSAPP CRM BUTTONS */}
              {cp.phone && (
                <div className="border-t border-[#f0f3ff] pt-5 space-y-3">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#737784]">
                    Automatización de Recordatorios por WhatsApp
                  </span>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Recordatorio de Cita */}
                    <button
                      onClick={() => {
                        const cleanPhone = cp.phone.replace(/[^\d]/g, '')
                        const phoneWithCode = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
                        const message = `Hola ${customer.full_name}, te saludamos de Óptica Rayo. Queremos recordarte que tus lentes están próximos a cumplir un año de su última revisión. Te sugerimos agendar tu examen visual de seguimiento preventivo aquí. ¡Esperamos verte pronto!`
                        window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                      }}
                      type="button"
                      className="flex-1 bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113] font-bold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Phone className="w-4 h-4" />
                      Enviar Recordatorio de Examen
                    </button>

                    {/* Recordatorio de Cobranza */}
                    {totalPending > 0 && (
                      <button
                        onClick={() => {
                          const cleanPhone = cp.phone.replace(/[^\d]/g, '')
                          const phoneWithCode = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
                          const message = `Hola ${customer.full_name}, te saludamos de Óptica Rayo. Te recordamos cordialmente que cuentas con un saldo pendiente de ${formatPrice(totalPending)} MXN de tu compra. Puedes pasar a liquidarlo a sucursal o realizar una transferencia bancaria. ¡Muchas gracias por tu preferencia!`
                          window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                        }}
                        type="button"
                        className="flex-1 bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] font-bold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 border border-[#ba1a1a]/25"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Cobranza de Saldo ({formatPrice(totalPending)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Antecedentes clínicos */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Antecedentes Médicos</h3>
              <p className="text-xs text-[#434653] leading-relaxed bg-[#f9f9ff] p-4 rounded-xl border border-[#cbd5e1]/40 min-h-[60px] font-medium">
                {cp.medical_notes || 'Sin observaciones o condiciones registradas.'}
              </p>
            </div>

            {/* Contacto de Emergencia */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Contacto de Emergencia</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Nombre del Contacto</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.emergency_contact_name || 'No registrado'}</span>
                </div>
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Teléfono</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.emergency_contact_phone || 'No registrado'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EXAMS */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737784]">Exámenes del Cliente</h3>
              <Link
                href={`/customers/${customerId}/exam/new`}
                className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4.5 h-4.5" /> Nuevo Examen Clínico
              </Link>
            </div>

            {exams.length === 0 ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl py-12 text-center space-y-3 shadow-sm p-6">
                <p className="text-xs text-[#737784] font-semibold">Este cliente no tiene historial de exámenes aún.</p>
                <Link href={`/customers/${customerId}/exam/new`} className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                  Realizar primer examen visual →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {exams.map((exam, i) => (
                  <div key={exam.id} className="bg-white border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-sm">
                    {/* Header del examen */}
                    <div className="bg-[#f9f9ff] border-b border-[#cbd5e1] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#00357f]">
                          Examen #{exams.length - i}
                        </span>
                        <h4 className="text-xs font-bold text-[#111c2d]">
                          {formatDate(exam.exam_date)}
                        </h4>
                      </div>
                      <span className="text-[10px] text-[#737784] font-bold">
                        Optometrista: <strong className="text-[#111c2d]">{exam.examiner?.full_name || 'Staff Óptica'}</strong>
                      </span>
                    </div>

                    {/* Receta Grid */}
                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Ojo Derecho */}
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00357f]" />
                            Ojo Derecho (OD)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-[#00357f]">{formatExamValue(exam.od_sphere)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-[#00357f]">{formatExamValue(exam.od_cylinder)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-[#00357f]">{exam.od_axis !== null ? `${exam.od_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-[11px] text-[#434653] font-medium">
                            <span>Adición: <strong className="font-mono text-[#00357f]">{formatAddValue(exam.od_add)}</strong></span>
                            <span>Agudeza: <strong className="text-[#111c2d]">{exam.od_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>

                        {/* Ojo Izquierdo */}
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-[#00668a] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00668a]" />
                            Ojo Izquierdo (OI)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-[#00668a]">{formatExamValue(exam.oi_sphere)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-[#00668a]">{formatExamValue(exam.oi_cylinder)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-[#00668a]">{exam.oi_axis !== null ? `${exam.oi_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-[11px] text-[#434653] font-medium">
                            <span>Adición: <strong className="font-mono text-[#00668a]">{formatAddValue(exam.oi_add)}</strong></span>
                            <span>Agudeza: <strong className="text-[#111c2d]">{exam.oi_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Datos Ópticos Adicionales */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Distancia Pupilar</span>
                          <span className="text-xs font-bold text-[#111c2d]">
                            {exam.pd_distance ? `${exam.pd_distance} mm` : '--'} / {exam.pd_near ? `${exam.pd_near} mm` : '--'}
                          </span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Tipo Lente</span>
                          <span className="text-xs font-bold text-[#111c2d] capitalize">{exam.lens_type || 'No especificado'}</span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Tratamiento</span>
                          <span className="text-xs font-bold text-[#111c2d] truncate block">{exam.treatment || 'Ninguno'}</span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Próxima Cita</span>
                          <span className="text-xs font-bold text-[#111c2d]">{exam.next_exam_date ? new Date(exam.next_exam_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Recomendación de Armazón & Notas Clínicas */}
                      {(exam.frame_recommendation || exam.clinical_notes) && (
                        <div className="border-t border-[#cbd5e1]/40 pt-4 space-y-3 text-left">
                          {exam.frame_recommendation && (
                            <div className="text-xs bg-[#dee8ff]/50 border border-[#cbd5e1] p-3 rounded-xl">
                              <span className="font-bold text-[#00357f] block mb-0.5">Armazón Recomendado:</span>
                              <span className="text-[#434653] font-medium">{exam.frame_recommendation}</span>
                            </div>
                          )}
                          {exam.clinical_notes && (
                            <div className="text-xs bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3 rounded-xl">
                              <span className="font-bold text-[#737784] block mb-0.5">Observaciones Clínicas:</span>
                              <span className="text-[#434653] leading-relaxed block font-medium">{exam.clinical_notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SALES */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737784]">Historial de Compras</h3>
              <Link
                href={`/customers/${customerId}/sale/new`}
                className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4.5 h-4.5" /> Registrar Nueva Venta
              </Link>
            </div>

            {sales.length === 0 ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl py-12 text-center space-y-3 shadow-sm p-6">
                <p className="text-xs text-[#737784] font-semibold">Este cliente no registra transacciones de compra.</p>
                <Link href={`/customers/${customerId}/sale/new`} className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                  Registrar venta nueva →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div key={sale.id} className="bg-white border border-[#cbd5e1] rounded-2xl p-5 space-y-4 shadow-sm">
                    {/* Cabecera venta */}
                    <div className="flex justify-between items-start border-b border-[#cbd5e1]/40 pb-3">
                      <div>
                        <span className="text-[9px] text-[#737784] block uppercase font-bold">Venta registrada</span>
                        <span className="text-xs font-bold text-[#111c2d]">{formatDate(sale.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#737784] block uppercase font-bold">Total cobrado</span>
                        <span className="text-sm font-black text-[#00357f] font-mono">{formatPrice(sale.total)}</span>
                      </div>
                    </div>

                    {/* Items de la venta */}
                    <div className="space-y-2 text-left">
                      <span className="text-[9px] font-black text-[#737784] uppercase tracking-wider block">Productos</span>
                      <div className="space-y-1.5">
                        {sale.sale_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-[#f9f9ff] px-3.5 py-2.5 rounded-xl border border-[#cbd5e1]/40">
                            <div>
                              <span className="font-bold text-[#111c2d]">{item.product?.name || 'Producto'}</span>
                              <span className="text-[9px] text-[#737784] ml-2 font-bold uppercase">({item.product?.category === 'frames' ? 'Armazón' : item.product?.category === 'lenses' ? 'Micas' : item.product?.category === 'contact_lenses' ? 'Contacto' : 'Accesorio'})</span>
                            </div>
                            <span className="text-[#434653] font-medium">
                              {item.quantity} x <strong className="font-mono text-[#00357f]">{formatPrice(item.price)}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cupones y notas adicionales */}
                    {(sale.coupon || sale.discount_applied > 0 || sale.notes) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-left">
                        {sale.coupon && (
                          <div className="bg-[#49da9f]/10 border border-[#49da9f]/30 p-2.5 rounded-xl flex items-center justify-between text-[#005c3e] font-bold">
                            <span>Cupón: <strong className="font-mono uppercase">{sale.coupon.code}</strong></span>
                            <span>-{sale.coupon.discount_percent}%</span>
                          </div>
                        )}
                        {sale.discount_applied > 0 && !sale.coupon && (
                          <div className="bg-[#49da9f]/10 border border-[#49da9f]/30 p-2.5 rounded-xl text-[#005c3e] font-bold">
                            Descuento directo: <strong className="font-mono">{formatPrice(sale.discount_applied)}</strong>
                          </div>
                        )}
                        {sale.notes && (
                          <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3 rounded-xl text-[#434653] sm:col-span-2 font-medium">
                            <span className="font-bold text-[#737784] block mb-0.5 text-[9px] uppercase">Notas de la compra:</span>
                            {sale.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
