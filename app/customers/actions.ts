'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

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
  // Default temporal password: Rayo_Nombre
  const temporalPassword = `Rayo_${fullName.split(' ')[0]}`

  try {
    const adminClient = createAdminClient() as any

    // 1. Create Supabase Auth user
    const { data: { user }, error: authError } = await adminClient.auth.admin.createUser({
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
      return { error: `Error al crear cuenta: ${authError.message}`, success: null, customerId: null }
    }

    if (!user) {
      return { error: 'No se pudo crear el usuario.', success: null, customerId: null }
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

    revalidatePath('/customers', 'layout')
    return {
      success: `Cliente "${fullName}" registrado. Contraseña temporal: ${temporalPassword}`,
      error: null,
      customerId: user.id,
    }
  } catch (err: any) {
    return { error: `Error del servidor: ${err.message || 'Error inesperado.'}`, success: null, customerId: null }
  }
}

/**
 * Creates a new clinical exam record for a customer.
 */
export async function createClinicalExamAction(currentState: CreateExamState, formData: FormData): Promise<CreateExamState> {
  const customerId = formData.get('customerId') as string

  if (!customerId) {
    return { error: 'ID de cliente requerido.', success: null, examId: null }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const examPayload: any = {
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
      return { error: `Error al guardar examen: ${error.message}`, success: null, examId: null }
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
    return { error: `Error del servidor: ${err.message || 'Error inesperado.'}`, success: null, examId: null }
  }
}

/**
 * Creates a sale linked to a specific customer (and optionally an exam + coupon).
 */
export async function createLinkedSaleAction(currentState: CreateSaleState, formData: FormData): Promise<CreateSaleState> {
  const customerId = formData.get('customerId') as string
  const examId = formData.get('examId') as string
  const couponCode = (formData.get('couponCode') as string)?.trim().toUpperCase()
  const saleNotes = formData.get('notes') as string
  const itemsJson = formData.get('items') as string

  if (!customerId || !itemsJson) {
    return { error: 'Cliente e items son requeridos.', success: null }
  }

  let items: { productId: string; quantity: number; price: number }[] = []
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

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const discountAmount = subtotal * (discountPercent / 100)
    const total = subtotal - discountAmount

    // 1. Create sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([{
        customer_id: customerId,
        seller_id: user?.id || null,
        exam_id: examId || null,
        coupon_id: couponId,
        discount_applied: discountAmount,
        total,
        notes: saleNotes || null,
      }])
      .select()
      .single()

    if (saleError || !saleData) {
      return { error: `Error al registrar venta: ${saleError?.message}`, success: null }
    }

    // 2. Insert sale items and update stock
    for (const item of items) {
      await supabase.from('sale_items').insert([{
        sale_id: saleData.id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
      }])

      // Decrement stock
      try {
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
          product_id: item.productId,
          qty: item.quantity,
        })
        if (rpcError) throw rpcError
      } catch {
        // RPC may not exist yet; fallback inline update
        const { data } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single()
        if (data) {
          await supabase
            .from('products')
            .update({ stock: data.stock - item.quantity })
            .eq('id', item.productId)
        }
      }
    }

    revalidatePath(`/customers/${customerId}`, 'layout')
    return { success: `¡Venta registrada! Total: $${total.toFixed(2)} MXN`, error: null }
  } catch (err: any) {
    return { error: `Error del servidor: ${err.message || 'Error inesperado.'}`, success: null }
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
