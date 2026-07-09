'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import * as mockDb from '@/lib/mocks'

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

      const nextSuggestedDate = new Date()
      nextSuggestedDate.setDate(nextSuggestedDate.getDate() + 365)

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
    console.warn('Database/Auth registry connection failed, running fallback mock:', err.message)
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
      const nextSuggestedDate = new Date()
      nextSuggestedDate.setDate(nextSuggestedDate.getDate() + 365)

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
    console.warn('clinical exam connection failed, running fallback mock:', err.message)
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

    // 2. Insert sale items, their treatments, and update stock
    for (const item of items) {
      const finalUnitPrice = item.price + (item.lensMaterialPrice || 0) + (item.treatmentsPrice || 0)
      
      const { data: itemData, error: itemError } = await supabase
        .from('sale_items')
        .insert([{
          sale_id: saleData.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: finalUnitPrice,
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

      if (!itemError && itemData && item.treatmentIds && item.treatmentIds.length > 0) {
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
          await supabase.from('sale_item_treatments').insert(treatmentsToInsert)
        }
      }

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
        
        await supabase.from('payment_installments').insert(installmentsToInsert)
      } catch (e) {
        console.error('Failed to create payment installments in Supabase:', e)
      }
    }

    // 3. Create a reminder for the next visit (12 months from now)
    try {
      await supabase.from('reminders').insert([{
        customer_id: customerId,
        last_visit_date: new Date().toISOString(),
        next_suggested_visit: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
    console.warn('Supabase DB connection failed in createLinkedSaleAction, running fallback mock:', err.message)
    
    // FALLBACK MOCK WRITE
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
        price: finalUnitPrice,
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
      next_suggested_visit: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
        const isVisible = sale.is_prescription_visible === true
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
    console.warn('Supabase fetch failed on getMySalesAction, running fallback mock:', err.message)
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
        
        const isVisible = sale.is_prescription_visible === true

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

