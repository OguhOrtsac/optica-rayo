'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { invalidateProfilesCache } from '@/lib/services'
import { normalizeRole, type UserRole } from '@/lib/roles'

/**
 * Centralizes the username-to-email mapping logic.
 * If the input doesn't contain '@', appends '@opticarayo.com'.
 * If it already contains '@', uses it as-is (real email).
 */
function formatToEmail(input: string): string {
  const trimmed = input.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : `${trimmed}@opticarayo.com`
}

/**
 * Extracts a display username from an email.
 * If email ends with '@opticarayo.com', strips the domain.
 * Otherwise returns the full email.
 */
function extractUsername(email: string): string {
  return email.endsWith('@opticarayo.com')
    ? email.replace('@opticarayo.com', '')
    : email
}

/** True when a real Supabase project is configured for this server. */
function isSupabaseConfiguredServer(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Verifies that `currentPassword` really is the signed-in user's
 * CURRENT password, by re-authenticating with their own email
 * (owner's order, 2026-11-19: a self-service password change that
 * only asks for the new password is unsafe — anyone holding an open
 * session could take the account over). Returns an error message
 * when it does not match or cannot be checked; null when it checks
 * out. Nothing is modified when this returns an error.
 */
async function verifyCurrentPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  currentPassword: string
): Promise<string | null> {
  if (!email) {
    return 'No se pudo verificar la sesión actual.'
  }
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (error) {
    return 'La contraseña actual no es correcta. No se hizo ningún cambio.'
  }
  return null
}

export interface LoginState {
  error: string | null
}

export interface RegisterState {
  error: string | null
  success: boolean
  userId?: string
}

/**
 * Handles patient self-registration (Sign up).
 * The account is created in Supabase Auth or not at all: if the real
 * sign-up cannot be completed, the real failure is reported and NO
 * local/mock session or profile is issued (fake-session bypass removed
 * on 2026-11-09).
 */
export async function registerPatient(currentState: RegisterState, formData: FormData): Promise<RegisterState> {
  const email = formData.get('email') as string
  const fullName = formData.get('fullName') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!email || !fullName || !password || !confirmPassword) {
    return { error: 'Todos los campos son obligatorios.', success: false }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.', success: false }
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden.', success: false }
  }

  const formattedEmail = formatToEmail(email)

  // Try standard Supabase Sign up flow first
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: formattedEmail,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: 'customer',
        }
      }
    })

    if (!error && data.user) {
      // In Supabase trigger or code, profile is created. Double check.
      // Auto login the patient
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password: password,
      })

      if (!signInError) {
        revalidatePath('/', 'layout')
        return { success: true, error: null }
      }
    }
  } catch (err) {
    console.warn('Supabase sign up failed:', err)
  }

  // No fake local session is issued when the real sign-up cannot be
  // completed: an account either exists in Supabase Auth or it does
  // not exist at all.
  return { error: 'No se pudo crear la cuenta en este momento. Verifique sus datos o intente de nuevo.', success: false }
}

/**
 * Handles user login.
 * Supports username mapping (converts "username" to "username@opticarayo.com").
 * Incorporates a one-time Super Admin local bypass.
 */
export async function login(currentState: LoginState, formData: FormData): Promise<LoginState> {
  let email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'El nombre de usuario/correo y la contraseña son requeridos.' }
  }

  // Apply centralized username-to-email mapping
  const formattedEmail = formatToEmail(email)

  const cookieStore = await cookies()

  // Every login is a REAL Supabase Auth sign-in. There is no local
  // bypass and no hardcoded password: the Super Admin is a normal
  // Supabase Auth account whose profile carries the super_admin role
  // (the previous bypass and its burned passwords were removed on
  // 2026-11-09 by the owner's order).

  // 2. Regular Auth Flow using Supabase Client
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formattedEmail,
    password: password,
  })

  if (error) {
    return { error: 'Credenciales inválidas. Por favor intente de nuevo.' }
  }

  const user = data.user
  const temporalPasswordChanged = user.user_metadata?.temporal_password_changed ?? true

  // Get theme from profile and set cookie
  const { data: profile } = await supabase
    .from('profiles')
    .select('bg_theme')
    .eq('id', user.id)
    .single()

  const userTheme = profile?.bg_theme || 'dark'
  cookieStore.set('bg_theme', userTheme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  revalidatePath('/', 'layout')

  // Enforce password update if the user has a temporal password
  if (!temporalPasswordChanged) {
    redirect('/change-password')
  }

  redirect('/dashboard')
}

