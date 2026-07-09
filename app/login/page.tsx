'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, registerPatient } from '@/app/auth/actions'
import { syncWishlist } from '@/lib/services'
import { ArrowRight, UserPlus, LogIn, Lock, Mail, User, X, ShieldAlert, Eye } from 'lucide-react'

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
              console.log('✅ Favoritos del Invitado migrados correctamente a la cuenta del Cliente:', productIds)
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

  // Prevent zoom (pinch-to-zoom and double-tap zoom) on mobile devices
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }
    
    let lastTouchEnd = 0
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = new Date().getTime()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }

    document.addEventListener('touchstart', preventZoom, { passive: false })
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })
    
    return () => {
      document.removeEventListener('touchstart', preventZoom)
      document.removeEventListener('touchend', preventDoubleTapZoom)
    }
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#f9f9ff] text-[#111c2d] p-4 relative overflow-hidden touch-manipulation">
      
      {/* Light soft ambient shapes */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-[#dee8ff] rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#dee8ff]/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#cbd5e1] rounded-2xl p-6 md:p-8 shadow-md text-left min-h-[calc(100dvh-2rem)] md:min-h-0 flex flex-col justify-center gap-5 touch-manipulation">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center pb-4 md:pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#00357f]">
            Óptica Rayo
          </h1>
          <p className="text-xs text-[#737784] mt-1 font-bold uppercase tracking-widest">
            App administrativa y catalogo de productos
          </p>
        </div>

        <div className="space-y-5">

        {/* Sliding Tab Switcher */}
        <div className="bg-[#f0f3ff] border border-[#cbd5e1] p-1 rounded-xl flex relative">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer z-10 ${
              activeTab === 'login' 
                ? 'text-[#00357f] bg-white border border-[#cbd5e1]/40 shadow-sm' 
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            <LogIn className="w-4 h-4" /> Iniciar Sesión
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer z-10 ${
              activeTab === 'register' 
                ? 'text-[#00357f] bg-white border border-[#cbd5e1]/40 shadow-sm' 
                : 'text-[#737784] hover:text-[#111c2d]'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Crear Cuenta
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'login' ? (
          /* LOGIN FORM */
          <form action={loginFormAction} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold text-[#434653] uppercase tracking-wider">
                Usuario / Correo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737784]">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  disabled={isLoginPending}
                  autoComplete="username"
                  placeholder="ej: carlos o vendedora"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-11 pr-4 py-3.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold text-[#434653] uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737784]">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isLoginPending}
                  placeholder="••••••••"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-11 pr-4 py-3.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            {loginState?.error && (
              <div className="bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-lg p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
                <p className="text-xs font-bold text-[#ba1a1a] leading-normal">
                  {loginState.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoginPending}
              className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer min-h-[48px] text-xs uppercase"
            >
              {isLoginPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Accediendo...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Portal</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* PATIENT REGISTER FORM */
          <form action={registerFormAction} className="space-y-4">
            
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-xs font-bold text-[#434653] uppercase tracking-wider">
                Nombre Completo *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737784]">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  disabled={isRegisterPending}
                  placeholder="Ej: Carlos Mendoza"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-11 pr-4 py-3.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reg-email" className="block text-xs font-bold text-[#434653] uppercase tracking-wider">
                Nombre de Usuario o Correo *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737784]">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="reg-email"
                  name="email"
                  type="text"
                  required
                  disabled={isRegisterPending}
                  placeholder="ej: carlos_mendoza"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-11 pr-4 py-3.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reg-password" className="block text-xs font-bold text-[#434653] uppercase tracking-wider">
                Contraseña *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737784]">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  disabled={isRegisterPending}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-11 pr-4 py-3.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
            </div>

            {registerState?.error && (
              <div className="bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-lg p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
                <p className="text-xs font-bold text-[#ba1a1a] leading-normal">
                  {registerState.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegisterPending}
              className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer min-h-[48px] text-xs uppercase"
            >
              {isRegisterPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <>
                  <span>Registrar Cuenta</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Guest Catalog Button */}
        <button
          onClick={() => router.push('/catalog')}
          className="w-full flex items-center justify-center gap-2 bg-[#f0f3ff] hover:bg-[#dee8ff] text-[#00357f] border border-[#cbd5e1] py-3.5 px-4 rounded-lg font-bold transition-colors cursor-pointer text-xs uppercase tracking-wider shadow-sm mt-2"
        >
          <Eye className="w-4 h-4" />
          Observar catalogo como invitado
        </button>

        </div>
      </div>
    </main>
  )
}
