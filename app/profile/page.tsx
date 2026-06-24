'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateProfile, logout, getProfileData, updateThemeAction } from '@/app/auth/actions'

const initialState = {
  error: null as string | null,
  success: null as string | null,
}

export default function ProfilePage() {
  const [state, formAction, isPending] = useActionState(updateProfile, initialState)
  const [profileData, setProfileData] = useState<{
    username: string
    fullName: string
    role: string
    email: string
    isSuperAdmin: boolean
    bg_theme: 'dark' | 'light'
  } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [activeTheme, setActiveTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfileData()
        setProfileData(data as any)
        if (data) {
          setActiveTheme(data.bg_theme)
        }
      } catch {
        setProfileData(null)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
  }, [])

  // Re-fetch after successful save
  useEffect(() => {
    if (state?.success) {
      async function refreshProfile() {
        try {
          const data = await getProfileData()
          setProfileData(data as any)
        } catch {
          // Keep existing data
        }
      }
      refreshProfile()
    }
  }, [state?.success])

  const handleThemeChange = async (theme: 'dark' | 'light') => {
    setActiveTheme(theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    await updateThemeAction(theme)
  }

  const getRoleBadgeLabel = (role: string) => {
    const labels: Record<string, string> = {
      dev: 'Desarrollador',
      owner: 'Dueño',
      seller: 'Vendedor',
      customer: 'Cliente',
      superadmin: 'Super Admin',
    }
    return labels[role] || role
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      dev: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
      owner: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
      seller: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      customer: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      superadmin: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    }
    return colors[role] || 'bg-slate-500/15 text-slate-400 border-slate-500/25'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loadingProfile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
          <p className="text-sm text-slate-500 font-medium">Cargando perfil...</p>
        </div>
      </main>
    )
  }

  if (!profileData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="text-center space-y-4">
          <p className="text-slate-400">No se pudo cargar el perfil.</p>
          <form action={logout}>
            <button
              type="submit"
              className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      {/* Visual background decorations */}
      <div className="fixed top-20 right-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-10 left-10 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto space-y-8 relative">

        {/* Profile Header Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 text-center space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center shadow-xl shadow-cyan-500/15">
              <span className="text-2xl font-black text-slate-950 select-none">
                {getInitials(profileData.fullName || profileData.username)}
              </span>
            </div>
          </div>

          {/* Name & Role */}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              {profileData.fullName || profileData.username}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              @{profileData.username}
            </p>
          </div>

          <div className="flex justify-center">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadgeColor(profileData.role)}`}>
              {getRoleBadgeLabel(profileData.role)}
            </span>
          </div>

          {/* Theme switcher */}
          {!profileData.isSuperAdmin && (
            <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tema de Fondo
              </span>
              <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTheme === 'dark'
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold'
                      : 'text-slate-500 hover:text-slate-350'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Oscuro
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTheme === 'light'
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold'
                      : 'text-slate-500 hover:text-slate-350'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                  Claro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Form */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">
              Editar Perfil
            </h2>
          </div>

          {/* Feedback Messages */}
          {state?.success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 animate-in">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-emerald-400 leading-normal">
                {state.success}
              </p>
            </div>
          )}
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs font-semibold text-red-400 leading-normal">
                {state.error}
              </p>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Nombre Completo
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profileData.fullName}
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Tu nombre completo"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50"
              />
            </div>

            {/* Username (read-only display) */}
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Nombre de Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={profileData.username}
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="nombre_usuario"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-600 mt-1.5 font-medium">
                Se usa para iniciar sesión. Puedes escribir solo tu usuario o un correo completo.
              </p>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Cambiar Contraseña</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Nueva Contraseña
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Dejar vacío para no cambiar"
                minLength={6}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmNewPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Confirmar Nueva Contraseña
              </label>
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Repite la nueva contraseña"
                minLength={6}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition-all disabled:opacity-50"
              />
            </div>

            {/* Save Button */}
            {!profileData.isSuperAdmin && (
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            )}

            {profileData.isSuperAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-xs font-semibold text-amber-400">
                  El perfil de Super Admin no se puede modificar.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Logout Section */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-rose-500/10 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-sm font-bold text-slate-300">Cerrar Sesión</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Finalizar la sesión activa y volver al inicio de sesión.
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/30 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  )
}
