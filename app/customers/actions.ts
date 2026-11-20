'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import * as mockDb from '@/lib/mocks'
import { addMonthsISO, DEFAULT_REMINDER_MONTHS, REMINDER_MONTHS_KEY } from '@/lib/reminder-config'
import { buildClinicalHistoryFromFormData, hasClinicalHistory } from '@/lib/clinical-history'
import { isAdminRole, isStaffRole } from '@/lib/roles'
import {
  buildInstallmentSchedule,
  isPaymentFrequency,
  type PaymentFrequency,
} from '@/lib/payment-plan'
import { splitPhonePrefix } from '@/lib/phone'

/**
 * True when a real Supabase project is configured (same env check the
 * client services use). The mock fallbacks in this file may only run in
 * demo mode — when a database IS configured, a failure is a real error
 * and must be reported as one, never dressed up as a successful write.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder') && !key.includes('placeholder')
}

/**
 * Reads the configured review-reminder period (months) from app_settings.
 * Falls back to the default (6 months) when unset or unreadable.
 */
async function reminderMonthsServer(client?: any): Promise<number> {
  if (client) {
    try {
      const { data } = await client
        .from('app_settings')
        .select('value')
        .eq('key', REMINDER_MONTHS_KEY)
        .single()
      const n = parseInt(data?.value ?? '', 10)
      if (Number.isFinite(n) && n > 0) return n
    } catch {
      // use default below
    }
  }
  return DEFAULT_REMINDER_MONTHS
}

export interface RegisterCustomerState {
  error: string | null
  success: string | null
  customerId: string | null
}

export interface CreateExamState {
  error: string | null
  success: string | null
  examId: string | null
}

export interface CreateSaleState {
  error: string | null
  success: string | null
}

/** Formats username to internal email if no @ is present */
function formatToEmail(input: string): string {
  const trimmed = input.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : `${trimmed}@opticarayo.com`
}

/**
 * Registers a new customer: creates Supabase Auth account + profile + customer_profile.
 * Called from /customers/new by staff (owner/seller/dev).
 */
export async function registerCustomerAction(currentState: RegisterCustomerState, formData: FormData): Promise<RegisterCustomerState> {
  const username = formData.get('username') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const dateOfBirth = formData.get('dateOfBirth') as string
  const address = formData.get('address') as string
  const occupation = formData.get('occupation') as string
  const bloodType = formData.get('bloodType') as string
  const medicalNotes = formData.get('medicalNotes') as string
  const emergencyContactName = formData.get('emergencyContactName') as string
  const emergencyContactPhone = formData.get('emergencyContactPhone') as string

  if (!username || !fullName) {
    return { error: 'El nombre de usuario y nombre completo son obligatorios.', success: null, customerId: null }
  }

  // Teléfono opcional en los registros rápidos y obligatorio en el
  // alta completa (eso lo exige el formulario); cuando viene, la
  // regla de los 10 dígitos corre sobre el número LOCAL, ya sin el
  // prefijo capturado (+52 / +1 / otro) — dictado del dueño 2026-11-19.
  if (phone && phone.trim() && splitPhonePrefix(phone).local.length < 10) {
    return { error: 'El teléfono debe tener al menos 10 dígitos.', success: null, customerId: null }
  }

  const formattedEmail = formatToEmail(username)
  // Temporal password: RANDOM, shown once to the staff member in the
  // success message so they can hand it to the customer in person.
  // (Until 2026-11-09 it was the predictable pattern Rayo_<FirstName>,
  // which anyone could guess from this public repository.)
  const temporalPassword = (() => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const bytes = new Uint8Array(10)
    globalThis.crypto.getRandomValues(bytes)
    return 'Rayo-' + Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
  })()

  let user: any = null
  let isMock = false

  try {
    const adminClient = createAdminClient() as any

    // 1. Create Supabase Auth user
    const { data, error: authError } = await adminClient.auth.admin.createUser({
      email: formattedEmail,
      password: temporalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'customer',
        temporal_password_changed: false,
      },
    })

    if (authError) {
      throw new Error(authError.message)
    }

    user = data.user
    if (!user) {
      throw new Error('No se pudo inicializar la cuenta en la respuesta.')
    }

    // 2. The trigger on_auth_user_created will insert into profiles automatically.
    // Wait briefly then upsert customer_profile with clinical data.
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: cpError } = await adminClient
      .from('customer_profiles')
      .upsert({
        id: user.id,
        phone: phone || null,
        date_of_birth: dateOfBirth || null,
        address: address || null,
        occupation: occupation || null,
        blood_type: bloodType || null,
        medical_notes: medicalNotes || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
      })

    if (cpError) {
      console.error('customer_profile upsert warning:', cpError.message)
    }

    // 3. Optional: Create initial clinical exam if prescription fields are provided
    const odSphere = formData.get('od_sphere') as string
    const oiSphere = formData.get('oi_sphere') as string
    const odCylinder = formData.get('od_cylinder') as string
    const oiCylinder = formData.get('oi_cylinder') as string
    const odAxis = formData.get('od_axis') as string
    const oiAxis = formData.get('oi_axis') as string
    const odAdd = formData.get('od_add') as string
    const oiAdd = formData.get('oi_add') as string
    const pdDistance = formData.get('pd_distance') as string
    const lensType = formData.get('lens_type') as string
    const frameRecommendation = formData.get('frame_recommendation') as string
    const treatment = formData.get('treatment') as string
    const clinicalNotes = formData.get('clinical_notes') as string

    const hasPrescription = odSphere || oiSphere || odCylinder || oiCylinder || odAdd || oiAdd || pdDistance

    if (hasPrescription) {
      const serverClient = await createClient()
      const { data: { user: currentUser } } = await serverClient.auth.getUser()

      const reminderMonths = await reminderMonthsServer(adminClient)
      const nextSuggestedDate = new Date(addMonthsISO(new Date(), reminderMonths))

      const examPayload: any = {
        customer_id: user.id,
        examiner_id: currentUser?.id || null,
        exam_date: new Date().toISOString(),
        next_exam_date: nextSuggestedDate.toISOString(),
      }

      if (odSphere) examPayload.od_sphere = parseFloat(odSphere)
      if (odCylinder) examPayload.od_cylinder = parseFloat(odCylinder)
      if (odAxis) examPayload.od_axis = parseInt(odAxis)
      if (odAdd) examPayload.od_add = parseFloat(odAdd)

      if (oiSphere) examPayload.oi_sphere = parseFloat(oiSphere)
      if (oiCylinder) examPayload.oi_cylinder = parseFloat(oiCylinder)
      if (oiAxis) examPayload.oi_axis = parseInt(oiAxis)
      if (oiAdd) examPayload.oi_add = parseFloat(oiAdd)

      if (pdDistance) examPayload.pd_distance = parseFloat(pdDistance)
      if (lensType) examPayload.lens_type = lensType
      if (frameRecommendation) examPayload.frame_recommendation = frameRecommendation
      if (treatment) examPayload.treatment = treatment
      if (clinicalNotes) examPayload.clinical_notes = clinicalNotes

      const { error: examError } = await adminClient
        .from('clinical_exams')
        .insert([examPayload])

      if (examError) {
        console.error('Initial clinical exam registration warning:', examError.message)
      }

      // Also create/upsert reminder entry for PWA monitoring
      await adminClient.from('reminders').insert([{
        customer_id: user.id,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: nextSuggestedDate.toISOString(),
        status: 'pending',
      }])
    }

    revalidatePath('/customers', 'layout')
    return {
      success: `Cliente "${fullName}" registrado con éxito.${hasPrescription ? ' Receta clínica inicial guardada.' : ''} Contraseña temporal: ${temporalPassword}`,
      error: null,
      customerId: user.id,
    }
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the registration failed: the customer
      // was NOT created. Report the real error — creating an in-memory
      // "customer" with a temporal password here would hand staff a login
      // for an account that does not exist.
      console.error('Customer registration failed:', err)
      return {
        error: `No se pudo registrar el cliente: ${err.message || 'error de conexión con la base de datos.'}`,
        success: null,
        customerId: null,
      }
    }
    console.warn('Supabase not configured; registering customer in local demo mode:', err.message)
    isMock = true
  }

  if (isMock) {
    const mockId = 'mock_cust_' + Math.random().toString(36).substr(2, 9)
    const mockProfile = {
      id: mockId,
      email: formattedEmail,
      full_name: fullName,
      role: 'customer',
      temporal_password_changed: false
    }

    const mockCustomerProfile = {
      id: mockId,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      address: address || null,
      occupation: occupation || null,
      blood_type: bloodType || null,
      medical_notes: medicalNotes || null,
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_phone: emergencyContactPhone || null
    }

    const odSphere = formData.get('od_sphere') as string
    const oiSphere = formData.get('oi_sphere') as string
    const odCylinder = formData.get('od_cylinder') as string
    const oiCylinder = formData.get('oi_cylinder') as string
    const odAxis = formData.get('od_axis') as string
    const oiAxis = formData.get('oi_axis') as string
    const odAdd = formData.get('od_add') as string
    const oiAdd = formData.get('oi_add') as string
    const pdDistance = formData.get('pd_distance') as string
    const lensType = formData.get('lens_type') as string
    const frameRecommendation = formData.get('frame_recommendation') as string
    const treatment = formData.get('treatment') as string
    const clinicalNotes = formData.get('clinical_notes') as string

    const hasPrescription = odSphere || oiSphere || odCylinder || oiCylinder || odAdd || oiAdd || pdDistance
    let mockExam: any = null

    if (hasPrescription) {
      const nextSuggestedDate = new Date(addMonthsISO(new Date(), DEFAULT_REMINDER_MONTHS))

      mockExam = {
        id: 'mock_exam_' + Math.random().toString(36).substr(2, 9),
        customer_id: mockId,
        examiner_id: 'opt-1',
        exam_date: new Date().toISOString(),
        next_exam_date: nextSuggestedDate.toISOString(),
        od_sphere: odSphere ? parseFloat(odSphere) : null,
        od_cylinder: odCylinder ? parseFloat(odCylinder) : null,
        od_axis: odAxis ? parseInt(odAxis) : null,
        od_add: odAdd ? parseFloat(odAdd) : null,
        oi_sphere: oiSphere ? parseFloat(oiSphere) : null,
        oi_cylinder: oiCylinder ? parseFloat(oiCylinder) : null,
        oi_axis: oiAxis ? parseInt(oiAxis) : null,
        oi_add: oiAdd ? parseFloat(oiAdd) : null,
        pd_distance: pdDistance ? parseFloat(pdDistance) : null,
        lens_type: lensType || null,
        frame_recommendation: frameRecommendation || null,
        treatment: treatment || null,
        clinical_notes: clinicalNotes || null
      }

      // Add a pending reminder mock
      const mockReminder = {
        id: 'mock_rem_' + Math.random().toString(36).substr(2, 9),
        customer_id: mockId,
        customer_name: fullName,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: nextSuggestedDate.toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      }
      mockDb.addMockReminder(mockReminder)
    }

    mockDb.addMockCustomer(mockProfile, mockCustomerProfile, mockExam)

    revalidatePath('/customers', 'layout')
    return {
      success: `Cliente "${fullName}" registrado con éxito (Modo Local).${hasPrescription ? ' Receta clínica inicial guardada.' : ''} Contraseña temporal: ${temporalPassword}`,
      error: null,
      customerId: mockId,
    }
  }

  return { error: 'Error inesperado al registrar el cliente.', success: null, customerId: null }
}

