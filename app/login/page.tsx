'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, registerPatient } from '@/app/auth/actions'
import { syncWishlist } from '@/lib/services'
import { Sparkles, ArrowRight, UserPlus, LogIn, Lock, Mail, User, X } from 'lucide-react'

const initialLoginState = {
  error: null as string | null,
}

const initialRegisterState = {
  error: null as string | null,
  success: false as boolean,
  userId: undefined as string | undefined
}

export default function LoginPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  // Hooks for actions
  const [loginState, loginFormAction, isLoginPending] = useActionState(login, initialLoginState)
  const [registerState, registerFormAction, isRegisterPending] = useActionState(registerPatient, initialRegisterState)

  // Redirect client side on registration success, triggering wishlist migration
  useEffect(() => {
    if (registerState?.success) {
      async function migrateWishlist() {
        try {
          const localWishlist = localStorage.getItem('optica_rayo_wishlist')
          const userId = registerState.userId || 'guest_user'
          
          if (localWishlist) {
            const productIds: string[] = JSON.parse(localWishlist)
            if (productIds.length > 0) {
              await syncWishlist(userId, productIds)
              console.log('✅ Favoritos del Invitado migrados correctamente a la cuenta del Paciente:', productIds)
              localStorage.removeItem('optica_rayo_wishlist') // Clean local guest data
            }
          }
        } catch (e) {
          console.error('Error al migrar favoritos en el registro:', e)
        } finally {
          router.replace('/dashboard/customer')
        }
      }
      migrateWishlist()
    }
  }, [registerState, router])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-radial from-slate-900 via-slate-955 to-black text-slate-100 p-4 relative overflow-hidden">
      {/* High-end design visual backdrops */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-cyan-950/15 space-y-8">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/10 mb-4 animate-pulse">
            <Sparkles className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-350 to-indigo-400 bg-clip-text text-transparent">
            Óptica Rayo
          </h1>
          <p className="text-xs text-slate-450 mt-1 font-bold uppercase tracking-widest">
            Portal Digital Clínico & POS
          </p>
        </div>

        {/* Sliding Tab Switcher */}
        <div className="bg-slate-955 border border-slate-850 p-1 rounded-2xl flex relative">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer z-10 ${
              activeTab === 'login' 
                ? 'text-cyan-400 bg-slate-900 border border-slate-800/40 shadow-inner' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <LogIn className="w-4 h-4" /> Iniciar Sesión
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer z-10 ${
              activeTab === 'register' 
                ? 'text-cyan-400 bg-slate-900 border border-slate-800/40 shadow-inner' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Crear Cuenta
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'login' ? (
          /* LOGIN FORM */
          <form action={loginFormAction} className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Usuario / Correo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  disabled={isLoginPending}
                  autoComplete="username"
                  placeholder="carlos o vendedora"
                  className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isLoginPending}
                  placeholder="••••••••"
                  className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            {loginState?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
                <X className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-xs font-bold text-red-450 leading-normal">
                  {loginState.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoginPending}
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-550 text-slate-955 font-black py-4 px-4 rounded-2xl shadow-lg shadow-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {isLoginPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                  <span>Accediendo...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Portal</span>
                  <ArrowRight className="w-4 h-4 text-slate-955" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* PATIENT REGISTER FORM */
          <form action={registerFormAction} className="space-y-4 animate-in fade-in duration-200">
            
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Nombre Completo *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  disabled={isRegisterPending}
                  placeholder="Ej: Carlos Mendoza"
                  className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reg-email" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Nombre de Usuario o Correo *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="reg-email"
                  name="email"
                  type="text"
                  required
                  disabled={isRegisterPending}
                  placeholder="Ej: carlosmendoza o mail@optica.com"
                  className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="reg-password" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Contraseña *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="reg-password"
                    name="password"
                    type="password"
                    required
                    disabled={isRegisterPending}
                    placeholder="••••••"
                    className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-10 pr-3 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Confirmar *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={isRegisterPending}
                    placeholder="••••••"
                    className="w-full bg-slate-955/80 border border-slate-850 rounded-2xl pl-10 pr-3 py-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50 min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            {registerState?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
                <X className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-xs font-bold text-red-450 leading-normal">
                  {registerState.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegisterPending}
              className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-550 hover:from-emerald-400 hover:to-cyan-450 text-slate-955 font-black py-4 px-4 rounded-2xl shadow-lg shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {isRegisterPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                  <span>Creando Cuenta...</span>
                </>
              ) : (
                <>
                  <span>Registrarme & Ingresar</span>
                  <UserPlus className="w-4 h-4 text-slate-955" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
