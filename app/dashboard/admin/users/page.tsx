'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createUserAction } from '@/app/auth/actions'

const initialState = {
  error: null as string | null,
  success: null as string | null,
}

export default function RegisterUsersPage() {
  const [state, formAction, isPending] = useActionState(createUserAction as any, initialState)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative flex flex-col items-center justify-center">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative">
        
        {/* Header and Back navigation */}
        <div className="flex flex-col gap-2 mb-8">
          <Link
            href="/dashboard/admin"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel Administrativo
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mt-2">
            Registrar Nuevo Usuario
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Da de alta a dueños, vendedores y clientes asignándoles un nombre de usuario de acceso.
          </p>
        </div>

        {/* User Registration Form */}
        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="fullName" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-2">
              Nombre Completo
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              disabled={isPending}
              placeholder="Ej. Hugo Ortsac"
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-2">
              Nombre de Usuario (Acceso)
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              disabled={isPending}
              placeholder="Ej. hugo"
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-2">
                Contraseña Inicial
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                disabled={isPending}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-2">
                Rol del Usuario
              </label>
              <select
                id="role"
                name="role"
                disabled={isPending}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
              >
                <option value="owner">Dueño (Owner)</option>
                <option value="seller">Vendedor (Seller)</option>
                <option value="customer">Cliente (Customer)</option>
              </select>
            </div>
          </div>

          {/* Feedback messages */}
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs font-semibold text-red-400 leading-normal">{state.error}</p>
            </div>
          )}

          {state?.success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-emerald-400 leading-normal">{state.success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? 'Registrando...' : 'Dar de Alta Usuario'}
          </button>
        </form>
      </div>
    </main>
  )
}