/**
 * Creates a new clinical exam record for a customer.
 */
export async function createClinicalExamAction(currentState: CreateExamState, formData: FormData): Promise<CreateExamState> {
  const customerId = formData.get('customerId') as string

  if (!customerId) {
    return { error: 'ID de cliente requerido.', success: null, examId: null }
  }

  let examPayload: any = {}
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fecha de la hoja (punto 1): el formulario la manda como
    // yyyy-mm-dd; se ancla al mediodía para que no se mueva de día
    // por husos horarios. Sin fecha en el formulario, hoy y ahora.
    const examDateRaw = (formData.get('exam_date') as string) || ''
    const examDate = /^\d{4}-\d{2}-\d{2}$/.test(examDateRaw)
      ? new Date(`${examDateRaw}T12:00:00`).toISOString()
      : new Date().toISOString()

    examPayload = {
      customer_id: customerId,
      examiner_id: user?.id || null,
      exam_date: examDate,
    }

    // OD fields
    const odSphere = formData.get('od_sphere') as string
    const odCylinder = formData.get('od_cylinder') as string
    const odAxis = formData.get('od_axis') as string
    const odAdd = formData.get('od_add') as string
    const odVisualAcuity = formData.get('od_visual_acuity') as string

    if (odSphere) examPayload.od_sphere = parseFloat(odSphere)
    if (odCylinder) examPayload.od_cylinder = parseFloat(odCylinder)
    if (odAxis) examPayload.od_axis = parseInt(odAxis)
    if (odAdd) examPayload.od_add = parseFloat(odAdd)
    if (odVisualAcuity) examPayload.od_visual_acuity = odVisualAcuity

    // OI fields
    const oiSphere = formData.get('oi_sphere') as string
    const oiCylinder = formData.get('oi_cylinder') as string
    const oiAxis = formData.get('oi_axis') as string
    const oiAdd = formData.get('oi_add') as string
    const oiVisualAcuity = formData.get('oi_visual_acuity') as string

    if (oiSphere) examPayload.oi_sphere = parseFloat(oiSphere)
    if (oiCylinder) examPayload.oi_cylinder = parseFloat(oiCylinder)
    if (oiAxis) examPayload.oi_axis = parseInt(oiAxis)
    if (oiAdd) examPayload.oi_add = parseFloat(oiAdd)
    if (oiVisualAcuity) examPayload.oi_visual_acuity = oiVisualAcuity

    // Additional fields
    const pdDistance = formData.get('pd_distance') as string
    const pdNear = formData.get('pd_near') as string
    const iopOd = formData.get('intraocular_pressure_od') as string
    const iopOi = formData.get('intraocular_pressure_oi') as string
    const lensType = formData.get('lens_type') as string
    const frameRecommendation = formData.get('frame_recommendation') as string
    const treatment = formData.get('treatment') as string
    const clinicalNotes = formData.get('clinical_notes') as string
    const nextExamDate = formData.get('next_exam_date') as string

    if (pdDistance) examPayload.pd_distance = parseFloat(pdDistance)
    if (pdNear) examPayload.pd_near = parseFloat(pdNear)
    if (iopOd) examPayload.intraocular_pressure_od = parseFloat(iopOd)
    if (iopOi) examPayload.intraocular_pressure_oi = parseFloat(iopOi)
    if (lensType) examPayload.lens_type = lensType
    if (frameRecommendation) examPayload.frame_recommendation = frameRecommendation
    if (treatment) examPayload.treatment = treatment
    if (clinicalNotes) examPayload.clinical_notes = clinicalNotes
    if (nextExamDate) examPayload.next_exam_date = nextExamDate

    // ——— Historia clínica (la hoja en papel del negocio) ———
    // Todo lo del formato que no es la RX Final viaja junto en la
    // columna JSONB clinical_history (ver lib/clinical-history.ts).
    // La RX Final ya quedó arriba en las columnas de siempre, que son
    // las que alimentan ventas e historial.
    const clinicalHistory = buildClinicalHistoryFromFormData(formData)
    if (hasClinicalHistory(clinicalHistory)) {
      examPayload.clinical_history = clinicalHistory
    }

    // La agudeza por ojo de las columnas de siempre se alimenta de la
    // tabla de la hoja: AV C/C Lejos (con corrección, de lejos) es la
    // agudeza que acompaña a la graduación final en la ficha.
    if (!examPayload.od_visual_acuity && clinicalHistory.vaCcFar.od) {
      examPayload.od_visual_acuity = clinicalHistory.vaCcFar.od
    }
    if (!examPayload.oi_visual_acuity && clinicalHistory.vaCcFar.oi) {
      examPayload.oi_visual_acuity = clinicalHistory.vaCcFar.oi
    }

    let { data, error } = await supabase
      .from('clinical_exams')
      .insert([examPayload])
      .select()
      .single()

    // Degradación silenciosa: si la columna clinical_history aún no
    // existe (migración 20261119 sin aplicar), se reintenta SIN la
    // historia en vez de perder el examen — mismo patrón que
    // products.display_order. Cualquier otro error sí es real.
    if (error && examPayload.clinical_history && error.message.includes('clinical_history')) {
      const { clinical_history: _omit, ...payloadWithoutHistory } = examPayload
      examPayload = payloadWithoutHistory
      ;({ data, error } = await supabase
        .from('clinical_exams')
        .insert([examPayload])
        .select()
        .single())
    }

    if (error) {
      throw new Error(error.message)
    }

    // Fecha de nacimiento capturada en el examen (solo si el
    // expediente no tenía ninguna): queda guardada en su perfil.
    // Best-effort: jamás debe tumbar un examen ya guardado.
    const patientDob = (formData.get('patient_dob') as string) || ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(patientDob)) {
      try {
        const { data: cp } = await supabase
          .from('customer_profiles')
          .select('date_of_birth')
          .eq('id', customerId)
          .single()
        if (cp && !cp.date_of_birth) {
          await supabase
            .from('customer_profiles')
            .update({ date_of_birth: patientDob })
            .eq('id', customerId)
        }
      } catch {
        // La fecha se podrá capturar de nuevo en el siguiente examen.
      }
    }

    // Update or create reminder based on next_exam_date
    if (nextExamDate) {
      await supabase.from('reminders').upsert({
        customer_id: customerId,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: new Date(nextExamDate).toISOString(),
        status: 'pending',
      })
    }

    revalidatePath(`/customers/${customerId}`, 'layout')
    return { success: '¡Examen clínico guardado exitosamente!', error: null, examId: data.id }
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the exam was NOT saved: report the
      // real error. A prescription that only exists in memory would let
      // staff work from a graduation the record does not contain.
      console.error('Clinical exam save failed:', err)
      return {
        error: `No se pudo guardar el examen clínico: ${err.message || 'error de conexión con la base de datos.'}`,
        success: null,
        examId: null,
      }
    }
    console.warn('Supabase not configured; saving clinical exam in local demo mode:', err.message)
    const mockExamId = 'mock_exam_' + Math.random().toString(36).substr(2, 9)
    const mockExam = {
      id: mockExamId,
      customer_id: customerId,
      examiner_id: 'opt-1',
      exam_date: examPayload.exam_date || new Date().toISOString(),
      next_exam_date: examPayload.next_exam_date || null,
      od_sphere: examPayload.od_sphere || null,
      od_cylinder: examPayload.od_cylinder || null,
      od_axis: examPayload.od_axis || null,
      od_add: examPayload.od_add || null,
      od_visual_acuity: examPayload.od_visual_acuity || null,
      oi_sphere: examPayload.oi_sphere || null,
      oi_cylinder: examPayload.oi_cylinder || null,
      oi_axis: examPayload.oi_axis || null,
      oi_add: examPayload.oi_add || null,
      oi_visual_acuity: examPayload.oi_visual_acuity || null,
      pd_distance: examPayload.pd_distance || null,
      pd_near: examPayload.pd_near || null,
      intraocular_pressure_od: examPayload.intraocular_pressure_od || null,
      intraocular_pressure_oi: examPayload.intraocular_pressure_oi || null,
      lens_type: examPayload.lens_type || null,
      frame_recommendation: examPayload.frame_recommendation || null,
      treatment: examPayload.treatment || null,
      clinical_notes: examPayload.clinical_notes || null,
      clinical_history: examPayload.clinical_history || null
    }

    const mockDb = require('@/lib/mocks')
    mockDb.MOCK_CLINICAL_EXAMS.unshift(mockExam)

    // Fecha de nacimiento capturada en el examen (demo): se guarda en
    // el perfil mock solo si no tenía ninguna.
    const mockPatientDob = (formData.get('patient_dob') as string) || ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(mockPatientDob)) {
      const cpIndex = mockDb.MOCK_CUSTOMER_PROFILES.findIndex((p: any) => p.id === customerId)
      if (cpIndex >= 0 && !mockDb.MOCK_CUSTOMER_PROFILES[cpIndex].date_of_birth) {
        mockDb.MOCK_CUSTOMER_PROFILES[cpIndex] = {
          ...mockDb.MOCK_CUSTOMER_PROFILES[cpIndex],
          date_of_birth: mockPatientDob,
        }
      }
    }

    if (examPayload.next_exam_date) {
      const mockReminder = {
        id: 'mock_rem_' + Math.random().toString(36).substr(2, 9),
        customer_id: customerId,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: new Date(examPayload.next_exam_date).toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      }
      mockDb.addMockReminder(mockReminder)
    }

    revalidatePath(`/customers/${customerId}`, 'layout')
    return { success: '¡Examen clínico guardado exitosamente (Modo Local)!', error: null, examId: mockExamId }
  }
}

