'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateProfile, logout, getProfileData } from '@/app/auth/actions'
import { User, Shield, ShieldAlert, Store, LogOut, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { dashboardHrefForRole, isAdminRole, normalizeRole, roleLabel } from '@/lib/roles'
import {
  getBusinessSettings,
  updateBusinessSettings,
  type BusinessSettings,
} from '@/lib/services'

const initialState = {
  error: null as string | null,
  success: null as string | null,
}

const inputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm text-[#111c2d] placeholder-[#737784]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const labelClasses = 'block text-[13px] font-semibold text-[#434653] mb-2'

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

  // Business data (admin only): loaded once the profile role is known.
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [businessFeedback, setBusinessFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

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

  useEffect(() => {
    if (!profileData || !isAdminRole(profileData.role)) return
    let cancelled = false
    async function loadBusiness() {
      try {
        const data = await getBusinessSettings()
        if (!cancelled) setBusiness(data)
      } catch {
        if (!cancelled) {
          setBusinessFeedback({
            type: 'error',
            text: 'No se pudieron cargar los datos de la óptica.',
          })
        }
      }
    }
    loadBusiness()
    return () => {
      cancelled = true
    }
  }, [profileData])

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    // Hard permission check: only owner / super_admin may save, verified
    // again here in the handler — hiding the form is not the control.
    if (!profileData || !isAdminRole(profileData.role) || !business) {
      setBusinessFeedback({
        type: 'error',
        text: 'Solo un administrador puede modificar los datos de la óptica.',
      })
      return
    }
    setSavingBusiness(true)
    setBusinessFeedback(null)
    try {
      await updateBusinessSettings(business)
      setBusinessFeedback({
        type: 'success',
        text: 'Datos de la óptica guardados correctamente.',
      })
    } catch (err) {
      setBusinessFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudieron guardar los datos de la óptica.',
      })
    } finally {
      setSavingBusiness(false)
    }
  }

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
          <p className="text-sm text-[#737784] font-medium">Cargando perfil...</p>
        </div>
      </main>
    )
  }

  if (!profileData) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d] p-4">
        <div className="text-center space-y-4 max-w-sm w-full bg-white p-6 rounded-[20px] or-shadow-card">
          <p className="text-[#434653] font-semibold text-sm">No se pudo cargar el perfil.</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full bg-[#ba1a1a] hover:bg-[#93000a] text-white px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </main>
    )
  }

  const businessFields: {
    key: keyof BusinessSettings
    label: string
    type: 'text' | 'tel' | 'email'
    placeholder: string
    fullWidth?: boolean
  }[] = [
    { key: 'name', label: 'Nombre de la óptica', type: 'text', placeholder: 'Óptica Rayo' },
    { key: 'schedule', label: 'Horario de atención', type: 'text', placeholder: 'Lun - Sáb, 10:00 - 19:00' },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Calle, número y colonia', fullWidth: true },
    { key: 'city', label: 'Ciudad', type: 'text', placeholder: 'Ciudad' },
    { key: 'state', label: 'Estado', type: 'text', placeholder: 'Estado' },
    { key: 'country', label: 'País', type: 'text', placeholder: 'País' },
    { key: 'phone', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de la óptica' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: 'Número de WhatsApp' },
    { key: 'email', label: 'Correo', type: 'email', placeholder: 'correo@optica.com' },
  ]

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24 md:pb-8 text-left">

      {/* Back link */}
      <div>
        <Link
          href={dashboardHrefForRole(profileData.role)}
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[#434653] hover:text-[#00357f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel Principal
        </Link>
      </div>

      <div className="space-y-6">

        {/* Profile Header Card */}
        <div className="bg-white rounded-[20px] or-shadow-card p-6 md:p-8 space-y-4 text-center">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#00357f] text-white rounded-full flex items-center justify-center font-extrabold text-xl select-none">
              {getInitials(profileData.fullName || profileData.username)}
            </div>
          </div>

          {/* Name & Role */}
          <div>
            <h1 className="text-2xl font-extrabold text-[#111c2d]">
              {profileData.fullName || profileData.username}
            </h1>
            <p className="text-sm text-[#434653] font-medium mt-1">
              @{profileData.username}
            </p>
          </div>

          <div className="flex justify-center">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeColor(profileData.role)}`}>
              {getRoleBadgeLabel(profileData.role)}
            </span>
          </div>

        </div>

        {/* Edit Profile Form */}
        <div className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[#e7eeff] pb-3">
            <User className="w-5 h-5 text-[#00357f]" />
            <h2 className="text-base font-bold text-[#111c2d]">
              Editar Datos de Cuenta
            </h2>
          </div>

          {/* Feedback Messages */}
          {state?.success && (
            <div className="bg-[#e2f9ee] rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#00422b] shrink-0" />
              <p className="text-sm font-semibold text-[#00422b] leading-normal">
                {state.success}
              </p>
            </div>
          )}
          {state?.error && (
            <div className="bg-[#ffdad6] rounded-xl p-4 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
              <p className="text-sm font-semibold text-[#ba1a1a] leading-normal">
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
                disabled={isPending || profileData.isSuperAdmin}
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
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="nombre_usuario"
                className={inputClasses}
              />
              <p className="text-xs text-[#737784] mt-2 font-medium">
                Se usa para iniciar sesión en la plataforma óptica.
              </p>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-[#e7eeff]" />
              <span className="text-xs text-[#737784] font-semibold">Cambiar Contraseña</span>
              <div className="h-px flex-1 bg-[#e7eeff]" />
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
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Dejar vacío para no cambiar"
                minLength={6}
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
                disabled={isPending || profileData.isSuperAdmin}
                placeholder="Repite la nueva contraseña"
                minLength={6}
                className={inputClasses}
              />
            </div>

            {/* Save Button */}
            {!profileData.isSuperAdmin && (
              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[48px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm"
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
              <div className="bg-[#ffdad6] rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-[#ba1a1a]">
                  El perfil de Super Admin no se puede modificar.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Staff Management Quick Link (admin only) */}
        {isAdminRole(profileData.role) && (
          <div className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e7eeff] pb-3">
              <h2 className="text-base font-bold text-[#111c2d] flex items-center gap-2">
                <User className="w-5 h-5 text-[#00357f]" />
                Gestión de Personal
              </h2>
              <Link href="/dashboard/admin/users"
                className="inline-flex items-center min-h-[44px] text-sm font-bold text-[#00357f] hover:underline">Ver todo</Link>
            </div>
            <p className="text-sm text-[#434653] font-medium">
              Administra los empleados, sus roles y accesos al sistema desde el panel de gestión de personal.
            </p>
            <Link href="/dashboard/admin/users"
              className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-[#f0f3ff] hover:bg-[#dee8ff] text-[#00357f] px-4 py-3 rounded-xl font-bold text-sm transition-colors">
              <Shield className="w-4 h-4" />
              Ir a Gestión de Personal
            </Link>
          </div>
        )}

        {/* Business data (admin only, editable) */}
        {isAdminRole(profileData.role) && (
          <div className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#e7eeff] pb-3">
              <Store className="w-5 h-5 text-[#00357f]" />
              <h2 className="text-base font-bold text-[#111c2d]">
                Datos de la óptica
              </h2>
            </div>

            <p className="text-sm text-[#434653] font-medium">
              Estos datos identifican a la óptica en el sistema. Solo los administradores pueden modificarlos.
            </p>

            {businessFeedback && (
              <div
                className={`rounded-xl p-4 flex items-center gap-3 ${
                  businessFeedback.type === 'success' ? 'bg-[#e2f9ee]' : 'bg-[#ffdad6]'
                }`}
              >
                {businessFeedback.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-[#00422b] shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
                )}
                <p
                  className={`text-sm font-semibold leading-normal ${
                    businessFeedback.type === 'success' ? 'text-[#00422b]' : 'text-[#ba1a1a]'
                  }`}
                >
                  {businessFeedback.text}
                </p>
              </div>
            )}

            {business ? (
              <form onSubmit={handleSaveBusiness} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {businessFields.map((field) => (
                    <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : undefined}>
                      <label htmlFor={`business-${field.key}`} className={labelClasses}>
                        {field.label}
                      </label>
                      <input
                        id={`business-${field.key}`}
                        type={field.type}
                        value={business[field.key]}
                        onChange={(e) =>
                          setBusiness({ ...business, [field.key]: e.target.value })
                        }
                        disabled={savingBusiness}
                        placeholder={field.placeholder}
                        className={inputClasses}
                      />
                    </div>
                  ))}

                  {/* Currency is fixed for now (not editable in this pass) */}
                  <div>
                    <span className={labelClasses}>Moneda</span>
                    <div className="w-full bg-[#f0f3ff] rounded-xl px-4 py-3 min-h-[44px] flex items-center text-sm font-semibold text-[#434653]">
                      Peso Mexicano (MXN)
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[48px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {savingBusiness ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Guardar datos de la óptica</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              !businessFeedback && (
                <div className="flex items-center gap-3 py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00357f] border-t-transparent" />
                  <p className="text-sm text-[#737784] font-medium">Cargando datos de la óptica...</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Logout Section */}
        <div className="bg-white rounded-[20px] or-shadow-card p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-base font-bold text-[#111c2d]">Cerrar Sesión</h3>
              <p className="text-sm text-[#434653] mt-1 font-medium">
                Finalizar la sesión activa y volver al inicio.
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] hover:text-[#93000a] px-6 min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2"
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
