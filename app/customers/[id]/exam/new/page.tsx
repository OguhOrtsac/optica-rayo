'use client'

import * as React from 'react'
import { useEffect, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomerById } from '@/lib/services'
import { createClinicalExamAction, CreateExamState } from '@/app/customers/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

const initialState: CreateExamState = { error: null, success: null, examId: null }

export default function NewExamPage({ params }: PageProps) {
  const { id: customerId } = React.use(params)
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [state, formAction, isPending] = useActionState<CreateExamState, FormData>(createClinicalExamAction, initialState)

  useEffect(() => {
    async function loadCustomer() {
      try {
        const custData = await getCustomerById(customerId)
        setCustomer(custData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadCustomer()
  }, [customerId])

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        router.push(`/customers/${customerId}`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state?.success, customerId, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Cargando expediente del paciente...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">El paciente no fue encontrado</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
            Volver a pacientes
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24">
      {/* Background radial glow */}
      <div className="fixed top-20 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto space-y-6 relative">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/customers/${customerId}`} className="w-9 h-9 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Nuevo Examen Clínico</h1>
            <p className="text-xs text-slate-500 mt-0.5">Paciente: <strong className="text-slate-300">{customer.full_name}</strong></p>
          </div>
        </div>

        {/* Feedback Messages */}
        {state?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-400">¡Examen guardado exitosamente!</p>
              <p className="text-xs text-emerald-500/80 mt-0.5">Redirigiendo de vuelta al expediente clínico...</p>
            </div>
          </div>
        )}
        {state?.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-rose-400">{state.error}</p>
          </div>
        )}

        <form action={formAction} className="space-y-6">
          <input type="hidden" name="customerId" value={customerId} />

          {/* OJO DERECHO (OD) */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Ojo Derecho (OD)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Esfera</label>
                <input name="od_sphere" type="number" step="0.25" disabled={isPending} placeholder="Ej. -1.25"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cilindro</label>
                <input name="od_cylinder" type="number" step="0.25" disabled={isPending} placeholder="Ej. -0.50"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Eje (°)</label>
                <input name="od_axis" type="number" min="0" max="180" disabled={isPending} placeholder="Ej. 90"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Adición</label>
                <input name="od_add" type="number" step="0.25" min="0" disabled={isPending} placeholder="Ej. 2.00"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Agudeza Visual</label>
                <input name="od_visual_acuity" type="text" disabled={isPending} placeholder="Ej. 20/20 o 20/30"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
            </div>
          </section>

          {/* OJO IZQUIERDO (OI) */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Ojo Izquierdo (OI)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Esfera</label>
                <input name="oi_sphere" type="number" step="0.25" disabled={isPending} placeholder="Ej. -1.00"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cilindro</label>
                <input name="oi_cylinder" type="number" step="0.25" disabled={isPending} placeholder="Ej. -0.25"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Eje (°)</label>
                <input name="oi_axis" type="number" min="0" max="180" disabled={isPending} placeholder="Ej. 85"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Adición</label>
                <input name="oi_add" type="number" step="0.25" min="0" disabled={isPending} placeholder="Ej. 2.00"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Agudeza Visual</label>
                <input name="oi_visual_acuity" type="text" disabled={isPending} placeholder="Ej. 20/20 o 20/40"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
            </div>
          </section>

          {/* DATOS ADICIONALES Y RECOMENDACIÓN */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Datos Ópticos y Recomendaciones</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Distancia Pupilar (Lejana - mm)</label>
                <input name="pd_distance" type="number" step="0.1" disabled={isPending} placeholder="Ej. 62"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Distancia Pupilar (Cercana - mm)</label>
                <input name="pd_near" type="number" step="0.1" disabled={isPending} placeholder="Ej. 59"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Presión Intraocular OD (mmHg)</label>
                <input name="intraocular_pressure_od" type="number" step="0.1" disabled={isPending} placeholder="Ej. 14.5"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Presión Intraocular OI (mmHg)</label>
                <input name="intraocular_pressure_oi" type="number" step="0.1" disabled={isPending} placeholder="Ej. 15.0"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Lente Sugerido</label>
                <select name="lens_type" disabled={isPending}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50">
                  <option value="ninguno">Ninguno</option>
                  <option value="monofocal">Monofocal</option>
                  <option value="bifocal">Bifocal</option>
                  <option value="progresivo">Progresivo</option>
                  <option value="contacto">Lentes de Contacto</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tratamiento Sugerido</label>
                <input name="treatment" type="text" disabled={isPending} placeholder="Ej. Antireflejante, Fotocromático"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Armazón Recomendado</label>
              <input name="frame_recommendation" type="text" disabled={isPending} placeholder="Ej. Armazón metálico de pasta rectangular negro"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Próxima Cita Sugerida</label>
              <input name="next_exam_date" type="date" disabled={isPending}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Observaciones Clínicas</label>
              <textarea name="clinical_notes" rows={3} disabled={isPending} placeholder="Detalles de salud ocular, patologías o sugerencias especiales..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all disabled:opacity-50 resize-none" />
            </div>
          </section>

          {/* GUARDAR BUTTON */}
          <button type="submit" disabled={isPending || !!state?.success}
            className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold py-4 px-4 rounded-2xl shadow-lg shadow-cyan-500/15 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Guardando Examen...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Guardar Examen Clínico
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
