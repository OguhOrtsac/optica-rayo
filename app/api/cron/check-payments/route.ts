import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder') && !key.includes('placeholder')
}

export async function GET(request: Request) {
  // Cron authentication: when CRON_SECRET is defined in the environment
  // (the standard Vercel Cron mechanism, which sends it as a Bearer
  // token), the header is REQUIRED. When it is not defined the route
  // cannot verify the caller — that residual risk is logged on every
  // invocation instead of being silently accepted.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
    }
  } else {
    console.warn('check-payments: CRON_SECRET is not defined; this route is unauthenticated.')
  }

  try {
    if (!isSupabaseConfigured()) {
      // No real database: the cron MUST NOT report success for work it
      // did not do. Previously this branch simulated the run against
      // in-memory mocks and answered success:true with an invented
      // count, so an external monitor would see a healthy cron while
      // zero real payment reminders were generated.
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase no está configurado: el cron no procesó ningún vencimiento real.',
        },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    // Call Supabase database function
    const { error } = await supabase.rpc('check_upcoming_installments')
    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: 'Supabase cron check completed.' })
  } catch (e: any) {
    console.error('Cron job check-payments failed:', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