/**
 * Creates a sale linked to a specific customer (and optionally an exam + coupon).
 * Supports both single payment and installment plans with anticipo (down payment).
 */
export async function createLinkedSaleAction(currentState: CreateSaleState, formData: FormData): Promise<CreateSaleState> {
  const customerId = formData.get('customerId') as string
  const examId = formData.get('examId') as string
  const couponCode = (formData.get('couponCode') as string)?.trim().toUpperCase()
  const saleNotes = formData.get('notes') as string
  const itemsJson = formData.get('items') as string
  const paymentPlanType = (formData.get('paymentPlanType') as string) || 'single'
  const paidAmountRaw = formData.get('paidAmount') as string
  const paymentMethod = (formData.get('paymentMethod') as 'cash' | 'card' | 'transfer') || 'cash'
  const isPrescriptionVisible = formData.get('isPrescriptionVisible') === 'true'

  if (!customerId || !itemsJson) {
    return { error: 'Cliente e items son requeridos.', success: null }
  }

  let items: any[] = []
  try {
    items = JSON.parse(itemsJson)
  } catch {
    return { error: 'Error al leer los productos del carrito.', success: null }
  }

  if (items.length === 0) {
    return { error: 'El carrito está vacío.', success: null }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let couponId: string | null = null
    let discountPercent = 0

    // Validate coupon if provided
    if (couponCode) {
      const { data: couponData } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode)
        .single()

      if (couponData && couponData.is_active && new Date(couponData.valid_until) > new Date()) {
        // Límite de usos (dictado 2026-11-19): un uso = una venta
        // guardada con este coupon_id. Si la columna max_uses aún no
        // existe, la fila no la trae → ilimitado.
        const limit = (couponData as any).max_uses ?? null
        if (limit !== null) {
          const { count } = await supabase
            .from('sales')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', couponData.id)
          if ((count ?? 0) >= Number(limit)) {
            return { error: 'Este cupón ya llegó a su límite de usos', success: null }
          }
        }
        couponId = couponData.id
        discountPercent = couponData.discount_percent
      } else if (couponCode) {
        return { error: 'El cupón no es válido o ha expirado.', success: null }
      }
    }

    // Server-side price recompute: NEVER trust the prices the browser sent.
    // Unit prices are re-read from products / lens_materials / lens_treatments
    // so a tampered or stale cart cannot change what the business charges.
    {
      const productIds = [...new Set(items.map((i: any) => i.productId).filter(Boolean))]
      const materialIds = [...new Set(items.map((i: any) => i.lensMaterialId).filter(Boolean))]
      const treatmentIds = [...new Set(items.flatMap((i: any) => i.treatmentIds || []))]
      const [prodRes, matRes, treatRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, price').in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        materialIds.length > 0
          ? supabase.from('lens_materials').select('id, price').in('id', materialIds)
          : Promise.resolve({ data: [], error: null }),
        treatmentIds.length > 0
          ? supabase.from('lens_treatments').select('id, price').in('id', treatmentIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      // A connection-level failure keeps the existing demo fallback alive;
      // a missing row with a working connection is a real data problem.
      if (prodRes.error || matRes.error || treatRes.error) {
        throw new Error('No se pudo verificar el catálogo en la base de datos.')
      }
      const productPrice = new Map((prodRes.data || []).map((r: any) => [r.id, Number(r.price)]))
      const materialPrice = new Map((matRes.data || []).map((r: any) => [r.id, Number(r.price)]))
      const treatmentPrice = new Map((treatRes.data || []).map((r: any) => [r.id, Number(r.price)]))

      // Precios de la venta vinculada (dictado del dueño, 2026-11-19):
      // el producto se cobra SIEMPRE a precio de lista, aunque la venta
      // sea de un cliente registrado — sin precio de cliente ni % de
      // miembro automáticos. El único descuento es el cupón validado
      // arriba. Materiales y tratamientos también van a precio de lista.
      for (const item of items) {
        const qty = Number(item.quantity)
        if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
          return { error: 'Cantidad inválida en uno de los productos del carrito.', success: null }
        }
        if (!productPrice.has(item.productId)) {
          return { error: 'Uno de los productos del carrito ya no existe en el catálogo.', success: null }
        }
        item.price = productPrice.get(item.productId)
        if (item.lensMaterialId) {
          if (!materialPrice.has(item.lensMaterialId)) {
            return { error: 'Uno de los materiales seleccionados ya no existe.', success: null }
          }
          item.lensMaterialPrice = materialPrice.get(item.lensMaterialId)
        } else {
          item.lensMaterialPrice = 0
        }
        let treatmentsTotal = 0
        for (const tid of item.treatmentIds || []) {
          if (!treatmentPrice.has(tid)) {
            return { error: 'Uno de los tratamientos seleccionados ya no existe.', success: null }
          }
          treatmentsTotal += treatmentPrice.get(tid) || 0
        }
        item.treatmentsPrice = treatmentsTotal
      }
    }

    // Subtotal calculations including base frame + materials + treatments per item
    const subtotal = items.reduce((sum, item) => {
      const itemUnitPrice = item.price + (item.lensMaterialPrice || 0) + (item.treatmentsPrice || 0)
      return sum + itemUnitPrice * item.quantity
    }, 0)
    const discountAmount = subtotal * (discountPercent / 100)
    const total = subtotal - discountAmount

    // Determine paid_amount based on payment plan type
    let paidAmount: number
    if (paymentPlanType === 'single') {
      paidAmount = total // Full payment upfront
    } else {
      // For installment plans: paidAmount is the down-payment (anticipo)
      const parsed = parseFloat(paidAmountRaw?.replace(/,/g, '') || '0')
      paidAmount = isNaN(parsed) ? 0 : Math.min(parsed, total)
    }

    const pendingBalance = Math.max(0, total - paidAmount)

    // Determine status based on payment
    let saleStatus: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado' = 'Cotizacion'
    if (paidAmount >= total) {
      saleStatus = 'Listo_Entrega'
    } else if (paidAmount > 0) {
      saleStatus = 'Anticipo_Pagado'
    }

    // 1. Create sale with payment info
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([{
        customer_id: customerId,
        seller_id: user?.id || null,
        exam_id: examId || null,
        coupon_id: couponId,
        discount_applied: discountAmount,
        total,
        paid_amount: paidAmount,
        pending_balance: pendingBalance,
        payment_method: paymentMethod,
        status: saleStatus,
        notes: saleNotes || null,
        is_prescription_visible: isPrescriptionVisible,
      }])
      .select()
      .single()

    if (saleError || !saleData) {
      return { error: `Error al registrar venta: ${saleError?.message}`, success: null }
    }

    // 2. Insert sale items, their treatments, and update stock.
    // sale_items.price stores the PRODUCT unit price only (the same
    // semantics as the POS createSale and the seeded data): the lens
    // material lives in lens_material_price and each treatment in
    // sale_item_treatments, so the customer file can break the total down
    // line by line and the parts add up to the sale total.
    for (const item of items) {
      const { data: itemData, error: itemError } = await supabase
        .from('sale_items')
        .insert([{
          sale_id: saleData.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
          lens_material_id: item.lensMaterialId || null,
          lens_material_price: item.lensMaterialPrice || 0,
          od_sphere: item.od_sphere ? parseFloat(item.od_sphere) : null,
          od_cylinder: item.od_cylinder ? parseFloat(item.od_cylinder) : null,
          od_axis: item.od_axis ? parseInt(item.od_axis) : null,
          od_add: item.od_add ? parseFloat(item.od_add) : null,
          oi_sphere: item.oi_sphere ? parseFloat(item.oi_sphere) : null,
          oi_cylinder: item.oi_cylinder ? parseFloat(item.oi_cylinder) : null,
          oi_axis: item.oi_axis ? parseInt(item.oi_axis) : null,
          oi_add: item.oi_add ? parseFloat(item.oi_add) : null,
          pd_distance: item.pd_distance ? parseFloat(item.pd_distance) : null,
        }])
        .select()
        .single()

      if (itemError || !itemData) {
        // The sale row already exists without this line item: surface a
        // partial-failure error instead of letting the sale pass as
        // complete (previously the item error was silently ignored).
        return {
          error: `La venta quedó registrada (id ${saleData.id}) pero una partida no se pudo guardar: ${itemError?.message || 'sin respuesta de la base de datos.'} Revisa la venta antes de entregar o cobrar de nuevo.`,
          success: null,
        }
      }

      if (itemData && item.treatmentIds && item.treatmentIds.length > 0) {
        // Retrieve treatment details to get prices at time of sale
        const { data: treatmentsData } = await supabase
          .from('lens_treatments')
          .select('id, price')
          .in('id', item.treatmentIds)

        if (treatmentsData) {
          const treatmentsToInsert = treatmentsData.map(t => ({
            sale_item_id: itemData.id,
            treatment_id: t.id,
            price: t.price
          }))
          const { error: treatmentsError } = await supabase.from('sale_item_treatments').insert(treatmentsToInsert)
          if (treatmentsError) {
            return {
              error: `La venta quedó registrada (id ${saleData.id}) pero los tratamientos de una partida no se pudieron guardar: ${treatmentsError.message}`,
              success: null,
            }
          }
        }
      }

      // Decrement stock through the decrement_stock RPC (atomic UPDATE,
      // clamped at 0 — products.stock has a CHECK (stock >= 0)). If the
      // RPC is unavailable (migration not applied yet), fall back to a
      // manual read-modify-write whose errors are CHECKED and clamped the
      // same way; the previous fallback ignored the update error and
      // could drive stock negative. A stock failure stays non-fatal to
      // the completed sale (same policy as the POS) but is always logged.
      const { error: rpcError } = await supabase.rpc('decrement_stock', {
        product_id: item.productId,
        qty: item.quantity,
      })
      if (rpcError) {
        console.error('decrement_stock RPC failed, using manual decrement:', rpcError.message)
        const { data: prodRow, error: prodReadError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single()
        if (prodReadError || !prodRow) {
          console.error('Manual stock decrement: product read failed:', prodReadError?.message)
        } else {
          const { error: prodUpdateError } = await supabase
            .from('products')
            .update({ stock: Math.max(0, prodRow.stock - item.quantity) })
            .eq('id', item.productId)
          if (prodUpdateError) {
            console.error('Manual stock decrement failed:', prodUpdateError.message)
          }
        }
      }
    }

    // 2.5 Generate installments if plan is installments
    if (paymentPlanType === 'installments' && pendingBalance > 0) {
      try {
        const paymentFrequency = formData.get('paymentFrequency') as string
        const firstPaymentDate = formData.get('firstPaymentDate') as string
        const numInstallments = parseInt(formData.get('numInstallments') as string) || 6
        const installmentAmount = pendingBalance / numInstallments
        
        const frequencyDays = paymentFrequency === 'weekly' ? 7 : paymentFrequency === 'biweekly' ? 15 : 30
        let baseDate = new Date(firstPaymentDate + 'T12:00:00')
        
        const installmentsToInsert = []
        for (let i = 1; i <= numInstallments; i++) {
          if (i > 1) {
            baseDate = new Date(baseDate.getTime() + frequencyDays * 24 * 60 * 60 * 1000)
          }
          installmentsToInsert.push({
            sale_id: saleData.id,
            installment_number: i,
            due_date: baseDate.toISOString().split('T')[0],
            amount: installmentAmount,
            status: 'pending'
          })
        }
        
        const { error: installmentsError } = await supabase.from('payment_installments').insert(installmentsToInsert)
        if (installmentsError) {
          // The sale exists but its payment plan does not: the balance
          // would never be collected. Surface it instead of logging only.
          return {
            error: `La venta quedó registrada (id ${saleData.id}) pero no se pudieron generar las cuotas: ${installmentsError.message}`,
            success: null,
          }
        }
      } catch (e) {
        console.error('Failed to create payment installments in Supabase:', e)
        return {
          error: `La venta quedó registrada (id ${saleData.id}) pero no se pudieron generar las cuotas: ${e instanceof Error ? e.message : 'error inesperado.'}`,
          success: null,
        }
      }
    }

    // 3. Create a reminder for the next visit (configured period, 6 months by default)
    try {
      const reminderMonths = await reminderMonthsServer(supabase)
      await supabase.from('reminders').insert([{
        customer_id: customerId,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: addMonthsISO(new Date(), reminderMonths),
        status: 'pending',
      }])
    } catch { /* ignore reminder errors if table schema differs */ }

    revalidatePath(`/customers/${customerId}`, 'layout')
    revalidatePath('/dashboard/admin', 'layout')
    
    const balanceMsg = pendingBalance > 0 
      ? ` • Anticipo cobrado: $${paidAmount.toFixed(2)} • Adeudo pendiente: $${pendingBalance.toFixed(2)}`
      : ' • Pago completo recibido'
    return { success: `¡Venta registrada! Total: $${total.toFixed(2)} MXN${balanceMsg}`, error: null }
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the sale failed before completing:
      // report the real error. Building the sale in the in-memory mock
      // list here would show the owner a «registered» sale (with totals
      // and balances) that the business never recorded.
      console.error('createLinkedSaleAction failed:', err)
      return {
        error: `No se pudo registrar la venta: ${err.message || 'error de conexión con la base de datos.'}`,
        success: null,
      }
    }
    console.warn('Supabase not configured; registering linked sale in local demo mode:', err.message)

    // FALLBACK MOCK WRITE (demo mode only — no database configured)
    const saleId = 's_' + Math.random().toString(36).substr(2, 9)
    let subtotal = 0

    items.forEach((item: any) => {
      const itemId = 'si_' + Math.random().toString(36).substr(2, 9)
      const finalUnitPrice = item.price + (item.lensMaterialPrice || 0) + (item.treatmentsPrice || 0)
      subtotal += finalUnitPrice * item.quantity

      // Save treatments in mock treatments table
      if (item.treatmentIds && item.treatmentIds.length > 0) {
        item.treatmentIds.forEach((tId: string) => {
          const tDetail = mockDb.MOCK_LENS_TREATMENTS.find(t => t.id === tId)
          mockDb.MOCK_SALE_ITEM_TREATMENTS.push({
            sale_item_id: itemId,
            treatment_id: tId,
            price: tDetail ? tDetail.price : 0
          })
        })
      }

      const mockItem = {
        id: itemId,
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        is_complement: false,
        complement_name: null,
        complement_for: null,
        // Product unit price only — same decomposition as the real insert
        // (material and treatments are stored as separate components).
        price: item.price,
        lens_material_id: item.lensMaterialId || null,
        lens_material_price: item.lensMaterialPrice || 0,
        od_sphere: item.od_sphere ? parseFloat(item.od_sphere) : null,
        od_cylinder: item.od_cylinder ? parseFloat(item.od_cylinder) : null,
        od_axis: item.od_axis ? parseInt(item.od_axis) : null,
        od_add: item.od_add ? parseFloat(item.od_add) : null,
        oi_sphere: item.oi_sphere ? parseFloat(item.oi_sphere) : null,
        oi_cylinder: item.oi_cylinder ? parseFloat(item.oi_cylinder) : null,
        oi_axis: item.oi_axis ? parseInt(item.oi_axis) : null,
        oi_add: item.oi_add ? parseFloat(item.oi_add) : null,
        pd_distance: item.pd_distance ? parseFloat(item.pd_distance) : null,
      }
      mockDb.MOCK_SALE_ITEMS.push(mockItem)
    })

    const couponCode = (formData.get('couponCode') as string)?.trim().toUpperCase()
    let discountAmount = 0
    if (couponCode) {
      const coupon = mockDb.MOCK_COUPONS.find(c => c.code === couponCode)
      if (coupon && coupon.is_active) {
        discountAmount = subtotal * (coupon.discount_percent / 100)
      }
    }
    const total = subtotal - discountAmount

    let paidAmount: number
    if (paymentPlanType === 'single') {
      paidAmount = total
    } else {
      const parsed = parseFloat(paidAmountRaw?.replace(/,/g, '') || '0')
      paidAmount = isNaN(parsed) ? 0 : Math.min(parsed, total)
    }
    const pendingBalance = Math.max(0, total - paidAmount)

    let saleStatus: 'Cotizacion' | 'Anticipo_Pagado' | 'En_Taller' | 'Listo_Entrega' | 'Entregado' = 'Cotizacion'
    if (paidAmount >= total) {
      saleStatus = 'Listo_Entrega'
    } else if (paidAmount > 0) {
      saleStatus = 'Anticipo_Pagado'
    }

    const newMockSale = {
      id: saleId,
      customer_id: customerId,
      customer_name: 'Cliente Mock',
      seller_id: 'sell-1',
      seller_name: 'Patricia Vendedora',
      exam_id: examId || null,
      coupon_id: null,
      discount_applied: discountAmount,
      notes: saleNotes || null,
      total,
      paid_amount: paidAmount,
      pending_balance: pendingBalance,
      payment_method: paymentMethod,
      status: saleStatus,
      is_prescription_visible: isPrescriptionVisible,
      created_at: new Date().toISOString()
    }

    mockDb.MOCK_SALES.push(newMockSale as any)

    // Generate mock installments
    if (paymentPlanType === 'installments' && pendingBalance > 0) {
      const paymentFrequency = formData.get('paymentFrequency') as string
      const firstPaymentDate = formData.get('firstPaymentDate') as string
      const numInstallments = parseInt(formData.get('numInstallments') as string) || 6
      const installmentAmount = pendingBalance / numInstallments
      
      const frequencyDays = paymentFrequency === 'weekly' ? 7 : paymentFrequency === 'biweekly' ? 15 : 30
      let baseDate = new Date(firstPaymentDate + 'T12:00:00')
      
      for (let i = 1; i <= numInstallments; i++) {
        if (i > 1) {
          baseDate = new Date(baseDate.getTime() + frequencyDays * 24 * 60 * 60 * 1000)
        }
        mockDb.MOCK_PAYMENT_INSTALLMENTS.push({
          id: 'inst_' + Math.random().toString(36).substr(2, 9),
          sale_id: saleId,
          installment_number: i,
          due_date: baseDate.toISOString().split('T')[0],
          amount: installmentAmount,
          status: 'pending',
          created_at: new Date().toISOString()
        })
      }
    }

    // Add reminder
    mockDb.MOCK_REMINDERS.push({
      id: 'rem_' + Math.random().toString(36).substr(2, 9),
      customer_id: customerId,
      last_visit_date: new Date().toISOString(),
      next_suggested_visit: addMonthsISO(new Date(), DEFAULT_REMINDER_MONTHS),
      status: 'pending',
      created_at: new Date().toISOString()
    } as any)

    revalidatePath(`/customers/${customerId}`, 'layout')
    revalidatePath('/dashboard/admin', 'layout')

    const balanceMsg = pendingBalance > 0 
      ? ` • Anticipo cobrado: $${paidAmount.toFixed(2)} • Adeudo pendiente: $${pendingBalance.toFixed(2)}`
      : ' • Pago completo recibido'
    return { success: `¡Venta registrada (Mock)! Total: $${total.toFixed(2)} MXN${balanceMsg}`, error: null }
  }
}

