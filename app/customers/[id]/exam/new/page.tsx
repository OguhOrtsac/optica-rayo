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

const inputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm text-[#111c2d] placeholder-[#737784]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const labelClasses = 'block text-[13px] font-semibold text-[#434653] mb-2'

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
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando expediente del cliente...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20">
          <div className="w-16 h-16 bg-[#ffdad6] rounded-full flex items-center justify-center mx-auto text-[#ba1a1a]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#111c2d]">El cliente no fue encontrado</h2>
          <Link href="/customers" className="inline-flex items-center justify-center min-h-[44px] text-sm font-bold text-[#00357f] hover:text-[#00509e] transition-colors">
            Volver a clientes
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/customers/${customerId}`} className="w-11 h-11 shrink-0 bg-white hover:bg-[#dee8ff]/30 border border-[#dee8ff] rounded-xl flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-[#434653]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111c2d]">Nuevo Examen Clínico</h1>
            <p className="text-sm text-[#737784] mt-0.5">Cliente: <strong className="text-[#111c2d] font-semibold">{customer.full_name}</strong></p>
          </div>
        </div>

        {/* Feedback Messages */}
        {state?.success && (
          <div className="bg-[#e2f9ee] rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-[#00422b] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-[#00422b]">¡Examen guardado exitosamente!</p>
              <p className="text-xs text-[#00422b] opacity-80 mt-0.5">Redirigiendo de vuelta al expediente clínico...</p>
            </div>
          </div>
        )}
        {state?.error && (
          <div className="bg-[#ffdad6] rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-[#ba1a1a] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-[#ba1a1a]">{state.error}</p>
          </div>
        )}

        <form action={formAction} className="space-y-6">
          <input type="hidden" name="customerId" value={customerId} />

          {/* OJO DERECHO (OD) */}
          <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00357f]" />
              <h2 className="text-base font-bold text-[#111c2d]">Ojo Derecho (OD)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClasses}>Esfera</label>
                <input name="od_sphere" type="number" step="0.25" disabled={isPending} placeholder="Ej. -1.25"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Cilindro</label>
                <input name="od_cylinder" type="number" step="0.25" disabled={isPending} placeholder="Ej. -0.50"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Eje (°)</label>
                <input name="od_axis" type="number" min="0" max="180" disabled={isPending} placeholder="Ej. 90"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Adición</label>
                <input name="od_add" type="number" step="0.25" min="0" disabled={isPending} placeholder="Ej. 2.00"
                  className={inputClasses} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Agudeza Visual</label>
                <input name="od_visual_acuity" type="text" disabled={isPending} placeholder="Ej. 20/20 o 20/30"
                  className={inputClasses} />
              </div>
            </div>
          </section>

          {/* OJO IZQUIERDO (OI) */}
          <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00509e]" />
              <h2 className="text-base font-bold text-[#111c2d]">Ojo Izquierdo (OI)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClasses}>Esfera</label>
                <input name="oi_sphere" type="number" step="0.25" disabled={isPending} placeholder="Ej. -1.00"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Cilindro</label>
                <input name="oi_cylinder" type="number" step="0.25" disabled={isPending} placeholder="Ej. -0.25"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Eje (°)</label>
                <input name="oi_axis" type="number" min="0" max="180" disabled={isPending} placeholder="Ej. 85"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Adición</label>
                <input name="oi_add" type="number" step="0.25" min="0" disabled={isPending} placeholder="Ej. 2.00"
                  className={inputClasses} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Agudeza Visual</label>
                <input name="oi_visual_acuity" type="text" disabled={isPending} placeholder="Ej. 20/20 o 20/40"
                  className={inputClasses} />
              </div>
            </div>
          </section>

          {/* DATOS ADICIONALES Y RECOMENDACIÓN */}
          <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0899c9]" />
              <h2 className="text-base font-bold text-[#111c2d]">Datos Ópticos y Recomendaciones</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Distancia Pupilar (Lejana - mm)</label>
                <input name="pd_distance" type="number" step="0.1" disabled={isPending} placeholder="Ej. 62"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Distancia Pupilar (Cercana - mm)</label>
                <input name="pd_near" type="number" step="0.1" disabled={isPending} placeholder="Ej. 59"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Presión Intraocular OD (mmHg)</label>
                <input name="intraocular_pressure_od" type="number" step="0.1" disabled={isPending} placeholder="Ej. 14.5"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Presión Intraocular OI (mmHg)</label>
                <input name="intraocular_pressure_oi" type="number" step="0.1" disabled={isPending} placeholder="Ej. 15.0"
                  className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Tipo de Lente Sugerido</label>
                <select name="lens_type" disabled={isPending}
                  className={inputClasses}>
                  <option value="ninguno">Ninguno</option>
                  <option value="monofocal">Monofocal</option>
                  <option value="bifocal">Bifocal</option>
                  <option value="progresivo">Progresivo</option>
                  <option value="contacto">Lentes de Contacto</option>
                </select>
              </div>
              <div>
                <label className={labelClasses}>Tratamiento Sugerido</label>
                <input name="treatment" type="text" disabled={isPending} placeholder="Ej. Antireflejante, Fotocromático"
                  className={inputClasses} />
              </div>
            </div>

            <div>
              <label className={labelClasses}>Armazón Recomendado</label>
              <input name="frame_recommendation" type="text" disabled={isPending} placeholder="Ej. Armazón metálico de pasta rectangular negro"
                className={inputClasses} />
            </div>

            <div>
              <label className={labelClasses}>Próxima Cita Sugerida</label>
              <input name="next_exam_date" type="date" disabled={isPending}
                className={inputClasses} />
            </div>

            <div>
              <label className={labelClasses}>Observaciones Clínicas</label>
              <textarea name="clinical_notes" rows={3} disabled={isPending} placeholder="Detalles de salud ocular, patologías o sugerencias especiales..."
                className={`${inputClasses} resize-none`} />
            </div>
          </section>

          {/* GUARDAR BUTTON */}
          <button type="submit" disabled={isPending || !!state?.success}
            className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[48px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
