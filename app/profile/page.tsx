'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateProfile, logout, getProfileData } from '@/app/auth/actions'
import { User, Shield, ShieldAlert, LogOut, CheckCircle, ArrowLeft, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { dashboardHrefForRole, isAdminRole, normalizeRole, roleLabel } from '@/lib/roles'

const initialState = {
  error: null as string | null,
  success: null as string | null,
}

const inputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-[13px] text-[#111c2d] placeholder-[#737784]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const labelClasses = 'block text-xs font-semibold text-[#434653] mb-2'

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

  // Collapsible cards: account starts open (it is the main one); staff
  // management starts closed and opens with one click. «Datos de la
  // óptica» is NOT here anymore: it moved to its own page inside
  // Configuración (owner's order, 2026-11-19).
  const [accountOpen, setAccountOpen] = useState(true)
  const [staffOpen, setStaffOpen] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfileData()
        setProfileData(data as any)
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

  const getRoleBadgeLabel = (role: string) => roleLabel(role)

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-[#ffdad6] text-[#ba1a1a]',
      owner: 'bg-[#dee8ff] text-[#00357f]',
      optometrist: 'bg-[#e2f9ee] text-[#00422b]',
      seller: 'bg-[#dee8ff] text-[#00509e]',
      customer: 'bg-[#f0f3ff] text-[#434653]',
    }
    return colors[normalizeRole(role)] || 'bg-[#f0f3ff] text-[#434653]'
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
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-[13px] text-[#737784] font-medium">Cargando perfil...</p>
        </div>
      </main>
    )
  }

  if (!profileData) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d] p-4">
        <div className="text-center space-y-4 max-w-sm w-full bg-white p-6 rounded-[20px] or-shadow-card">
          <p className="text-[#434653] font-semibold text-[13px]">No se pudo cargar el perfil.</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full bg-[#ba1a1a] hover:bg-[#93000a] text-white px-4 min-h-[44px] rounded-xl text-[13px] font-bold transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-4 max-w-3xl mx-auto pb-24 md:pb-8 text-left">

      {/* Back link */}
      <div>
        <Link
          href={dashboardHrefForRole(profileData.role)}
          className="inline-flex items-center gap-2 min-h-[44px] text-[13px] font-semibold text-[#434653] hover:text-[#00357f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel Principal
        </Link>
      </div>

      <div className="space-y-4">

        {/* Profile Header Card (compact, single row) */}
        <div className="bg-white rounded-[20px] or-shadow-card p-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 shrink-0 bg-[#00357f] text-white rounded-full flex items-center justify-center font-extrabold text-base select-none">
              {getInitials(profileData.fullName || profileData.username)}
            </div>

            {/* Name, username & role */}
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-[#111c2d] leading-tight truncate">
                {profileData.fullName || profileData.username}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <p className="text-xs text-[#434653] font-medium">
                  @{profileData.username}
                </p>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getRoleBadgeColor(profileData.role)}`}>
                  {getRoleBadgeLabel(profileData.role)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Form (collapsible, open by default) */}
        <div className="bg-white rounded-[20px] or-shadow-card overflow-hidden">
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            aria-expanded={accountOpen}
            className="w-full flex items-center gap-2 px-5 py-4 min-h-[52px] text-left cursor-pointer"
          >
            <User className="w-[18px] h-[18px] text-[#00357f] shrink-0" />
            <h2 className="flex-1 text-[15px] font-bold text-[#111c2d]">
              Editar Datos de Cuenta
            </h2>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${accountOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {accountOpen && (
            <div className="px-5 pb-5 pt-4 border-t border-[#e7eeff] space-y-4 animate-in fade-in duration-150">

          {/* Feedback Messages */}
          {state?.success && (
            <div className="bg-[#e2f9ee] rounded-xl p-3 flex items-center gap-3">
              <CheckCircle className="w-[18px] h-[18px] text-[#00422b] shrink-0" />
              <p className="text-[13px] font-semibold text-[#00422b] leading-normal">
                {state.success}
              </p>
            </div>
          )}
          {state?.error && (
            <div className="bg-[#ffdad6] rounded-xl p-3 flex items-center gap-3">
              <ShieldAlert className="w-[18px] h-[18px] text-[#ba1a1a] shrink-0" />
              <p className="text-[13px] font-semibold text-[#ba1a1a] leading-normal">
                {state.error}
              </p>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className={labelClasses}>
                Nombre Completo
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profileData.fullName}
                disabled={isPending}
                placeholder="Tu nombre completo"
                className={inputClasses}
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className={labelClasses}>
                Nombre de Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={profileData.username}
                disabled={isPending}
                placeholder="nombre_usuario"
                className={inputClasses}
              />
              <p className="text-[11px] text-[#737784] mt-2 font-medium">
                Se usa para iniciar sesión en la plataforma óptica.
              </p>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-[#e7eeff]" />
              <span className="text-[11px] text-[#737784] font-semibold">Cambiar Contraseña</span>
              <div className="h-px flex-1 bg-[#e7eeff]" />
            </div>

            {/* Current Password — required ONLY to change the password:
                the server re-authenticates with it before applying the
                new one (owner's order, 2026-11-19: asking only for the
                new password was unsafe). */}
            <div>
              <label htmlFor="currentPassword" className={labelClasses}>
                Contraseña Actual
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                disabled={isPending}
                placeholder="Solo si vas a cambiar tu contraseña"
                autoComplete="current-password"
                className={inputClasses}
              />
              <p className="text-[11px] text-[#737784] mt-2 font-medium">
                Por seguridad, el cambio de contraseña exige primero tu contraseña actual.
              </p>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className={labelClasses}>
                Nueva Contraseña
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                disabled={isPending}
                placeholder="Dejar vacío para no cambiar"
                minLength={6}
                autoComplete="new-password"
                className={inputClasses}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmNewPassword" className={labelClasses}>
                Confirmar Nueva Contraseña
              </label>
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                disabled={isPending}
                placeholder="Repite la nueva contraseña"
                minLength={6}
                autoComplete="new-password"
                className={inputClasses}
              />
            </div>

            {/* Save Button — every signed-in user edits their OWN
                profile, the Super Admin included (owner's order,
                2026-11-19: his profile was locked before). */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[44px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-[13px]"
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
          </form>
            </div>
          )}
        </div>

        {/* Staff Management Quick Link (admin only, collapsible, closed by default) */}
        {isAdminRole(profileData.role) && (
          <div className="bg-white rounded-[20px] or-shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => setStaffOpen((v) => !v)}
              aria-expanded={staffOpen}
              className="w-full flex items-center gap-2 px-5 py-4 min-h-[52px] text-left cursor-pointer"
            >
              <User className="w-[18px] h-[18px] text-[#00357f] shrink-0" />
              <h2 className="flex-1 text-[15px] font-bold text-[#111c2d]">
                Gestión de Personal
              </h2>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${staffOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {staffOpen && (
              <div className="px-5 pb-5 pt-4 border-t border-[#e7eeff] space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-[#434653] font-medium">
                    Administra los empleados, sus roles y accesos al sistema desde el panel de gestión de personal.
                  </p>
                  <Link href="/dashboard/admin/users"
                    className="inline-flex items-center min-h-[44px] shrink-0 text-[13px] font-bold text-[#00357f] hover:underline">Ver todo</Link>
                </div>
                <Link href="/dashboard/admin/users"
                  className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-[#f0f3ff] hover:bg-[#dee8ff] text-[#00357f] px-4 py-3 rounded-xl font-bold text-[13px] transition-colors">
                  <Shield className="w-4 h-4" />
                  Ir a Gestión de Personal
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Logout Section (compact, single row) */}
        <div className="bg-white rounded-[20px] or-shadow-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <h3 className="text-sm font-bold text-[#111c2d]">Cerrar Sesión</h3>
              <p className="text-[11px] text-[#434653] mt-0.5 font-medium">
                Finalizar la sesión activa
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] hover:text-[#93000a] px-4 min-h-[38px] rounded-xl text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2"
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
