'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdminRole, normalizeRole } from '@/lib/roles'
import { MEMBER_DISCOUNT_KEY, BIRTHDAY_DISCOUNT_EXTRA_KEY } from '@/lib/pricing'

/**
 * Guarda los DOS porcentajes del «Descuento de cliente en el catálogo»
 * (dictado del dueño, 2026-11-19): el general de cliente y el extra del
 * mes de cumpleaños. Es una acción de SERVIDOR con la misma puerta de
 * rol de la página «Datos de la óptica»: la sesión se resuelve aquí, el
 * rol sale de la fila de `profiles` (la misma fuente que lee
 * get_my_role()) y solo owner / super_admin guardan — ocultar el
 * formulario nunca fue el control. Los valores viven en app_settings
 * bajo las llaves de lib/pricing, que son las que leen el catálogo y el
 * panel del cliente.
 */
export async function saveCatalogDiscountsAction(
  basePercent: number,
  birthdayExtraPercent: number
): Promise<{ success: true } | { success: false; error: string }> {
  const isValidPercent = (n: number) => Number.isInteger(n) && n >= 0 && n <= 90
  if (!isValidPercent(basePercent) || !isValidPercent(birthdayExtraPercent)) {
    return {
      success: false,
      error: 'Los porcentajes deben ser números enteros entre 0 y 90.',
    }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No hay una sesión activa.' }
    }

    let roleValue: string | null = user.user_metadata?.role || null
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) roleValue = profile.role
    } catch {
      // keep the metadata fallback
    }
    if (!isAdminRole(normalizeRole(roleValue))) {
      return {
        success: false,
        error: 'Solo un administrador puede modificar los descuentos del catálogo.',
      }
    }

    const now = new Date().toISOString()
    const { error } = await supabase.from('app_settings').upsert(
      [
        { key: MEMBER_DISCOUNT_KEY, value: String(basePercent), updated_at: now },
        { key: BIRTHDAY_DISCOUNT_EXTRA_KEY, value: String(birthdayExtraPercent), updated_at: now },
      ],
      { onConflict: 'key' }
    )
    if (error) {
      return { success: false, error: `No se pudieron guardar los descuentos: ${error.message}` }
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'No se pudieron guardar los descuentos.',
    }
  }
}