/**
 * Logs out the current user and clears active cookies.
 */
export async function logout() {
  const cookieStore = await cookies()
  
  // Clear Super Admin local bypass cookie
  cookieStore.delete('optica_rayo_superadmin_session')
  cookieStore.delete('optica_rayo_mock_role')
  cookieStore.delete('optica_rayo_mock_email')
  cookieStore.delete('optica_rayo_mock_name')

  // Clear standard Supabase session
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Updates the user's password, modifies user_metadata in auth,
 * and updates public.profiles temporal_password_changed state.
 */
export async function changePassword(currentState: any, formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !password || !confirmPassword) {
    return { error: 'Todos los campos de contraseña son obligatorios.' }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  if (!isSupabaseConfiguredServer()) {
    return { error: 'Modo demo: sin una base de datos conectada no se puede cambiar la contraseña.' }
  }

  const supabase = await createClient()

  // Get current session user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'No se pudo obtener el usuario de la sesión actual.' }
  }

  // 0. The CURRENT password is verified by re-authenticating BEFORE
  // anything changes (owner's order, 2026-11-19). In the forced
  // first-login flow the «current» password is the temporal one the
  // user just signed in with, so the flow is unchanged for them —
  // they only have to type it once more.
  const verifyError = await verifyCurrentPassword(supabase, user.email || '', currentPassword)
  if (verifyError) {
    return { error: verifyError }
  }

  // 1. Update Password in Supabase Auth and set metadata temporal_password_changed = true
  const { error: authError } = await supabase.auth.updateUser({
    password: password,
    data: { temporal_password_changed: true }
  })

  if (authError) {
    return { error: `Error al actualizar la contraseña: ${authError.message}` }
  }

  // 2. Update Database public.profiles table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ temporal_password_changed: true })
    .eq('id', user.id)

  if (dbError) {
    console.error('Database profile update failed:', dbError.message)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Server Action to register a new user in Supabase Auth and Profiles table.
 * Uses administrative privileges.
 */
export async function createUserAction(currentState: any, formData: FormData) {
  const username = formData.get('username') as string
  const fullName = formData.get('fullName') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as UserRole

  if (!username || !fullName || !password || !role) {
    return { error: 'Todos los campos del formulario son requeridos.', success: null }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.', success: null }
  }

  // Apply centralized username-to-email mapping
  const formattedEmail = formatToEmail(username)

  try {
    const adminClient = createAdminClient() as any

    // Caller gate, the same one its sibling actions
    // (adminUpdateUserAction / adminDeleteUserAction) already enforce:
    // only owner / super_admin (o el alias heredado dev) create accounts.
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', currentUser?.id || '')
      .single()
    const callerRole = currentUser?.user_metadata?.role || callerProfile?.role
    if (!callerRole || !['owner', 'dev', 'super_admin'].includes(callerRole)) {
      return { error: 'No tienes permisos para crear usuarios.', success: null }
    }

    // The platform role is never assigned from this panel — the rule
    // the Usuarios page itself prints — for any caller.
    if (normalizeRole(role) === 'super_admin') {
      return { error: 'El rol Super Administrador está reservado al equipo desarrollador y no se asigna desde este panel.', success: null }
    }

    // 1. Create the user inside Supabase Auth
    const { data: { user }, error: authError } = await adminClient.auth.admin.createUser({
      email: formattedEmail,
      password: password,
      email_confirm: true, // Auto-confirm email to bypass verification step
      user_metadata: {
        full_name: fullName,
        role: role,
        temporal_password_changed: false // Force password reset on their first login
      }
    })

    if (authError) {
      throw new Error(`Error en Autenticación: ${authError.message}`)
    }

    if (!user) {
      throw new Error('No se pudo crear el registro del usuario.')
    }

    // 2. The database trigger (on_auth_user_created) automatically inserts into profiles.
    // However, to ensure synchronization, we will perform an upsert/update verify.
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName,
        role: role,
        temporal_password_changed: false
      })
      .eq('id', user.id)

    if (dbError) {
      console.error('Verify Profiles update warning:', dbError.message)
    }

    invalidateProfilesCache()
    revalidatePath('/dashboard/admin', 'layout')
    return { success: `Usuario "${username}" (${role}) creado con éxito. Credenciales iniciales listas.`, error: null }
  } catch (err: any) {
    // No simulated success: if the real account was not created in
    // Supabase Auth, the panel must say so plainly.
    console.error('Supabase create user failed:', err.message)
    return { success: null, error: `No se pudo crear el usuario en la base real: ${err.message}` }
  }
}