/**
 * Updates a customer profile (auth email, public profile, and clinical customer_profile).
 */
export async function updateCustomerAction(customerId: string, data: {
  fullName: string
  username: string
  phone?: string
  dateOfBirth?: string
  address?: string
  occupation?: string
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'NS'
  medicalNotes?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}) {
  try {
    const adminClient = createAdminClient() as any
    const formattedEmail = formatToEmail(data.username)

    // 1. Update Supabase Auth user
    const { error: authError } = await adminClient.auth.admin.updateUserById(customerId, {
      email: formattedEmail,
      user_metadata: {
        full_name: data.fullName,
      }
    })

    if (authError) {
      return { error: `Error en Autenticación: ${authError.message}` }
    }

    // 2. Update public.profiles table
    const { error: dbError } = await adminClient
      .from('profiles')
      .update({
        full_name: data.fullName,
        email: formattedEmail,
      })
      .eq('id', customerId)

    if (dbError) {
      return { error: `Error al actualizar perfil: ${dbError.message}` }
    }

    // 3. Update public.customer_profiles table
    const { error: cpError } = await adminClient
      .from('customer_profiles')
      .upsert({
        id: customerId,
        phone: data.phone || null,
        date_of_birth: data.dateOfBirth || null,
        address: data.address || null,
        occupation: data.occupation || null,
        blood_type: data.bloodType || null,
        medical_notes: data.medicalNotes || null,
        emergency_contact_name: data.emergencyContactName || null,
        emergency_contact_phone: data.emergencyContactPhone || null,
      })

    if (cpError) {
      return { error: `Error al actualizar datos clínicos: ${cpError.message}` }
    }

    revalidatePath('/customers', 'layout')
    revalidatePath(`/customers/${customerId}`, 'layout')
    revalidatePath('/dashboard/admin', 'layout')
    return { success: 'Datos del cliente actualizados con éxito.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado.' }
  }
}

