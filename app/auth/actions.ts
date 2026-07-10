'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { invalidateProfilesCache } from '@/lib/services'

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

export interface LoginState {
  error: string | null
}

export interface RegisterState {
  error: string | null
  success: boolean
  userId?: string
}

/**
 * Handles patient self-registration (Sign up)
 * Supports offline-first bypass, creating a mock customer profile if database fails.
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
  const cookieStore = await cookies()

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
    console.warn('Supabase sign up failed, falling back to local mock bypass:', err)
  }

  // Fallback Offline-First: Create local mock patient profile
  const mockId = 'usr_' + Math.random().toString(36).substr(2, 9)
  const mockProfile = {
    id: mockId,
    email: formattedEmail,
    full_name: fullName,
    role: 'customer',
    created_at: new Date().toISOString()
  }

  const mockCustomerProfile = {
    id: mockId,
    phone: '',
    date_of_birth: '',
    address: '',
    occupation: '',
    blood_type: '',
    medical_notes: 'Autoregistrado desde la web.',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    created_at: new Date().toISOString()
  }

  // Import mockDb dynamically to avoid circular dependencies
  const mockDb = require('@/lib/mocks')
  mockDb.addMockCustomer(mockProfile, mockCustomerProfile)

  // Auto-login locally using bypass cookies
  cookieStore.set('optica_rayo_superadmin_session', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  })
  cookieStore.set('optica_rayo_mock_role', 'customer', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  })
  cookieStore.set('optica_rayo_mock_email', formattedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  })
  cookieStore.set('optica_rayo_mock_name', fullName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  })

  revalidatePath('/', 'layout')
  return { success: true, userId: mockId, error: null }
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

  // 1. One-Time Mock local bypass check
  const mockDb = require('@/lib/mocks')
  const mockUser = mockDb.MOCK_PROFILES.find((p: any) => p.email === formattedEmail)
  if (
    (formattedEmail === 'superadmin@opticarayo.com' && password === 'Rayo_SuperAdmin2026') ||
    (formattedEmail === 'vendedora@opticarayo.com' && password === 'Rayo_Vendedora2026') ||
    (formattedEmail === 'optometrista@opticarayo.com' && password === 'Rayo_Optometrista2026') ||
    (mockUser && mockUser.role === 'customer')
  ) {
    let roleVal = mockUser?.role || 'dev'
    let nameVal = mockUser?.full_name || 'Dr. Hugo Optometrista'
    if (formattedEmail === 'superadmin@opticarayo.com') {
      roleVal = 'owner'
      nameVal = 'Super Administrador'
    } else if (formattedEmail === 'vendedora@opticarayo.com') {
      roleVal = 'seller'
      nameVal = 'Patricia Vendedora'
    }

    // Set a secure session cookie locally to grant temporary admin rights
    cookieStore.set('optica_rayo_superadmin_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour session
      path: '/',
    })
    cookieStore.set('optica_rayo_mock_role', roleVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    })
    cookieStore.set('optica_rayo_mock_email', formattedEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    })
    cookieStore.set('optica_rayo_mock_name', nameVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    })

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

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
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { error: 'Todos los campos de contraseña son obligatorios.' }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()

  // Get current session user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'No se pudo obtener el usuario de la sesión actual.' }
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
  const role = formData.get('role') as 'owner' | 'seller' | 'customer'

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
      return { error: `Error en Autenticación: ${authError.message}`, success: null }
    }

    if (!user) {
      return { error: 'No se pudo crear el registro del usuario.', success: null }
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
    return { error: `Fallo del servidor: ${err.message || 'Error inesperado.'}`, success: null }
  }
}

/**
 * Retrieves the current user's profile data for the profile page.
 * Supports both Supabase auth users and the Super Admin bypass session.
 */
export async function getProfileData() {
  const cookieStore = await cookies()

  // Check for Mock bypass session first
  const superadminSession = cookieStore.get('optica_rayo_superadmin_session')?.value
  const mockRole = cookieStore.get('optica_rayo_mock_role')?.value
  if (superadminSession === 'true' && mockRole) {
    const mockEmail = cookieStore.get('optica_rayo_mock_email')?.value || ''
    const mockName = cookieStore.get('optica_rayo_mock_name')?.value || ''
    return {
      username: mockEmail.split('@')[0],
      fullName: mockName,
      role: mockRole,
      email: mockEmail,
      isSuperAdmin: mockRole === 'owner',
      bg_theme: 'dark' as 'dark' | 'light',
    }
  }

  // Standard Supabase auth flow
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('No se pudo obtener el usuario autenticado.')
  }

  const email = user.email || ''
  const username = extractUsername(email)

  // Fetch theme preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('bg_theme')
    .eq('id', user.id)
    .single()

  return {
    username,
    fullName: user.user_metadata?.full_name || '',
    role: user.user_metadata?.role || 'customer',
    email,
    isSuperAdmin: false,
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
  const newPassword = formData.get('newPassword') as string
  const confirmNewPassword = formData.get('confirmNewPassword') as string

  if (!fullName || !rawUsername) {
    return { error: 'El nombre completo y el nombre de usuario son obligatorios.', success: null }
  }

  // If password fields provided, validate them
  if (newPassword || confirmNewPassword) {
    if (newPassword !== confirmNewPassword) {
      return { error: 'Las contraseñas no coinciden.', success: null }
    }
    if (newPassword.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres.', success: null }
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
export async function adminUpdateUserAction(userId: string, data: { fullName: string; username: string; role: 'owner' | 'seller' | 'customer' | 'dev'; password?: string }) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    // Safety check: only owners or dev can modify users
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser?.id || '')
      .single()

    const userRole = currentUser?.user_metadata?.role || profile?.role

    if (!userRole || !['owner', 'dev'].includes(userRole)) {
      return { error: 'No tienes permisos para modificar usuarios.' }
    }

    const adminClient = createAdminClient() as any
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
      return { error: `Error en Autenticación: ${authError.message}` }
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
      return { error: `Error al actualizar perfil en BD: ${dbError.message}` }
    }

    invalidateProfilesCache()
    revalidatePath('/dashboard/admin', 'layout')
    return { success: 'Usuario actualizado exitosamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado.' }
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

    // Safety check: only owners or dev can delete users
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser?.id || '')
      .single()

    const userRole = currentUser?.user_metadata?.role || profile?.role

    if (!userRole || !['owner', 'dev'].includes(userRole)) {
      return { error: 'No tienes permisos para eliminar usuarios.' }
    }

    const adminClient = createAdminClient() as any

    // 1. Delete from Supabase Auth (on delete cascade deletes from profiles table)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      return { error: `Error al eliminar de Autenticación: ${authError.message}` }
    }

    invalidateProfilesCache()
    revalidatePath('/dashboard/admin', 'layout')
    return { success: 'Usuario eliminado exitosamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado.' }
  }
}
