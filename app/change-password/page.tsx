'use client'

import { useActionState } from 'react'
import { changePassword, logout } from '@/app/auth/actions'
import { Key, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react'

const initialState = {
  error: null as string | null,
}

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#f9f9ff] text-[#111c2d] p-4 relative overflow-hidden">
      
      {/* Light soft ambient shapes */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-[#dee8ff] rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#dee8ff]/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm space-y-6 text-left">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-[#dee8ff] text-[#00357f] rounded-2xl flex items-center justify-center shadow-sm mb-4">
            <Key className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-[#00357f]">
            Actualizar Contraseña
          </h1>
          <p className="text-xs text-[#737784] mt-2 font-medium leading-relaxed px-2">
            Por motivos de seguridad, debes cambiar la contraseña temporal asignada en tu primer inicio de sesión.
          </p>
        </div>

        {/* Change Password Form */}
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2"
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
              className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2"
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
              className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* Feedback */}
          {state?.error && (
            <div className="bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-lg p-3.5 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
              <p className="text-xs font-semibold text-[#ba1a1a] leading-normal">
                {state.error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3.5 px-4 rounded-lg shadow-sm focus:outline-none transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase"
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Actualizando...</span>
              </>
            ) : (
              <span>Actualizar y Continuar</span>
            )}
          </button>
        </form>

        {/* Exit Option: Logout Form */}
        <div className="pt-4 border-t border-[#cbd5e1]/40 flex justify-center">
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-[#737784] hover:text-[#ba1a1a] font-bold tracking-wide transition-colors cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cancelar y Cerrar Sesión
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
