'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { getCoupons, getMyLatestExam, getMySales, getMyReminder } from '@/lib/services'
import { Database } from '@/types/database.types'

type Coupon = Database['public']['Tables']['coupons']['Row']

export default function CustomerDashboard() {
  const [fullName, setFullName] = useState('Paciente')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [latestExam, setLatestExam] = useState<any | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [reminder, setReminder] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setFullName(user.user_metadata?.full_name || 'Paciente')
        }

        const [couponsData, examData, salesData, reminderData] = await Promise.all([
          getCoupons(),
          getMyLatestExam(),
          getMySales(),
          getMyReminder(),
        ])

        setCoupons(couponsData)
        setLatestExam(examData)
        setSales(salesData)
        setReminder(reminderData)
      } catch (err) {
        console.error('Error loading customer dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const isOverdue = (nextVisitStr: string) => {
    return new Date(nextVisitStr).getTime() < Date.now()
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24">
      {/* Background radial glow */}
      <div className="fixed top-20 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-8 relative">
        {/* Welcome Header */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-200">
            ¡Hola, <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">{fullName}</span>! 👋
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Bienvenido a tu panel personal de salud visual y beneficios en <strong className="text-slate-350">Óptica Rayo</strong>.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-500 border-t-transparent" />
            <p className="text-xs text-slate-500 font-semibold">Cargando tus beneficios y expediente...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* COLUMN LEFT: HEALTH MONITOR & CLINICAL EXAMS (Lg: 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Eye Health / Examination Reminders Section */}
              <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  Estado de tu Revisión Visual
                </h2>

                {reminder ? (
                  (() => {
                    const overdue = isOverdue(reminder.next_suggested_visit)
                    return (
                      <div className={`border rounded-3xl p-6 relative overflow-hidden backdrop-blur-md ${
                        overdue
                          ? 'bg-rose-500/5 border-rose-500/20'
                          : 'bg-emerald-500/5 border-emerald-500/20'
                      }`}>
                        <div className={`absolute top-0 left-0 w-2 h-full ${overdue ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              overdue ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {overdue ? '⚠️ Revisión Recomendada' : '✅ Revisión al Día'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-extrabold uppercase">Sugerencia Anual</span>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-200">
                              {overdue
                                ? 'Es momento de programar un nuevo examen'
                                : 'Tu salud visual se encuentra monitoreada'}
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {overdue
                                ? 'Ha transcurrido el tiempo recomendado desde tu última evaluación. Te aconsejamos acudir a tu sucursal de Óptica Rayo para actualizar tu receta.'
                                : 'Tu diagnóstico ocular está vigente. Te sugerimos realizar un examen preventivo en la fecha recomendada.'}
                            </p>
                          </div>
                          <div className="h-px bg-slate-900/60" />
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Último Examen</span>
                              <span className="font-semibold text-slate-300">{formatDate(reminder.last_visit_date)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Fecha Sugerida</span>
                              <span className={`font-semibold ${overdue ? 'text-rose-400' : 'text-slate-350'}`}>
                                {formatDate(reminder.next_suggested_visit)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 text-center text-xs text-slate-500">
                    Aún no cuentas con un registro de recordatorios. Visita nuestra sucursal para un examen visual.
                  </div>
                )}
              </section>

              {/* Latest Exam / Prescription Card */}
              <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  Tu Última Receta de Lentes
                </h2>

                {latestExam ? (
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                    <div className="bg-slate-900/80 border-b border-slate-850 px-6 py-4 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">Receta Médica</span>
                        <span className="text-xs text-slate-400 font-bold">{formatDate(latestExam.exam_date)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-850">
                        Lente: <strong className="text-cyan-400 capitalize">{latestExam.lens_type || 'Ninguno'}</strong>
                      </span>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* OD */}
                        <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            Ojo Derecho (OD)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.od_sphere !== null ? (latestExam.od_sphere >= 0 ? '+' : '') + latestExam.od_sphere.toFixed(2) : '--'}</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.od_cylinder !== null ? (latestExam.od_cylinder >= 0 ? '+' : '') + latestExam.od_cylinder.toFixed(2) : '--'}</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.od_axis !== null ? `${latestExam.od_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                            <span>Adición: <strong className="font-mono text-slate-200">{latestExam.od_add !== null ? `+${latestExam.od_add.toFixed(2)}` : '--'}</strong></span>
                            <span>Agudeza: <strong className="text-slate-200">{latestExam.od_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>

                        {/* OI */}
                        <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            Ojo Izquierdo (OI)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.oi_sphere !== null ? (latestExam.oi_sphere >= 0 ? '+' : '') + latestExam.oi_sphere.toFixed(2) : '--'}</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.oi_cylinder !== null ? (latestExam.oi_cylinder >= 0 ? '+' : '') + latestExam.oi_cylinder.toFixed(2) : '--'}</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-lg">
                              <span className="block text-[9px] text-slate-500 font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-slate-200">{latestExam.oi_axis !== null ? `${latestExam.oi_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                            <span>Adición: <strong className="font-mono text-slate-200">{latestExam.oi_add !== null ? `+${latestExam.oi_add.toFixed(2)}` : '--'}</strong></span>
                            <span>Agudeza: <strong className="text-slate-200">{latestExam.oi_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Extra clinical fields */}
                      <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-900/80 pt-4">
                        <div>
                          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Distancia Pupilar</span>
                          <span className="font-semibold text-slate-350">
                            {latestExam.pd_distance ? `${latestExam.pd_distance} mm (Lejana)` : '--'} / {latestExam.pd_near ? `${latestExam.pd_near} mm (Cercana)` : '--'}
                          </span>
                        </div>
                        {latestExam.treatment && (
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Tratamiento Sugerido</span>
                            <span className="font-semibold text-slate-300">{latestExam.treatment}</span>
                          </div>
                        )}
                        {latestExam.frame_recommendation && (
                          <div className="col-span-2 bg-slate-950/40 p-3 border border-slate-900 rounded-xl mt-1 text-[11px]">
                            <span className="font-bold text-cyan-400 block mb-0.5">Armazón Recomendado:</span>
                            <span className="text-slate-300">{latestExam.frame_recommendation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 text-center text-xs text-slate-500 leading-relaxed">
                    Aún no cuentas con un examen de la vista registrado en nuestro sistema. Agenda una cita en Óptica Rayo para obtener tu diagnóstico y receta en línea.
                  </div>
                )}
              </section>

              {/* Purchase History */}
              <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Tus Compras en Óptica Rayo
                </h2>

                {sales.length === 0 ? (
                  <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 text-center text-xs text-slate-500">
                    No registras transacciones de compra en tu cuenta.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sales.map((sale) => (
                      <div key={sale.id} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 space-y-4 shadow-sm backdrop-blur-md">
                        <div className="flex justify-between items-start border-b border-slate-900/60 pb-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Fecha de compra</span>
                            <span className="font-bold text-slate-300">{formatDate(sale.created_at)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Total</span>
                            <span className="font-extrabold text-cyan-400">${sale.total?.toFixed(2)} MXN</span>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="space-y-1.5 text-xs">
                          {sale.sale_items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-950/40 px-3.5 py-2.5 rounded-xl border border-slate-900">
                              <div>
                                <span className="font-bold text-slate-200">{item.product?.name || 'Lentes'}</span>
                                <span className="text-[9px] text-slate-500 ml-2">({item.product?.category || 'General'})</span>
                              </div>
                              <span className="text-slate-400 font-medium">
                                {item.quantity} u · <strong className="font-mono text-slate-300">${item.price?.toFixed(2)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Coupon info if exists */}
                        {sale.coupon && (
                          <div className="bg-emerald-950/20 border border-emerald-800/30 p-2.5 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                            <span>Descuento por cupón: <strong className="font-mono">{sale.coupon.code}</strong></span>
                            <span className="font-extrabold">-{sale.coupon.discount_percent}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* COLUMN RIGHT: BENEFITS & OFFERS (Lg: 4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Coupons/Offers Sector */}
              <section className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4 backdrop-blur-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Cupones Disponibles
                </h3>

                {coupons.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No hay cupones activos hoy.</p>
                ) : (
                  <div className="space-y-4">
                    {coupons.map((coupon) => (
                      <div
                        key={coupon.id}
                        className="bg-slate-950 border border-slate-900 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-850 transition-all duration-300"
                      >
                        {/* Cutouts dec */}
                        <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-slate-950 border border-slate-900 rounded-full" />
                        <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-slate-950 border border-slate-900 rounded-full" />

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Descuento
                            </span>
                            <span className="text-slate-500 font-extrabold">
                              Validez: {new Date(coupon.valid_until).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="text-center py-1">
                            <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                              {coupon.discount_percent}% OFF
                            </span>
                          </div>
                          <div className="pt-2 border-t border-dashed border-slate-900 flex flex-col items-center gap-1.5">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Código</span>
                            <span className="text-xs font-black tracking-widest text-slate-200 select-all bg-slate-900 px-3 py-1 rounded border border-slate-850 w-full text-center">
                              {coupon.code}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Care recommendations card */}
              <section className="bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-cyan-950/20 border border-slate-900 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350">Cuidado Visual</h3>
                <ul className="space-y-3.5 text-xs text-slate-400 leading-relaxed list-disc list-inside">
                  <li>Limpia tus lentes con líquido especial y microfibra para proteger el tratamiento antireflejante.</li>
                  <li>Aplica la regla 20-20-20 al trabajar con pantallas: cada 20 minutos, mira a un objeto a 6 metros por 20 segundos.</li>
                  <li>Usa lentes solares con protección UV al salir al aire libre.</li>
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