/**
 * Server action to get sales history for current logged-in customer.
 * Securely censors visual exam prescriptions if 'is_prescription_visible' is false.
 */
export async function getMySalesAction(): Promise<any[]> {
  let isMock = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        coupon:coupons(code, discount_percent),
        sale_items(
          id,
          quantity,
          price,
          is_complement,
          complement_name,
          complement_for,
          product:products(name, category),
          lens_material:lens_materials(name, price),
          lens_material_price,
          od_sphere,
          od_cylinder,
          od_axis,
          od_add,
          oi_sphere,
          oi_cylinder,
          oi_axis,
          oi_add,
          pd_distance,
          sale_item_treatments(
            price,
            treatment:lens_treatments(name)
          )
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    if (data) {
      return data.map((sale: any) => {
        // Owner's rule (2026-11-09): the customer NEVER receives their
        // prescription values, whatever the per-sale flag says.
        const isVisible = false
        const censoredSaleItems = sale.sale_items?.map((item: any) => {
          if (!isVisible) {
            return {
              ...item,
              od_sphere: null,
              od_cylinder: null,
              od_axis: null,
              od_add: null,
              oi_sphere: null,
              oi_cylinder: null,
              oi_axis: null,
              oi_add: null,
              pd_distance: null
            }
          }
          return item
        })
        return {
          ...sale,
          sale_items: censoredSaleItems
        }
      })
    }
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the read failed: return an empty
      // history (and log the real error) instead of showing the customer
      // every demo sale in the system as if they were their purchases.
      console.error('getMySalesAction failed:', err)
      return []
    }
    console.warn('Supabase not configured; getMySalesAction running in local demo mode:', err.message)
    isMock = true
  }

  if (isMock) {
    // Fallback: Filter MOCK_SALES and map elements
    const mockSales = mockDb.MOCK_SALES.map((sale: any) => {
      const items = mockDb.MOCK_SALE_ITEMS.filter(si => si.sale_id === sale.id).map((si: any) => {
        const prod = mockDb.MOCK_PRODUCTS.find(p => p.id === si.product_id)
        const material = mockDb.MOCK_LENS_MATERIALS.find(m => m.id === si.lens_material_id)
        const treatments = mockDb.MOCK_SALE_ITEM_TREATMENTS.filter(sit => sit.sale_item_id === si.id).map(sit => {
          const t = mockDb.MOCK_LENS_TREATMENTS.find(t => t.id === sit.treatment_id)
          return {
            price: sit.price,
            treatment: { name: t ? t.name : 'Tratamiento Extra' }
          }
        })
        
        // Owner's rule (2026-11-09): the customer NEVER receives their
        // prescription values, whatever the per-sale flag says.
        const isVisible = false

        return {
          id: si.id,
          quantity: si.quantity,
          price: si.price,
          product: prod ? { name: prod.name, category: prod.category } : { name: 'Armazón Carey', category: 'frames' },
          lens_material: material ? { name: material.name, price: material.price } : null,
          lens_material_price: si.lens_material_price || 0,
          od_sphere: isVisible ? si.od_sphere : null,
          od_cylinder: isVisible ? si.od_cylinder : null,
          od_axis: isVisible ? si.od_axis : null,
          od_add: isVisible ? si.od_add : null,
          oi_sphere: isVisible ? si.oi_sphere : null,
          oi_cylinder: isVisible ? si.oi_cylinder : null,
          oi_axis: isVisible ? si.oi_axis : null,
          oi_add: isVisible ? si.oi_add : null,
          pd_distance: isVisible ? si.pd_distance : null,
          sale_item_treatments: treatments
        }
      })

      return {
        ...sale,
        sale_items: items
      }
    })
    return mockSales
  }
  return []
}

