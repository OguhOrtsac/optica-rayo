import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import * as mockDb from '@/lib/mocks'

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder') && !key.includes('placeholder')
}

export async function GET(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient()
      
      // Call Supabase database function
      const { error } = await supabase.rpc('check_upcoming_installments')
      if (error) {
        throw error
      }
      
      return NextResponse.json({ success: true, message: 'Supabase cron check completed.' })
    } else {
      // Fallback: Mocks Simulation
      const threeDaysFromNow = new Date()
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
      const targetDateStr = threeDaysFromNow.toISOString().split('T')[0]

      const upcomingInstallments = mockDb.MOCK_PAYMENT_INSTALLMENTS.filter(
        inst => inst.status === 'pending' && inst.due_date === targetDateStr
      )

      upcomingInstallments.forEach(inst => {
        const sale = mockDb.MOCK_SALES.find(s => s.id === inst.sale_id)
        if (!sale) return

        const customerId = sale.customer_id
        if (!customerId) return

        const customerName = sale.customer_name || 'Cliente'

        // Alert to customer
        mockDb.MOCK_NOTIFICATIONS.push({
          id: 'n_' + Math.random().toString(36).substr(2, 9),
          user_id: customerId,
          title: 'Recordatorio de Pago',
          message: `Hola ${customerName}, te recordamos que tu cuota #${inst.installment_number} de $${inst.amount} vence en 3 días (el ${inst.due_date}).`,
          type: 'payment_reminder',
          is_read: false,
          created_at: new Date().toISOString()
        })

        // Alert to staff members
        mockDb.MOCK_PROFILES.filter(p => p.role !== 'customer').forEach(staff => {
          mockDb.MOCK_NOTIFICATIONS.push({
            id: 'n_' + Math.random().toString(36).substr(2, 9),
            user_id: staff.id,
            title: 'Vencimiento de Cuota de Cliente',
            message: `El cliente ${customerName} tiene la cuota #${inst.installment_number} de $${inst.amount} por vencer en 3 días (el ${inst.due_date}).`,
            type: 'payment_reminder',
            is_read: false,
            created_at: new Date().toISOString()
          })
        })
      })

      return NextResponse.json({ 
        success: true, 
        message: `Mocks cron check completed. Processed ${upcomingInstallments.length} installments.` 
      })
    }
  } catch (e: any) {
    console.error('Cron job check-payments failed:', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
