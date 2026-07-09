'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateProfile, logout, getProfileData, updateThemeAction } from '@/app/auth/actions'
import { User, Shield, ShieldAlert, Key, LogOut, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
      owner: 'Dueño / Administrador',
      seller: 'Vendedor',
      customer: 'Cliente',
      superadmin: 'Super Admin',
    }
    return labels[role] || role
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      dev: 'bg-[#dee8ff]/80 text-[#00668a]',
      owner: 'bg-[#dee8ff] text-[#00357f]',
      seller: 'bg-[#dee8ff]/60 text-[#00668a]',
      customer: 'bg-[#dee8ff]/40 text-[#00668a]',
      superadmin: 'bg-[#ffdad6] text-[#ba1a1a]',
    }
    return colors[role] || 'bg-slate-100 text-slate-655'
  }

  const getInitials = (name: string) => {
    if (!name) return 'PT'
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loadingProfile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f9f9ff] text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-sm text-[#737784] font-medium">Cargando perfil...</p>
        </div>
      </main>
    )
  }

  if (!profileData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f9f9ff] text-[#111c2d] p-4">
        <div className="text-center space-y-4 max-w-sm w-full bg-white border border-[#cbd5e1] p-6 rounded-2xl shadow-sm">
          <p className="text-[#737784] font-semibold text-xs">No se pudo cargar el perfil.</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full bg-[#ba1a1a] hover:bg-[#93000a] text-white py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Back link */}
      <div>
        <Link 
          href={profileData.role === 'owner' ? '/dashboard/admin' : profileData.role === 'seller' ? '/dashboard/seller' : '/dashboard/customer'} 
          className="inline-flex items-center gap-2 text-xs font-bold text-[#737784] hover:text-[#00357f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel Principal
        </Link>
      </div>

      <div className="space-y-6">

        {/* Profile Header Card */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-5 text-center">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-18 h-18 bg-[#dee8ff] text-[#00357f] rounded-full flex items-center justify-center font-black text-xl select-none">
              {getInitials(profileData.fullName || profileData.username)}
            </div>
          </div>

          {/* Name & Role */}
          <div>
            <h1 className="text-xl font-extrabold text-[#111c2d]">
              {profileData.fullName || profileData.username}
            </h1>
            <p className="text-xs text-[#737784] font-medium mt-0.5">
              @{profileData.username}
            </p>
          </div>

          <div className="flex justify-center">
            <span className={`px-3 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${getRoleBadgeColor(profileData.role)}`}>
              {getRoleBadgeLabel(profileData.role)}
            </span>
          </div>

          {/* Theme switcher */}
          {!profileData.isSuperAdmin && (
            <div className="pt-4 border-t border-[#cbd5e1]/40 flex items-center justify-between">
              <span className="text-xs font-bold text-[#737784] uppercase tracking-wider">
                Tema de Fondo
              </span>
              <div className="flex items-center gap-2 bg-[#f0f3ff] p-1 rounded-xl border border-[#cbd5e1] shadow-sm">
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTheme === 'dark'
                      ? 'bg-white text-[#00357f] shadow-sm font-black'
                      : 'text-[#737784] hover:text-[#111c2d]'
                  }`}
                >
                  Oscuro
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTheme === 'light'
                      ? 'bg-white text-[#00357f] shadow-sm font-black'
                      : 'text-[#737784] hover:text-[#111c2d]'
                  }`}
                >
                  Claro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Form */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#f0f3ff] pb-3">
            <User className="w-5 h-5 text-[#00357f]" />
            <h2 className="text-xs font-bold text-[#00357f] uppercase tracking-wider">
              Editar Datos de Cuenta
            </h2>
          </div>

          {/* Feedback Messages */}
          {state?.success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-600 leading-normal">
                {state.success}
              </p>
            </div>
          )}
          {state?.error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs font-semibold text-rose-600 leading-normal">
                {state.error}
              </p>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
                Nombre Completo
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profileData.fullName}
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Tu nombre completo"
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
                Nombre de Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={profileData.username}
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="nombre_usuario"
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
              />
              <p className="text-[10px] text-[#737784] mt-1.5 font-semibold">
                Se usa para iniciar sesión en la plataforma óptica.
              </p>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-[#f0f3ff]" />
              <span className="text-[9px] text-[#737784] font-black uppercase tracking-wider">Cambiar Contraseña</span>
              <div className="h-px flex-1 bg-[#f0f3ff]" />
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
                Nueva Contraseña
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Dejar vacío para no cambiar"
                minLength={6}
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmNewPassword" className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
                Confirmar Nueva Contraseña
              </label>
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Repite la nueva contraseña"
                minLength={6}
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Save Button */}
            {!profileData.isSuperAdmin && (
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase"
              >
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            )}

            {profileData.isSuperAdmin && (
              <div className="bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl p-3 text-center">
                <p className="text-xs font-black text-[#ba1a1a] uppercase tracking-wider">
                  El perfil de Super Admin no se puede modificar.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Staff Management Quick Link (admin only) */}
        {(profileData.role === 'owner' || profileData.role === 'dev') && (
          <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0f3ff] pb-3">
              <h2 className="text-xs font-bold text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" />
                Gestión de Personal
              </h2>
              <Link href="/dashboard/admin/users"
                className="text-xs font-bold text-[#00357f] hover:underline">Ver todo</Link>
            </div>
            <p className="text-xs text-[#737784] font-medium">
              Administra los empleados, sus roles y accesos al sistema desde el panel de gestión de personal.
            </p>
            <Link href="/dashboard/admin/users"
              className="w-full flex items-center justify-center gap-2 bg-[#f0f3ff] hover:bg-[#dee8ff] border border-[#cbd5e1] text-[#00357f] py-2.5 rounded-xl font-bold text-xs transition-colors">
              <Shield className="w-4 h-4" />
              Ir a Gestión de Personal
            </Link>
          </div>
        )}

        {/* Clinic Settings Summary (admin only) */}
        {(profileData.role === 'owner' || profileData.role === 'dev') && (
          <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#cbd5e1] bg-[#f9f9ff] flex justify-between items-center">
              <h2 className="text-xs font-bold text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                Resumen del Sistema
              </h2>
            </div>
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#f0f3ff]">
                <tr className="hover:bg-[#f9f9ff] transition-colors">
                  <td className="py-3 px-5 text-[#737784] font-bold w-1/2">Plataforma</td>
                  <td className="py-3 px-5 text-[#111c2d] font-bold">OpticaRayo — OptiGest</td>
                </tr>
                <tr className="hover:bg-[#f9f9ff] transition-colors">
                  <td className="py-3 px-5 text-[#737784] font-bold">Rol de cuenta</td>
                  <td className="py-3 px-5 text-[#111c2d] font-bold">{getRoleBadgeLabel(profileData.role)}</td>
                </tr>
                <tr className="hover:bg-[#f9f9ff] transition-colors">
                  <td className="py-3 px-5 text-[#737784] font-bold">Moneda</td>
                  <td className="py-3 px-5 text-[#111c2d] font-bold">MXN ($)</td>
                </tr>
                <tr className="hover:bg-[#f9f9ff] transition-colors">
                  <td className="py-3 px-5 text-[#737784] font-bold">Base de datos</td>
                  <td className="py-3 px-5 text-[#111c2d] font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Supabase (en línea)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Logout Section */}
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-sm font-bold text-[#111c2d]">Cerrar Sesión</h3>
              <p className="text-xs text-[#737784] mt-0.5 font-medium">
                Finalizar la sesión activa y volver al inicio.
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] hover:text-[#93000a] border border-[#ba1a1a]/20 px-6 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  )
}
