'use client'

import { useActionState } from 'react'
import { changePassword, logout } from '@/app/auth/actions'

const initialState = {
  error: null as string | null,
}

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-slate-100 p-4">
      {/* Visual background decorations */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-rose-950/5">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 mb-4 animate-bounce">
            <svg
              className="w-8 h-8 text-slate-950"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-rose-200 to-rose-400 bg-clip-text text-transparent">
            Actualizar Contraseña
          </h1>
          <p className="text-xs text-slate-400 mt-3 font-semibold leading-relaxed px-2">
            Por motivos de seguridad, debes cambiar la contraseña temporal asignada en tu primer inicio de sesión.
          </p>
        </div>

        {/* Change Password Form */}
        <form action={formAction} className="space-y-5">
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
            >
              Nueva Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              disabled={isPending}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/80 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
            >
              Confirmar Nueva Contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              disabled={isPending}
              placeholder="Confirma tu contraseña"
              className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/80 transition-all disabled:opacity-50"
            />
          </div>

          {/* Feedback */}
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-xs font-semibold text-red-400 leading-normal">
                {state.error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-amber-400 via-rose-400 to-rose-600 hover:from-amber-300 hover:to-rose-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Actualizando...</span>
              </>
            ) : (
              <span>Actualizar y Continuar</span>
            )}
          </button>
        </form>

        {/* Exit Option: Logout Form */}
        <div className="mt-6 pt-4 border-t border-slate-850 flex justify-center">
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-rose-400 font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Cancelar y Cerrar Sesión
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
