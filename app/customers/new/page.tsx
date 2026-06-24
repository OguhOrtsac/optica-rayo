'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { registerCustomerAction, RegisterCustomerState } from '@/app/customers/actions'

const initialState: RegisterCustomerState = { error: null, success: null, customerId: null }

export default function NewCustomerPage() {
  const [state, formAction, isPending] = useActionState<RegisterCustomerState, FormData>(registerCustomerAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state?.customerId) {
      const timer = setTimeout(() => router.push(`/customers/${state.customerId}`), 2500)
      return () => clearTimeout(timer)
    }
  }, [state?.customerId, router])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="fixed top-20 left-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto space-y-6 relative">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/customers" className="w-9 h-9 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Nuevo Cliente</h1>
            <p className="text-xs text-slate-500 mt-0.5">Registra la cuenta y datos clínicos del paciente.</p>
          </div>
        </div>

        {/* Feedback */}
        {state?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-400">¡Cliente registrado!</p>
              <p className="text-xs text-emerald-500 mt-1">{state.success}</p>
              <p className="text-xs text-emerald-600 mt-1">Redirigiendo al expediente...</p>
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

          {/* DATOS DE ACCESO */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos de Acceso</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre Completo *
                </label>
                <input name="fullName" type="text" required disabled={isPending}
                  placeholder="Ej. Ana Sofía Gómez"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre de Usuario *
                </label>
                <input name="username" type="text" required disabled={isPending}
                  placeholder="Ej. ana_gomez"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50" />
                <p className="text-[10px] text-slate-600 mt-1.5">La contraseña inicial será: <span className="text-slate-500 font-bold">Rayo_[Nombre]</span></p>
              </div>
            </div>
          </section>

          {/* DATOS PERSONALES */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos Personales</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Teléfono</label>
                <input name="phone" type="tel" disabled={isPending}
                  placeholder="Ej. 555-123-4567"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de Nacimiento</label>
                <input name="dateOfBirth" type="date" disabled={isPending}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ocupación</label>
                <input name="occupation" type="text" disabled={isPending}
                  placeholder="Ej. Docente, Contador..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de Sangre</label>
                <select name="bloodType" disabled={isPending}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50">
                  <option value="">No especificado</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="NS">No sé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dirección</label>
              <input name="address" type="text" disabled={isPending}
                placeholder="Calle, número, colonia, ciudad"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Antecedentes Médicos</label>
              <textarea name="medicalNotes" disabled={isPending} rows={2}
                placeholder="Diabetes, hipertensión, alergias, medicamentos..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 resize-none" />
            </div>
          </section>

          {/* CONTACTO DE EMERGENCIA */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Contacto de Emergencia</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                <input name="emergencyContactName" type="text" disabled={isPending}
                  placeholder="Nombre del contacto"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Teléfono</label>
                <input name="emergencyContactPhone" type="tel" disabled={isPending}
                  placeholder="Teléfono de emergencia"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all disabled:opacity-50" />
              </div>
            </div>
          </section>

          {/* SUBMIT */}
          <button type="submit" disabled={isPending || !!state?.customerId}
            className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold py-4 px-4 rounded-2xl shadow-lg shadow-cyan-500/15 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Registrar Cliente
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