/**
 * Retrieves the current user's profile data for the profile page.
 * Supports both Supabase auth users and the Super Admin bypass session.
 */
export async function getProfileData() {
  // The session comes ONLY from Supabase Auth. Unsigned local cookies
  // are never trusted as a session (removed 2026-11-09).
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('No se pudo obtener el usuario autenticado.')
  }

  const email = user.email || ''
  const username = extractUsername(email)

  // The profile row is the source of truth for name and role; auth
  // metadata is only a fallback for rows that predate the trigger.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, bg_theme')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role || user.user_metadata?.role || 'customer')

  return {
    id: user.id,
    username,
    fullName: profile?.full_name || user.user_metadata?.full_name || '',
    role,
    email,
    isSuperAdmin: role === 'super_admin',
    bg_theme: (profile?.bg_theme || 'dark') as 'dark' | 'light',
  }
}

/**
 * Updates the user's profile: full name, username, and optionally password.
 * Uses the admin client (service role) to bypass Supabase rate limits.
 * Persists changes to Supabase Auth user_metadata and the public.profiles table.
 */
export async function updateProfile(currentState: any, formData: FormData) {
  const fullName = (formData.get('fullName') as string)?.trim()
  const rawUsername = (formData.get('username') as string)?.trim().toLowerCase()
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmNewPassword = formData.get('confirmNewPassword') as string

  if (!isSupabaseConfiguredServer()) {
    return { error: 'Modo demo: sin una base de datos conectada no se pueden guardar los cambios del perfil.', success: null }
  }

  if (!fullName || !rawUsername) {
    return { error: 'El nombre completo y el nombre de usuario son obligatorios.', success: null }
  }

  // If password fields provided, validate them — and demand the
  // CURRENT password: it is re-authenticated below before anything
  // changes (owner's order, 2026-11-19).
  if (newPassword || confirmNewPassword) {
    if (newPassword !== confirmNewPassword) {
      return { error: 'Las contraseñas no coinciden.', success: null }
    }
    if (newPassword.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres.', success: null }
    }
    if (!currentPassword) {
      return { error: 'Para cambiar tu contraseña, escribe tu contraseña actual.', success: null }
    }
  }

  // Apply centralized username-to-email mapping
  const newEmail = formatToEmail(rawUsername)

  try {
    // Get the current user's ID from their session
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { error: 'No se pudo verificar la sesión actual.', success: null }
    }

    // Password change: the CURRENT password is verified by
    // re-authenticating with the user's own email BEFORE the admin
    // update runs. If it does not match, nothing changes at all —
    // not even the name or username sent in the same form.
    if (newPassword) {
      const verifyError = await verifyCurrentPassword(supabase, user.email || '', currentPassword)
      if (verifyError) {
        return { error: verifyError, success: null }
      }
    }

    // Use admin client to bypass rate limits on email/password changes
    const adminClient = createAdminClient() as any

    // Build the admin auth update payload
    const authUpdatePayload: any = {
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName,
      },
    }

    // If email changed, update it
    const currentEmail = user.email || ''
    if (newEmail !== currentEmail) {
      authUpdatePayload.email = newEmail
    }

    // If password provided, include it
    if (newPassword) {
      authUpdatePayload.password = newPassword
    }

    // 1. Update Supabase Auth via admin API (no rate limits)
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      user.id,
      authUpdatePayload
    )

    if (authError) {
      return { error: `Error al actualizar: ${authError.message}`, success: null }
    }

    // 2. Update profiles table to keep DB in sync
    const profileUpdate: any = { full_name: fullName }
    if (newEmail !== currentEmail) {
      profileUpdate.email = newEmail
    }

    const { error: dbError } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id)

    if (dbError) {
      console.error('Profile DB update warning:', dbError.message)
    }

    revalidatePath('/', 'layout')
    return { success: '¡Perfil actualizado exitosamente!', error: null }
  } catch (err: any) {
    return { error: `Error del servidor: ${err.message || 'Error inesperado.'}`, success: null }
  }
}

/**
 * Action to update the background theme preference for the user.
 */