/**
 * Registers a payment for a specific installment, updates sales balance and inserts a notification.
 */
export async function registerInstallmentPaymentAction(
  installmentId: string,
  amountPaid: number,
  paymentMethod: 'cash' | 'card' | 'transfer'
): Promise<{ success: string | null; error: string | null }> {
  try {
    const supabase = await createClient()

    // 1. Get the installment and joined sale
    const { data: installment, error: instError } = await supabase
      .from('payment_installments')
      .select(`
        *,
        sale:sales(*)
      `)
      .eq('id', installmentId)
      .single()

    if (instError || !installment) {
      throw new Error('No se encontró la cuota de pago: ' + (instError?.message || ''))
    }

    const sale = (installment as any).sale
    if (!sale) {
      throw new Error('No se encontró la venta asociada a la cuota.')
    }

    // Partial payments accumulate on the installment: it is only 'paid'
    // when the accumulated amount covers the installment amount in full.
    const installmentAmount = Number(installment.amount) || 0
    const alreadyPaidOnInstallment = Number((installment as any).amount_paid) || 0
    const remainingOnInstallment = Math.max(0, installmentAmount - alreadyPaidOnInstallment)

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return { success: null, error: 'El abono debe ser mayor que cero.' }
    }
    if (amountPaid > remainingOnInstallment + 0.01) {
      return { success: null, error: 'El abono supera el saldo de esta cuota.' }
    }

    const newInstallmentPaid = alreadyPaidOnInstallment + amountPaid
    const installmentSettled = newInstallmentPaid >= installmentAmount - 0.005

    const newPaidAmount = Number(sale.paid_amount) + amountPaid
    const newPendingBalance = Math.max(0, Number(sale.pending_balance) - amountPaid)

    // 2. Update installment status (paid only when fully covered)
    const { error: updateInstError } = await supabase
      .from('payment_installments')
      .update({
        amount_paid: newInstallmentPaid,
        status: installmentSettled ? 'paid' : 'pending',
        payment_date: installmentSettled ? new Date().toISOString() : installment.payment_date
      })
      .eq('id', installmentId)

    if (updateInstError) {
      throw new Error('Error al actualizar la cuota: ' + updateInstError.message)
    }

    // 3. Update sale balance
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({
        paid_amount: newPaidAmount,
        pending_balance: newPendingBalance,
        payment_method: paymentMethod
      })
      .eq('id', sale.id)

    if (updateSaleError) {
      throw new Error('Error al actualizar la venta: ' + updateSaleError.message)
    }

    // 4. Create customer notification
    if (sale.customer_id) {
      const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amountPaid)
      const formattedBalance = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(newPendingBalance)
      
      await supabase
        .from('notifications')
        .insert([{
          user_id: sale.customer_id,
          title: 'Pago Recibido Exitosamente ✅',
          message: `Confirmamos tu abono de ${formattedAmount}. Tu saldo restante es de ${formattedBalance}.`,
          type: 'general',
          is_read: false
        }])
    }

    revalidatePath('/', 'layout')
    return {
      success: installmentSettled
        ? '¡Pago registrado exitosamente y saldo actualizado!'
        : `Abono registrado. A esta cuota aún le faltan $${Math.max(0, installmentAmount - newInstallmentPaid).toFixed(2)} para liquidarse.`,
      error: null
    }
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the payment was NOT recorded: report
      // the real error. The mock fallback previously answered «¡Pago
      // registrado exitosamente (Offline fallback)!» for money the
      // business never received in its records.
      console.error('registerInstallmentPaymentAction failed:', err)
      return { error: 'Fallo al registrar el pago: ' + (err.message || 'error de conexión con la base de datos.'), success: null }
    }
    console.warn('Supabase not configured; registerInstallmentPaymentAction running in local demo mode:', err.message)

    // Fallback Mock (demo mode only — no database configured)
    const inst = mockDb.MOCK_PAYMENT_INSTALLMENTS.find(i => i.id === installmentId)
    if (inst) {
      const newInstPaid = (Number((inst as any).amount_paid) || 0) + amountPaid
      ;(inst as any).amount_paid = newInstPaid
      if (newInstPaid >= Number(inst.amount) - 0.005) {
        inst.status = 'paid'
        inst.payment_date = new Date().toISOString()
      }

      const sale = mockDb.MOCK_SALES.find(s => s.id === inst.sale_id)
      if (sale) {
        sale.paid_amount = (sale.paid_amount || 0) + amountPaid
        sale.pending_balance = Math.max(0, (sale.pending_balance || 0) - amountPaid)
        sale.payment_method = paymentMethod

        if (sale.customer_id) {
          const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amountPaid)
          const formattedBalance = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sale.pending_balance)

          mockDb.MOCK_NOTIFICATIONS.push({
            id: 'n_' + Math.random().toString(36).substr(2, 9),
            user_id: sale.customer_id,
            title: 'Pago Recibido Exitosamente ✅',
            message: `Confirmamos tu abono de ${formattedAmount}. Tu saldo restante es de ${formattedBalance}.`,
            type: 'general',
            is_read: false,
            created_at: new Date().toISOString()
          })
        }
      }
      return { success: '¡Pago registrado exitosamente (Offline fallback)!', error: null }
    }

    return { error: 'Fallo al registrar el pago: ' + err.message, success: null }
  }
}

