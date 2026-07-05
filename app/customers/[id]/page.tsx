'use client'

import * as React from 'react'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getCustomerSales } from '@/lib/services'

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
        setError('El paciente no fue encontrado o no existe.')
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Cargando expediente del paciente...</p>
      </main>
    )
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{error || 'Expediente no disponible'}</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
            Volver a la lista de pacientes
          </Link>
        </div>
      </main>
    )
  }

  const cp = customer.customer_profiles || {}
  const age = calculateAge(cp.date_of_birth)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24">
      {/* Background radial glow */}
      <div className="fixed top-20 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-6 relative">
        {/* Navigation & Header */}
        <div className="space-y-4">
          <Link href="/customers" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Pacientes
          </Link>

          {/* Customer Profile Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-6 bg-slate-900/40 border border-slate-800/60 rounded-3xl backdrop-blur-xl">
            <div className="w-16 h-16 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <span className="text-xl font-black text-slate-950 select-none">
                {getInitials(customer.full_name)}
              </span>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <h1 className="text-xl font-extrabold text-slate-100">{customer.full_name}</h1>
              <p className="text-xs text-slate-400">
                @{customer.email?.replace('@opticarayo.com', '')}
                {age !== null && ` · ${age} años`}
                {cp.occupation && ` · ${cp.occupation}`}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                {cp.blood_type && cp.blood_type !== 'NS' && (
                  <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    🩸 Tipo: {cp.blood_type}
                  </span>
                )}
                <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  Paciente desde: {new Date(customer.created_at).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center ${
              activeTab === 'profile'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Expediente
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center relative ${
              activeTab === 'exams'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Historial Clínico
            {exams.length > 0 && (
              <span className="absolute top-2.5 right-4 sm:right-6 bg-slate-800 text-[10px] text-slate-300 font-extrabold px-1.5 py-0.5 rounded-full border border-slate-700">
                {exams.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center relative ${
              activeTab === 'sales'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Ventas y Compras
            {sales.length > 0 && (
              <span className="absolute top-2.5 right-4 sm:right-6 bg-slate-800 text-[10px] text-slate-300 font-extrabold px-1.5 py-0.5 rounded-full border border-slate-700">
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
              {/* Información de contacto y Automatizaciones CRM */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Datos Generales</h3>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-slate-400 font-bold uppercase">
                    CRM Activo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">Teléfono</span>
                    <span className="font-semibold text-slate-200">{cp.phone || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">Fecha de Nacimiento</span>
                    <span className="font-semibold text-slate-200">{formatDate(cp.date_of_birth)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">Dirección</span>
                    <span className="font-semibold text-slate-200">{cp.address || 'No registrada'}</span>
                  </div>
                </div>

                {/* BOTONES DE AUTOMATIZACIÓN CRM WHATSAPP */}
                {cp.phone && (
                  <div className="border-t border-slate-850 pt-4 space-y-3">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Automatización de Recordatorios
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
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-4 py-3.5 rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 1.981 14.12 1.01 11.5 1.01c-5.436 0-9.861 4.372-9.865 9.8.001 1.95.536 3.849 1.562 5.521L2.1 21.9l5.776-1.516c-1.584.877-1.127.608-.887.893z" />
                        </svg>
                        Recordatorio de Examen
                      </button>

                      {/* Recordatorio de Cobranza (Si aplica saldo pendiente) */}
                      {sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0) > 0 && (
                        <button
                          onClick={() => {
                            const pendingBal = sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)
                            const cleanPhone = cp.phone.replace(/[^\d]/g, '')
                            const phoneWithCode = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
                            const message = `Hola ${customer.full_name}, te saludamos de Óptica Rayo. Te recordamos cordialmente que cuentas con un saldo pendiente de ${formatPrice(pendingBal)} MXN de tu compra. Puedes pasar a liquidarlo a sucursal o realizar una transferencia bancaria. ¡Muchas gracias por tu preferencia!`
                            window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                          }}
                          type="button"
                          className="flex-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-xs px-4 py-3.5 rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Cobranza de Saldo ({formatPrice(sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0))})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Antecedentes clínicos */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Antecedentes Médicos</h3>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40 min-h-[80px]">
                  {cp.medical_notes || 'Sin observaciones o condiciones registradas.'}
                </p>
              </div>

              {/* Contacto de Emergencia */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Contacto de Emergencia</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">Nombre del Contacto</span>
                    <span className="font-semibold text-slate-200">{cp.emergency_contact_name || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">Teléfono</span>
                    <span className="font-semibold text-slate-200">{cp.emergency_contact_phone || 'No registrado'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXAMS */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {/* Header de sección */}
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Exámenes del Paciente</h3>
                <Link
                  href={`/customers/${customerId}/exam/new`}
                  className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-[11px] px-4 py-2 rounded-xl transition-all"
                >
                  + Nuevo Examen
                </Link>
              </div>

              {/* Lista de exámenes */}
              {exams.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl py-12 text-center space-y-3">
                  <p className="text-sm text-slate-500">Este paciente no tiene historial de exámenes aún.</p>
                  <Link href={`/customers/${customerId}/exam/new`} className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
                    Realizar primer examen visual →
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {exams.map((exam, i) => (
                    <div key={exam.id} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
                      {/* Header del examen */}
                      <div className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                            Examen #{exams.length - i}
                          </span>
                          <h4 className="text-xs font-bold text-slate-300">
                            {formatDate(exam.exam_date)}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Realizado por: <strong className="text-slate-300">{exam.examiner?.full_name || 'Optometrista'}</strong>
                        </span>
                      </div>

                      {/* Receta Grid */}
                      <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Ojo Derecho */}
                          <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              Ojo Derecho (OD)
                            </span>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Esfera</span>
                                <span className="font-mono font-bold text-slate-200">{exam.od_sphere !== null ? (exam.od_sphere >= 0 ? '+' : '') + exam.od_sphere.toFixed(2) : '--'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Cilindro</span>
                                <span className="font-mono font-bold text-slate-200">{exam.od_cylinder !== null ? (exam.od_cylinder >= 0 ? '+' : '') + exam.od_cylinder.toFixed(2) : '--'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Eje</span>
                                <span className="font-mono font-bold text-slate-200">{exam.od_axis !== null ? `${exam.od_axis}°` : '--'}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-1 text-xs text-slate-400">
                              <span>Adición: <strong className="font-mono text-slate-200">{exam.od_add !== null ? `+${exam.od_add.toFixed(2)}` : '--'}</strong></span>
                              <span>Agudeza: <strong className="text-slate-200">{exam.od_visual_acuity || 'N/A'}</strong></span>
                            </div>
                          </div>

                          {/* Ojo Izquierdo */}
                          <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              Ojo Izquierdo (OI)
                            </span>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Esfera</span>
                                <span className="font-mono font-bold text-slate-200">{exam.oi_sphere !== null ? (exam.oi_sphere >= 0 ? '+' : '') + exam.oi_sphere.toFixed(2) : '--'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Cilindro</span>
                                <span className="font-mono font-bold text-slate-200">{exam.oi_cylinder !== null ? (exam.oi_cylinder >= 0 ? '+' : '') + exam.oi_cylinder.toFixed(2) : '--'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">Eje</span>
                                <span className="font-mono font-bold text-slate-200">{exam.oi_axis !== null ? `${exam.oi_axis}°` : '--'}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-1 text-xs text-slate-400">
                              <span>Adición: <strong className="font-mono text-slate-200">{exam.oi_add !== null ? `+${exam.oi_add.toFixed(2)}` : '--'}</strong></span>
                              <span>Agudeza: <strong className="text-slate-200">{exam.oi_visual_acuity || 'N/A'}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Datos Ópticos Adicionales */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                          <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Distancia Pupilar</span>
                            <span className="text-xs font-bold text-slate-300">
                              {exam.pd_distance ? `${exam.pd_distance} mm` : '--'} / {exam.pd_near ? `${exam.pd_near} mm` : '--'}
                            </span>
                          </div>
                          <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Tipo Lente</span>
                            <span className="text-xs font-bold text-slate-300 capitalize">{exam.lens_type || 'No especificado'}</span>
                          </div>
                          <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Tratamiento</span>
                            <span className="text-xs font-bold text-slate-300 truncate block">{exam.treatment || 'Ninguno'}</span>
                          </div>
                          <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Próxima Cita</span>
                            <span className="text-xs font-bold text-slate-300">{exam.next_exam_date ? new Date(exam.next_exam_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                          </div>
                        </div>

                        {/* Recomendación de Armazón & Notas Clínicas */}
                        {(exam.frame_recommendation || exam.clinical_notes) && (
                          <div className="border-t border-slate-800/60 pt-4 space-y-3">
                            {exam.frame_recommendation && (
                              <div className="text-xs bg-cyan-950/20 border border-cyan-800/30 p-3 rounded-xl">
                                <span className="font-bold text-cyan-400 block mb-0.5">Armazón Recomendado:</span>
                                <span className="text-slate-300">{exam.frame_recommendation}</span>
                              </div>
                            )}
                            {exam.clinical_notes && (
                              <div className="text-xs bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl">
                                <span className="font-bold text-slate-400 block mb-0.5">Observaciones Clínicas:</span>
                                <span className="text-slate-300 leading-relaxed block">{exam.clinical_notes}</span>
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
              {/* Header de sección */}
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Historial de Compras</h3>
                <Link
                  href={`/customers/${customerId}/sale/new`}
                  className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-[11px] px-4 py-2 rounded-xl transition-all"
                >
                  + Nueva Venta
                </Link>
              </div>

              {/* Lista de compras */}
              {sales.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl py-12 text-center space-y-3">
                  <p className="text-sm text-slate-500">Este paciente no registra transacciones de compra.</p>
                  <Link href={`/customers/${customerId}/sale/new`} className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
                    Registrar venta nueva →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 space-y-4 shadow-md">
                      {/* Cabecera venta */}
                      <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Venta registrada</span>
                          <span className="text-xs font-bold text-slate-300">{formatDate(sale.created_at)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Total cobrado</span>
                          <span className="text-sm font-extrabold text-cyan-400">${sale.total?.toFixed(2)} MXN</span>
                        </div>
                      </div>

                      {/* Items de la venta */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Productos</span>
                        <div className="space-y-1.5">
                          {sale.sale_items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-slate-950/30 px-3 py-2 rounded-xl border border-slate-800/40">
                              <div>
                                <span className="font-semibold text-slate-200">{item.product?.name || 'Producto'}</span>
                                <span className="text-[10px] text-slate-500 ml-2">({item.product?.category || 'General'})</span>
                              </div>
                              <span className="text-slate-400">
                                {item.quantity} x <strong className="font-mono text-slate-300">${item.price?.toFixed(2)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cupones y notas adicionales */}
                      {(sale.coupon || sale.discount_applied > 0 || sale.notes) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                          {sale.coupon && (
                            <div className="bg-emerald-950/20 border border-emerald-800/30 p-2.5 rounded-xl flex items-center justify-between text-emerald-400">
                              <span>Cupón: <strong className="font-mono">{sale.coupon.code}</strong></span>
                              <span className="font-extrabold">-{sale.coupon.discount_percent}%</span>
                            </div>
                          )}
                          {sale.discount_applied > 0 && !sale.coupon && (
                            <div className="bg-emerald-950/20 border border-emerald-800/30 p-2.5 rounded-xl text-emerald-400">
                              Descuento directo: <strong className="font-mono">${sale.discount_applied.toFixed(2)}</strong>
                            </div>
                          )}
                          {sale.notes && (
                            <div className="bg-slate-950/40 border border-slate-800/40 p-2.5 rounded-xl text-slate-400 sm:col-span-2">
                              <span className="font-bold text-slate-500 block mb-0.5">Notas de la compra:</span>
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
      </div>
    </main>
  )
}
