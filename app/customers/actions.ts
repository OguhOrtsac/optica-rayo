'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import * as mockDb from '@/lib/mocks'
import { addMonthsISO, DEFAULT_REMINDER_MONTHS, REMINDER_MONTHS_KEY } from '@/lib/reminder-config'
import { effectiveClientPrice, MEMBER_DISCOUNT_KEY, DEFAULT_MEMBER_DISCOUNT_PERCENT } from '@/lib/pricing'

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

/**
 * Reads the general member discount percent from app_settings (server side).
 * Falls back to the default (20%) when unset or unreadable.
 */
async function memberDiscountServer(client?: any): Promise<number> {
  if (client) {
    try {
      const { data } = await client
        .from('app_settings')
        .select('value')
        .eq('key', MEMBER_DISCOUNT_KEY)
        .single()
      const n = parseFloat(data?.value ?? '')
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n
    } catch {
      // use default below
    }
  }
  return DEFAULT_MEMBER_DISCOUNT_PERCENT
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

    examPayload = {
      customer_id: customerId,
      examiner_id: user?.id || null,
      exam_date: new Date().toISOString(),
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

    const { data, error } = await supabase
      .from('clinical_exams')
      .insert([examPayload])
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
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
      exam_date: new Date().toISOString(),
      next_exam_date: examPayload.next_exam_date || null,
      od_sphere: examPayload.od_sphere || null,
      od_cylinder: examPayload.od_cylinder || null,
      od_axis: examPayload.od_axis || null,
      od_add: examPayload.od_add || null,
      oi_sphere: examPayload.oi_sphere || null,
      oi_cylinder: examPayload.oi_cylinder || null,
      oi_axis: examPayload.oi_axis || null,
      oi_add: examPayload.oi_add || null,
      pd_distance: examPayload.pd_distance || null,
      lens_type: examPayload.lens_type || null,
      frame_recommendation: examPayload.frame_recommendation || null,
      treatment: examPayload.treatment || null,
      clinical_notes: examPayload.clinical_notes || null
    }

    const mockDb = require('@/lib/mocks')
    mockDb.MOCK_CLINICAL_EXAMS.unshift(mockExam)

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
        .select('id, discount_percent, is_active, valid_until')
        .eq('code', couponCode)
        .single()

      if (couponData && couponData.is_active && new Date(couponData.valid_until) > new Date()) {
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
          ? supabase.from('products').select('id, price, client_price').in('id', productIds)
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
      const productClientPrice = new Map((prodRes.data || []).map((r: any) => [r.id, r.client_price != null ? Number(r.client_price) : null]))
      const materialPrice = new Map((matRes.data || []).map((r: any) => [r.id, Number(r.price)]))
      const treatmentPrice = new Map((treatRes.data || []).map((r: any) => [r.id, Number(r.price)]))

      // Member pricing: a linked sale always belongs to a CRM customer, so
      // when that profile has role 'customer' the product price is the
      // client price (special client_price, else the general member
      // discount) — the same rule the catalog and the POS apply. Lens
      // materials and treatments are services and keep their list price.
      let buyerIsCustomer = false
      try {
        const { data: buyer } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', customerId)
          .maybeSingle()
        buyerIsCustomer = buyer?.role === 'customer'
      } catch { /* fall back to visitor price */ }
      const memberPct = buyerIsCustomer ? await memberDiscountServer(supabase) : 0

      for (const item of items) {
        const qty = Number(item.quantity)
        if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
          return { error: 'Cantidad inválida en uno de los productos del carrito.', success: null }
        }
        if (!productPrice.has(item.productId)) {
          return { error: 'Uno de los productos del carrito ya no existe en el catálogo.', success: null }
        }
        item.price = buyerIsCustomer
          ? effectiveClientPrice(productPrice.get(item.productId) ?? 0, productClientPrice.get(item.productId) ?? null, memberPct)
          : productPrice.get(item.productId)
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


