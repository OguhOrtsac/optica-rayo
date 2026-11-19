/**
 * Teléfonos de clientes — UNA sola fuente de verdad (dictado del
 * dueño, 2026-11-19).
 *
 * Captura: el teléfono se registra con prefijo elegible — **+52 por
 * default, SIN el «1»** (nada de +52 1) — cambiable a +1 (EE. UU.) u
 * otro prefijo tecleado (ver components/phone-input.tsx). Lo que se
 * GUARDA es el valor compuesto «+<prefijo> <número local>».
 *
 * Enlaces: todo enlace tel:/wa.me de la app se arma con
 * toWhatsAppNumber de este archivo; ningún lugar debe reimplementar
 * la normalización por su cuenta.
 */

/** Solo los dígitos de un valor cualquiera. */
export function phoneDigits(value: string | null | undefined): string {
  return (value || '').replace(/[^\d]/g, '')
}

/**
 * Normaliza cualquier teléfono guardado al formato internacional de
 * wa.me (solo dígitos, con código de país y SIN el «1» mexicano):
 * - 10 dígitos → `52` + dígitos (mexicano capturado sin prefijo).
 * - `521` + 10 dígitos (13 en total) → se quita el «1» legado.
 * - `52` + 10 (12) → tal cual.
 * - Otro internacional válido (`1` + 10 = 11, u otro compuesto por la
 *   captura con prefijo) → tal cual.
 * - Vacío → null.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const clean = phoneDigits(phone)
  if (!clean) return null
  if (clean.length === 13 && clean.startsWith('521')) return `52${clean.slice(3)}`
  if (clean.length === 10) return `52${clean}`
  return clean
}

/** Cómo queda reflejado un teléfono guardado en el selector de prefijo. */
export interface SplitPhone {
  /** Opción del selector: '+52' | '+1' | 'other' (prefijo tecleado). */
  choice: '52' | '1' | 'other'
  /** Dígitos del prefijo cuando choice === 'other' ('' si aún no se teclea). */
  customPrefix: string
  /** Número local, solo dígitos. */
  local: string
}

/**
 * Separa un teléfono GUARDADO en prefijo + número local para que el
 * selector de captura lo refleje:
 * - Valor compuesto por la captura nueva («+<prefijo> <número>»): el
 *   primer grupo tras el «+» es el prefijo; +52 y +1 son las opciones
 *   fijas y cualquier otro cae en «Otro…» con su prefijo tecleado.
 * - Legado sin «+»: `521`+10 (13) y `52`+10 (12) → +52 sin el «1»;
 *   `1`+10 (11) → +1.
 * - Sin prefijo reconocido → +52 por default y el número tal cual.
 */
export function splitPhonePrefix(stored: string | null | undefined): SplitPhone {
  const raw = (stored || '').trim()
  const digits = phoneDigits(raw)
  if (!digits) return { choice: '52', customPrefix: '', local: '' }

  if (raw.startsWith('+')) {
    const firstToken = phoneDigits(raw.slice(1).split(/\s+/)[0])
    if (firstToken) {
      const rest = digits.slice(firstToken.length)
      if (firstToken === '52') return { choice: '52', customPrefix: '', local: rest }
      if (firstToken === '1') return { choice: '1', customPrefix: '', local: rest }
      return { choice: 'other', customPrefix: firstToken, local: rest }
    }
  }

  if (digits.length === 13 && digits.startsWith('521')) {
    return { choice: '52', customPrefix: '', local: digits.slice(3) }
  }
  if (digits.length === 12 && digits.startsWith('52')) {
    return { choice: '52', customPrefix: '', local: digits.slice(2) }
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return { choice: '1', customPrefix: '', local: digits.slice(1) }
  }
  return { choice: '52', customPrefix: '', local: digits }
}

/** El prefijo efectivo (dígitos) de una captura separada. */
export function effectivePhonePrefix(split: SplitPhone): string {
  return split.choice === 'other' ? phoneDigits(split.customPrefix) : split.choice
}

/**
 * Compone el valor que se GUARDA: «+<prefijo> <número local>» (el
 * formato que ya fluye bien por toWhatsAppNumber). Sin número local
 * no hay teléfono: devuelve ''.
 */
export function composePhone(split: SplitPhone): string {
  const local = phoneDigits(split.local)
  if (!local) return ''
  const prefix = effectivePhonePrefix(split)
  return prefix ? `+${prefix} ${local}` : local
}