export async function updateThemeAction(theme: 'light' | 'dark') {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'No se pudo verificar la sesión actual.' }
    }

    // Bypass RLS using admin client to update public.profiles
    const adminClient = createAdminClient() as any
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({ bg_theme: theme })
      .eq('id', user.id)

    if (dbError) {
      return { error: `Error al guardar preferencia de tema: ${dbError.message}` }
    }

    // Save to cookies for SSR
    const cookieStore = await cookies()
    cookieStore.set('bg_theme', theme, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error del servidor al actualizar tema.' }
  }
}

/**
 * Server Action to update an existing user's details (admin only).
 */
export async function adminUpdateUserAction(userId: string, data: { fullName: string; username: string; role: UserRole; password?: string }) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    const adminClient = createAdminClient() as any

    // Safety check: only owners or dev can modify users
    // Querying with adminClient to bypass RLS restrictions
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', currentUser?.id || '')
      .single()

    const userRole = currentUser?.user_metadata?.role || profile?.role

    if (!userRole || !['owner', 'dev', 'super_admin'].includes(userRole)) {
      return { error: 'No tienes permisos para modificar usuarios.' }
    }

    // Protected account: the Super Admin's role never changes from this
    // panel, and the account itself is managed only from its own profile.
    // EXCEPCIÓN DE USUARIOS (regla del dueño, 2026-11-19): para cualquier
    // otro visor — incluido el administrador (owner) — la cuenta de
    // plataforma no existe en esta sección, así que la respuesta es
    // genérica y no confirma ni su existencia ni su rol.
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (targetProfile && normalizeRole(targetProfile.role as string) === 'super_admin') {
      if (normalizeRole(userRole) !== 'super_admin') {
        return { error: 'No se encontró el usuario o no tienes permisos para modificarlo.' }
      }
      return { error: 'La cuenta de Super Administrador está protegida: su rol no se puede cambiar desde el panel.' }
    }

    const formattedEmail = formatToEmail(data.username)

    // Build auth update payload
    const updatePayload: any = {
      email: formattedEmail,
      user_metadata: {
        full_name: data.fullName,
        role: data.role,
      }
    }

    if (data.password) {
      updatePayload.password = data.password
    }

    // 1. Update Supabase Auth user
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, updatePayload)
    if (authError) {
      throw new Error(`Error en Autenticación: ${authError.message}`)
    }

    // 2. Update public.profiles table
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({
        full_name: data.fullName,
        email: formattedEmail,
        role: data.role,
      })
      .eq('id', userId)

    if (dbError) {
      throw new Error(`Error al actualizar perfil en BD: ${dbError.message}`)
    }

    invalidateProfilesCache()
    revalidatePath('/dashboard/admin', 'layout')
    return { success: 'Usuario actualizado exitosamente.' }
  } catch (err: any) {
    console.error('Supabase update user failed:', err.message)
    return { error: `No se pudo actualizar el usuario en la base real: ${err.message}` }
  }
}

/**
 * Server Action to delete a user entirely (admin only).
 */
export async function adminDeleteUserAction(userId: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (currentUser?.id === userId) {
      return { error: 'No puedes eliminar tu propia cuenta.' }
    }

    const adminClient = createAdminClient() as any

    // Safety check: only owners or dev can delete users
    // Querying with adminClient to bypass RLS restrictions
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', currentUser?.id || '')
      .single()

    const userRole = currentUser?.user_metadata?.role || profile?.role

    if (!userRole || !['owner', 'dev', 'super_admin'].includes(userRole)) {
      return { error: 'No tienes permisos para eliminar usuarios.' }
    }

    // Protected account: the Super Admin can never be deleted from the panel.
    // Misma excepción de Usuarios que en la edición: para un visor que no
    // es super_admin la respuesta es genérica y no confirma la cuenta.
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (targetProfile && normalizeRole(targetProfile.role as string) === 'super_admin') {
      if (normalizeRole(userRole) !== 'super_admin') {
        return { error: 'No se encontró el usuario o no tienes permisos para eliminarlo.' }
      }
      return { error: 'La cuenta de Super Administrador está protegida y no se puede eliminar.' }
    }

    // 1. Delete from Supabase Auth (on delete cascade deletes from profiles table)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      throw new Error(`Error al eliminar de Autenticación: ${authError.message}`)
    }

    invalidateProfilesCache()
    revalidatePath('/dashboard/admin', 'layout')
    return { success: 'Usuario eliminado exitosamente.' }
  } catch (err: any) {
    console.error('Supabase delete user failed:', err.message)
    return { error: `No se pudo eliminar el usuario en la base real: ${err.message}` }
  }
}