/**
 * Registers an abono against a sale that carries a pending balance but
 * has NO installments — the POS anticipo case: createSale stores
 * pending_balance > 0 without generating cuotas, and the Cobranza tab
 * only knew how to collect per-cuota, leaving that balance unpayable
 * from the app.
 *
 * On the first abono it creates ONE mirror installment for the sale's
 * full pending balance, shaped EXACTLY like the installments the plazo
 * flow generates in createSaleAction (same table and columns:
 * sale_id, installment_number starting at 1, due_date as an ISO date,
 * amount, status 'pending'). A contado sale's remainder is already
 * owed, so the mirror cuota's due_date is today. The payment itself is
 * then applied by registerInstallmentPaymentAction, so paid_amount,
 * pending_balance and the payment_date semantics stay identical to
 * the rest of the system. Sales that already have cuotas are rejected
 * here: their abonos keep going through the per-cuota flow, unchanged.
 */
export async function registerSaleBalancePaymentAction(
  saleId: string,
  amountPaid: number,
  paymentMethod: 'cash' | 'card' | 'transfer'
): Promise<{ success: string | null; error: string | null }> {
  try {
    const supabase = await createClient()

    // 1. The sale and its outstanding balance.
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, pending_balance')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      throw new Error('No se encontró la venta: ' + (saleError?.message || ''))
    }

    const pendingBalance = Number(sale.pending_balance) || 0
    if (pendingBalance <= 0) {
      return { success: null, error: 'Esta venta ya no tiene saldo pendiente.' }
    }
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return { success: null, error: 'El abono debe ser mayor que cero.' }
    }
    if (amountPaid > pendingBalance + 0.01) {
      return { success: null, error: 'El abono supera el saldo pendiente de la venta.' }
    }

    // 2. A sale that already has cuotas collects per-cuota, as today.
    const { data: existing, error: existingError } = await supabase
      .from('payment_installments')
      .select('id')
      .eq('sale_id', saleId)
      .limit(1)

    if (existingError) {
      throw new Error('Error al revisar las cuotas de la venta: ' + existingError.message)
    }
    if (existing && existing.length > 0) {
      return { success: null, error: 'Esta venta ya tiene cuotas registradas; registra el abono desde la cuota correspondiente.' }
    }

    // 3. Mirror installment for the full pending balance (single cuota,
    // due today — see the header comment for the mirrored shape).
    const { data: mirror, error: mirrorError } = await supabase
      .from('payment_installments')
      .insert([{
        sale_id: saleId,
        installment_number: 1,
        due_date: new Date().toISOString().split('T')[0],
        amount: pendingBalance,
        status: 'pending'
      }])
      .select('id')
      .single()

    if (mirrorError || !mirror) {
      throw new Error('No se pudo generar la cuota del saldo: ' + (mirrorError?.message || ''))
    }

    // 4. The payment itself goes through the one and only abono action.
    return await registerInstallmentPaymentAction(mirror.id, amountPaid, paymentMethod)
  } catch (err: any) {
    if (isSupabaseConfigured()) {
      // A database IS configured and the payment was NOT recorded:
      // report the real error, never a dressed-up success.
      console.error('registerSaleBalancePaymentAction failed:', err)
      return { error: 'Fallo al registrar el abono: ' + (err.message || 'error de conexión con la base de datos.'), success: null }
    }
    console.warn('Supabase not configured; registerSaleBalancePaymentAction running in local demo mode:', err.message)

    // Fallback Mock (demo mode only — no database configured): same
    // mirror cuota over the local data, same abono registration.
    const sale = mockDb.MOCK_SALES.find(s => s.id === saleId)
    if (!sale) {
      return { error: 'No se encontró la venta.', success: null }
    }
    const pendingBalance = Number(sale.pending_balance || 0)
    if (pendingBalance <= 0) {
      return { success: null, error: 'Esta venta ya no tiene saldo pendiente.' }
    }
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return { success: null, error: 'El abono debe ser mayor que cero.' }
    }
    if (amountPaid > pendingBalance + 0.01) {
      return { success: null, error: 'El abono supera el saldo pendiente de la venta.' }
    }
    if (mockDb.MOCK_PAYMENT_INSTALLMENTS.some(i => i.sale_id === saleId)) {
      return { success: null, error: 'Esta venta ya tiene cuotas registradas; registra el abono desde la cuota correspondiente.' }
    }
    const mirror: mockDb.MockPaymentInstallment = {
      id: 'inst_' + Math.random().toString(36).substr(2, 9),
      sale_id: saleId,
      installment_number: 1,
      due_date: new Date().toISOString().split('T')[0],
      amount: pendingBalance,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    mockDb.MOCK_PAYMENT_INSTALLMENTS.push(mirror)
    return await registerInstallmentPaymentAction(mirror.id, amountPaid, paymentMethod)
  }
}



/**
 * Updates ONLY the general data of a customer (nombre, teléfono,
 * fecha de nacimiento y dirección) — the «Actualizar datos» modal on
 * the customer file. Deliberately narrower than updateCustomerAction:
 * it never touches the auth account, the username/email or the role,
 * so completing a quick-registered customer can never lock them out
 * of their account.
 *
 * Roles: only staff (super_admin / owner / optometrist / seller) may
 * edit a customer's data. The write goes through the admin client
 * because the RLS policies only let owner/dev update profiles and
 * customer_profiles from the browser client; the caller's staff role
 * is verified here, server-side, before any write happens.
 */
export async function updateCustomerGeneralDataAction(customerId: string, data: {
  fullName: string
  phone?: string
  dateOfBirth?: string
  address?: string
}): Promise<{ success: string | null; error: string | null }> {
  const fullName = (data.fullName || '').trim()
  const phone = (data.phone || '').trim()
  const dateOfBirth = (data.dateOfBirth || '').trim()
  const address = (data.address || '').trim()

  if (!customerId) {
    return { success: null, error: 'ID de cliente requerido.' }
  }
  if (!fullName) {
    return { success: null, error: 'El nombre completo es obligatorio.' }
  }
  if (phone) {
    // La regla corre sobre el número LOCAL, ya sin el prefijo
    // elegido en la captura (+52 / +1 / otro).
    if (splitPhonePrefix(phone).local.length < 10) {
      return { success: null, error: 'El teléfono debe tener al menos 10 dígitos.' }
    }
  }
  if (dateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return { success: null, error: 'La fecha de nacimiento no es válida.' }
    }
    const parsed = new Date(`${dateOfBirth}T12:00:00`)
    if (isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
      return { success: null, error: 'La fecha de nacimiento no es válida.' }
    }
  }

  if (!isSupabaseConfigured()) {
    // Demo mode: mirror the edit in the in-memory mocks (the client
    // services layer applies the same change to the browser copy).
    mockDb.updateMockCustomerGeneralData(customerId, {
      full_name: fullName,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      address: address || null,
    })
    revalidatePath('/customers', 'layout')
    revalidatePath(`/customers/${customerId}`, 'layout')
    return { success: 'Datos del cliente actualizados con éxito.', error: null }
  }

  try {
    // 1. Verify the caller is signed in and holds a staff role.
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      return { success: null, error: 'Sesión no válida. Vuelve a iniciar sesión.' }
    }

    const adminClient = createAdminClient() as any
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isStaffRole(callerProfile?.role)) {
      return { success: null, error: 'Solo el personal de la óptica puede editar los datos de un cliente.' }
    }

    // 2. Nombre (profiles). The update must come back with the row:
    // zero rows back means the customer does not exist (or the write
    // was blocked) and must surface as an error, never as success.
    const { data: updatedProfile, error: profileError } = await adminClient
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', customerId)
      .select('id')

    if (profileError) {
      return { success: null, error: `Error al actualizar el nombre: ${profileError.message}` }
    }
    if (!updatedProfile || updatedProfile.length === 0) {
      return { success: null, error: 'No se encontró el cliente a actualizar.' }
    }

    // 3. Datos generales (customer_profiles). Upsert with ONLY these
    // columns: on conflict the rest of the row (ocupación, antecedentes,
    // contacto de emergencia) keeps its stored values.
    const { data: upsertedCp, error: cpError } = await adminClient
      .from('customer_profiles')
      .upsert({
        id: customerId,
        phone: phone || null,
        date_of_birth: dateOfBirth || null,
        address: address || null,
      })
      .select('id')

    if (cpError) {
      return { success: null, error: `Error al actualizar los datos: ${cpError.message}` }
    }
    if (!upsertedCp || upsertedCp.length === 0) {
      return { success: null, error: 'No se pudieron guardar los datos del cliente.' }
    }

    revalidatePath('/customers', 'layout')
    revalidatePath(`/customers/${customerId}`, 'layout')
    return { success: 'Datos del cliente actualizados con éxito.', error: null }
  } catch (err: any) {
    console.error('updateCustomerGeneralDataAction failed:', err)
    return { success: null, error: `No se pudieron actualizar los datos: ${err.message || 'error inesperado.'}` }
  }
}

/**
 * Reestructura los pagos de una venta con saldo pendiente (dictado
 * 2026-11-19, ficha del cliente → Cobranza): SOLO administrador /
 * superadministrador — la verificación de rol corre aquí, en el
 * servidor, con la sesión real (el botón de la ficha es solo la
 * puerta amable; un vendedor u optometrista que invoque la acción
 * por fuera es rechazado).
 *
 * Efecto: el costo por refinanciación (si lo hay) es un recargo real
 * — suma a total y a pending_balance de la venta y deja línea
 * fechada en sus notas —; las cuotas NO liquidadas se retiran y se
 * insertan las nuevas dividiendo el saldo resultante (Σ EXACTA, la
 * última absorbe el redondeo), y la operación queda en el historial
 * estructurado sale_refinancings. Las cuotas liquidadas por completo
 * quedan como historial y paid_amount NO se toca. Las parcialmente
 * pagadas se sustituyen como las demás pendientes: lo abonado en
 * ellas ya vive neto en el paid_amount de la venta, así que no se
 * pierde — el plan nuevo divide el pending_balance vigente.
 *
 * Los avisos de cobro (campanita, WhatsApp de cobranza, Pagos
 * diferidos y la propia Cobranza) leen EN VIVO de
 * payment_installments y del saldo de la venta: no existe en el
 * código ningún aviso payment_reminder creado con montos/fechas
 * congelados, así que al sustituir las cuotas todas esas vistas
 * reflejan el plan nuevo sin regeneración extra.
 */
export async function restructureSalePaymentsAction(
  saleId: string,
  input: {
    feeAmount: number
    installmentsCount: number
    frequency: string
    firstDueDate: string
  }
): Promise<{ success: string | null; error: string | null }> {
  if (!saleId) {
    return { success: null, error: 'Venta requerida.' }
  }
  const fee = Number(input?.feeAmount)
  if (!Number.isFinite(fee) || fee < 0) {
    return { success: null, error: 'El costo por refinanciación no es válido.' }
  }
  const feeRounded = Math.round(fee * 100) / 100
  const count = Math.floor(Number(input?.installmentsCount))
  if (!Number.isFinite(count) || count < 1 || count > 60) {
    return { success: null, error: 'El número de pagos debe ser entre 1 y 60.' }
  }
  if (!isPaymentFrequency(input?.frequency || '')) {
    return { success: null, error: 'La frecuencia no es válida.' }
  }
  const frequency = input.frequency as PaymentFrequency
  const firstDueDate = (input?.firstDueDate || '').trim()
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate) ||
    isNaN(new Date(`${firstDueDate}T12:00:00`).getTime())
  ) {
    return { success: null, error: 'La fecha de inicio no es válida.' }
  }

  if (!isSupabaseConfigured()) {
    // Demo mode: the same operation over the in-memory mocks.
    const result = mockDb.restructureMockSalePayments(saleId, {
      feeAmount: feeRounded,
      installmentsCount: count,
      frequency,
      firstDueDate,
    })
    if (!result) {
      return { success: null, error: 'No se encontró la venta a reestructurar.' }
    }
    revalidatePath('/customers', 'layout')
    revalidatePath('/payments')
    return { success: 'Pagos reestructurados con éxito.', error: null }
  }

  try {
    // 1. Verify the caller is signed in and is ADMIN (owner /
    //    super_admin) — vendedor y optometrista quedan fuera aunque
    //    invoquen la acción directamente.
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      return { success: null, error: 'Sesión no válida. Vuelve a iniciar sesión.' }
    }

    const adminClient = createAdminClient() as any
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isAdminRole(callerProfile?.role)) {
      return { success: null, error: 'Solo el administrador puede reestructurar pagos.' }
    }

    // 2. La venta y sus cuotas actuales.
    const { data: sale, error: saleError } = await adminClient
      .from('sales')
      .select('id, customer_id, total, paid_amount, pending_balance, notes')
      .eq('id', saleId)
      .single()
    if (saleError || !sale) {
      return { success: null, error: 'No se encontró la venta a reestructurar.' }
    }

    const previousPaid = Number(sale.paid_amount || 0)
    const previousPending = Number(sale.pending_balance || 0)
    if (previousPending <= 0) {
      return { success: null, error: 'Esta venta ya no tiene saldo pendiente.' }
    }

    const { data: installments, error: instError } = await adminClient
      .from('payment_installments')
      .select('id, installment_number, amount, amount_paid, status')
      .eq('sale_id', saleId)
    if (instError) {
      return { success: null, error: `No se pudieron leer las cuotas actuales: ${instError.message}` }
    }

    const isSettled = (i: any) =>
      i.status === 'paid' || Number(i.amount_paid || 0) >= Number(i.amount || 0)
    const kept = (installments || []).filter(isSettled)
    const replaced = (installments || []).filter((i: any) => !isSettled(i))

    const newPending = Math.round((previousPending + feeRounded) * 100) / 100
    const newTotal = Math.round((Number(sale.total || 0) + feeRounded) * 100) / 100

    // 3. Retirar las cuotas NO liquidadas (las liquidadas quedan).
    if (replaced.length > 0) {
      const { error: delError } = await adminClient
        .from('payment_installments')
        .delete()
        .in('id', replaced.map((i: any) => i.id))
      if (delError) {
        return { success: null, error: `No se pudieron retirar las cuotas anteriores: ${delError.message}` }
      }
    }

    // 4. Cuotas nuevas sobre el saldo resultante, numeración tras las
    //    conservadas; Σ EXACTA == pending_balance resultante.
    const startNumber =
      kept.reduce((m: number, i: any) => Math.max(m, Number(i.installment_number || 0)), 0) + 1
    const schedule = buildInstallmentSchedule(newPending, count, frequency, firstDueDate, startNumber)
    const { error: insError } = await adminClient
      .from('payment_installments')
      .insert(
        schedule.map(spec => ({
          sale_id: saleId,
          installment_number: spec.installment_number,
          due_date: spec.due_date,
          amount: spec.amount,
          status: 'pending',
          amount_paid: 0,
        }))
      )
    if (insError) {
      return {
        success: null,
        error: `No se pudieron crear las cuotas nuevas: ${insError.message}. La venta conserva su saldo y puede reestructurarse de nuevo.`,
      }
    }

    // 5. Recargo real sobre la orden + línea fechada en notas.
    if (feeRounded > 0) {
      const fecha = new Date().toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      const linea = `Refinanciación ${fecha}: +$${feeRounded.toFixed(2)} por reestructura de pagos`
      const notes = sale.notes ? `${sale.notes}\n${linea}` : linea
      const { error: updError } = await adminClient
        .from('sales')
        .update({ total: newTotal, pending_balance: newPending, notes })
        .eq('id', saleId)
      if (updError) {
        return {
          success: null,
          error: `Las cuotas nuevas ya se crearon, pero no se pudo aplicar el recargo a la venta: ${updError.message}`,
        }
      }
    }

    // 6. Historial estructurado. Si la tabla aún no existe, la
    //    reestructura ya quedó aplicada y la línea en notas es el
    //    respaldo: se registra el fallo y se sigue.
    const { error: histError } = await adminClient
      .from('sale_refinancings')
      .insert([
        {
          sale_id: saleId,
          customer_id: sale.customer_id,
          created_by: user.id,
          previous_paid_amount: previousPaid,
          previous_pending_balance: previousPending,
          replaced_installments: replaced.length,
          fee_amount: feeRounded,
          new_total: newTotal,
          installments_count: count,
          frequency,
          first_due_date: firstDueDate,
          installment_amount: schedule[0]?.amount ?? 0,
        },
      ])
    if (histError) {
      console.error(
        'Refinancing history insert failed (restructure applied; notes line is the backup):',
        histError.message
      )
    }

    revalidatePath('/customers', 'layout')
    if (sale.customer_id) revalidatePath(`/customers/${sale.customer_id}`, 'layout')
    revalidatePath('/payments')
    return { success: 'Pagos reestructurados con éxito.', error: null }
  } catch (err: any) {
    console.error('restructureSalePaymentsAction failed:', err)
    return { success: null, error: `No se pudo reestructurar los pagos: ${err.message || 'error inesperado.'}` }
  }
}
