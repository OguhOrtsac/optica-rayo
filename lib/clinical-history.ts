/**
 * Historia clínica — el formato REAL en papel del negocio (hoja
 * «Historia clínica», foto del dueño 2026-11-19), en SU orden:
 * encabezado con responsable y folio, antecedentes (preguntas 4–13),
 * agudeza visual S/C y C/C lejos y cerca (OD/OI/AO), retinoscopía,
 * DIP por ojo, RX, RX Final y observaciones.
 *
 * DECISIÓN DE ESQUEMA: todos estos campos viven en UNA sola columna
 * nueva `clinical_exams.clinical_history` (JSONB, migración
 * 20261119_clinical_history.sql) para no tocar las columnas de
 * graduación de siempre. La graduación VIGENTE — la que alimenta
 * ventas, historial y comparativas — sigue siendo la RX FINAL y se
 * guarda en las columnas de siempre (od_sphere, oi_sphere, …); la RX
 * (inicial) es solo la medición previa y vive dentro de este JSON.
 * La migración es OPCIONAL: si la columna aún no existe, el guardado
 * degrada sin reventar (se reintenta sin la historia, mismo patrón
 * que products.display_order) y la lectura simplemente no la trae.
 */

// Datos fijos del negocio impresos en la hoja de papel.
export const CLINICAL_LEAD_NAME = 'Raymundo Martínez Gutiérrez'
export const CLINICAL_LEAD_FOLIO = 'D-0000582925'

export type YesNo = 'si' | 'no'
export type HypertensionDiabetes = 'ninguna' | 'hipertension' | 'diabetes' | 'ambas'

export const HYPERTENSION_DIABETES_LABELS: Record<HypertensionDiabetes, string> = {
  ninguna: 'Ninguna',
  hipertension: 'Hipertensión',
  diabetes: 'Diabetes',
  ambas: 'Ambas',
}

export interface EyeTextValues {
  od: string | null
  oi: string | null
  ao: string | null
}

export interface EyePairText {
  od: string | null
  oi: string | null
}

export interface EyeGraduation {
  sphere: number | null
  cylinder: number | null
  axis: number | null
  add: number | null
}

export interface ClinicalHistory {
  // ——— Antecedentes (preguntas 4–13 de la hoja, en orden) ———
  bothersLights: YesNo | null // MOLESTAN LUCES
  usedGlassesBefore: YesNo | null // HA USADO LENTES ANTES
  glassesTime: string | null // CUANTO TIEMPO TIENE CON ELLOS
  lastExamDate: string | null // FECHA DEL ULTIMO EXAMEN (yyyy-mm-dd)
  occupation: string | null // A QUE SE DEDICA
  eyeSurgery: YesNo | null // TIENE CIRUJIAS EN SUS OJOS
  eyeSurgeryDetail: string | null // detalle cuando la respuesta es Sí
  hypertensionDiabetes: HypertensionDiabetes | null // HIPERTENSION O DIABETES
  medications: YesNo | null // TOMA MEDICAMENTOS
  medicationsDetail: string | null // detalle cuando la respuesta es Sí
  familyUsesGlasses: YesNo | null // ALGUN FAMILIAR USA LENTES
  screenTime: string | null // TIEMPO DE USO DE APARATOS ELECTRONICOS

  // ——— Agudeza visual (renglones 14–17): texto corto, ej. «20/20» ———
  vaScFar: EyeTextValues // AV S/C LEJOS
  vaScNear: EyeTextValues // AV S/C CERCA
  vaCcFar: EyeTextValues // AV C/C LEJOS
  vaCcNear: EyeTextValues // AV C/C CERCA

  // ——— Retinoscopía (18): un texto por ojo, como la hoja ———
  retinoscopy: EyePairText

  // ——— DIP (19): desglose monocular en mm. El TOTAL sigue viviendo
  // en clinical_exams.pd_distance (lo calcula quien guarda: OD + OI).
  dipOd: number | null
  dipOi: number | null

  // ——— RX (20): medición inicial. La vigente es RX FINAL (21) y va
  // en las columnas de siempre, NO aquí.
  rx: { od: EyeGraduation; oi: EyeGraduation }

  // ——— Observaciones de la hoja (22) ———
  observations: string | null
}

const emptyEyeText = (): EyeTextValues => ({ od: null, oi: null, ao: null })
const emptyEyePair = (): EyePairText => ({ od: null, oi: null })
const emptyGraduation = (): EyeGraduation => ({ sphere: null, cylinder: null, axis: null, add: null })

export const EMPTY_CLINICAL_HISTORY: ClinicalHistory = {
  bothersLights: null,
  usedGlassesBefore: null,
  glassesTime: null,
  lastExamDate: null,
  occupation: null,
  eyeSurgery: null,
  eyeSurgeryDetail: null,
  hypertensionDiabetes: null,
  medications: null,
  medicationsDetail: null,
  familyUsesGlasses: null,
  screenTime: null,
  vaScFar: emptyEyeText(),
  vaScNear: emptyEyeText(),
  vaCcFar: emptyEyeText(),
  vaCcNear: emptyEyeText(),
  retinoscopy: emptyEyePair(),
  dipOd: null,
  dipOi: null,
  rx: { od: emptyGraduation(), oi: emptyGraduation() },
  observations: null,
}

const asText = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

const asYesNo = (v: unknown): YesNo | null => (v === 'si' || v === 'no' ? v : null)

const asHypertensionDiabetes = (v: unknown): HypertensionDiabetes | null =>
  v === 'ninguna' || v === 'hipertension' || v === 'diabetes' || v === 'ambas' ? v : null

function normalizeEyeText(raw: any): EyeTextValues {
  if (!raw || typeof raw !== 'object') return emptyEyeText()
  return { od: asText(raw.od), oi: asText(raw.oi), ao: asText(raw.ao) }
}

function normalizeGraduation(raw: any): EyeGraduation {
  if (!raw || typeof raw !== 'object') return emptyGraduation()
  return {
    sphere: asNumber(raw.sphere),
    cylinder: asNumber(raw.cylinder),
    axis: asNumber(raw.axis),
    add: asNumber(raw.add),
  }
}

/**
 * Normaliza lo que venga de la base (JSONB) o de los mocks a la forma
 * completa de ClinicalHistory. Devuelve null si no hay objeto.
 */
export function normalizeClinicalHistory(raw: unknown): ClinicalHistory | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, any>
  const rxRaw = r.rx && typeof r.rx === 'object' ? r.rx : {}
  const retRaw = r.retinoscopy && typeof r.retinoscopy === 'object' ? r.retinoscopy : {}
  return {
    bothersLights: asYesNo(r.bothersLights),
    usedGlassesBefore: asYesNo(r.usedGlassesBefore),
    glassesTime: asText(r.glassesTime),
    lastExamDate: asText(r.lastExamDate),
    occupation: asText(r.occupation),
    eyeSurgery: asYesNo(r.eyeSurgery),
    eyeSurgeryDetail: asText(r.eyeSurgeryDetail),
    hypertensionDiabetes: asHypertensionDiabetes(r.hypertensionDiabetes),
    medications: asYesNo(r.medications),
    medicationsDetail: asText(r.medicationsDetail),
    familyUsesGlasses: asYesNo(r.familyUsesGlasses),
    screenTime: asText(r.screenTime),
    vaScFar: normalizeEyeText(r.vaScFar),
    vaScNear: normalizeEyeText(r.vaScNear),
    vaCcFar: normalizeEyeText(r.vaCcFar),
    vaCcNear: normalizeEyeText(r.vaCcNear),
    retinoscopy: { od: asText(retRaw.od), oi: asText(retRaw.oi) },
    dipOd: asNumber(r.dipOd),
    dipOi: asNumber(r.dipOi),
    rx: { od: normalizeGraduation(rxRaw.od), oi: normalizeGraduation(rxRaw.oi) },
    observations: asText(r.observations),
  }
}

/** True si la historia trae al menos un dato capturado. */
export function hasClinicalHistory(h: ClinicalHistory | null): boolean {
  if (!h) return false
  const eyeTextFilled = (e: EyeTextValues) => !!(e.od || e.oi || e.ao)
  const gradFilled = (g: EyeGraduation) =>
    g.sphere !== null || g.cylinder !== null || g.axis !== null || g.add !== null
  return Boolean(
    h.bothersLights || h.usedGlassesBefore || h.glassesTime || h.lastExamDate ||
    h.occupation || h.eyeSurgery || h.eyeSurgeryDetail || h.hypertensionDiabetes ||
    h.medications || h.medicationsDetail || h.familyUsesGlasses || h.screenTime ||
    eyeTextFilled(h.vaScFar) || eyeTextFilled(h.vaScNear) ||
    eyeTextFilled(h.vaCcFar) || eyeTextFilled(h.vaCcNear) ||
    h.retinoscopy.od || h.retinoscopy.oi ||
    h.dipOd !== null || h.dipOi !== null ||
    gradFilled(h.rx.od) || gradFilled(h.rx.oi) ||
    h.observations
  )
}

/** Edad en años cumplidos a partir de una fecha yyyy-mm-dd. */
export function calculateAge(dateOfBirth: string, at?: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth)
  if (!m) return null
  const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(birth.getTime())) return null
  const now = at ? new Date(at) : new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

/**
 * Arma la historia clínica desde el FormData del formulario
 * (components/clinical-exam-form.tsx, campos con prefijo hc_ / rx_).
 * Lo usa la Server Action que guarda el examen.
 */
export function buildClinicalHistoryFromFormData(formData: FormData): ClinicalHistory {
  const text = (name: string): string | null => asText(formData.get(name))
  const num = (name: string): number | null => asNumber(formData.get(name))
  const eyeText = (prefix: string): EyeTextValues => ({
    od: text(`${prefix}_od`),
    oi: text(`${prefix}_oi`),
    ao: text(`${prefix}_ao`),
  })
  const graduation = (prefix: string): EyeGraduation => ({
    sphere: num(`${prefix}_sphere`),
    cylinder: num(`${prefix}_cylinder`),
    axis: num(`${prefix}_axis`),
    add: num(`${prefix}_add`),
  })
  return {
    bothersLights: asYesNo(formData.get('hc_bothers_lights')),
    usedGlassesBefore: asYesNo(formData.get('hc_used_glasses')),
    glassesTime: text('hc_glasses_time'),
    lastExamDate: text('hc_last_exam_date'),
    occupation: text('hc_occupation'),
    eyeSurgery: asYesNo(formData.get('hc_eye_surgery')),
    eyeSurgeryDetail: text('hc_eye_surgery_detail'),
    hypertensionDiabetes: asHypertensionDiabetes(formData.get('hc_hypertension_diabetes')),
    medications: asYesNo(formData.get('hc_medications')),
    medicationsDetail: text('hc_medications_detail'),
    familyUsesGlasses: asYesNo(formData.get('hc_family_glasses')),
    screenTime: text('hc_screen_time'),
    vaScFar: eyeText('hc_va_sc_far'),
    vaScNear: eyeText('hc_va_sc_near'),
    vaCcFar: eyeText('hc_va_cc_far'),
    vaCcNear: eyeText('hc_va_cc_near'),
    retinoscopy: { od: text('hc_retinoscopy_od'), oi: text('hc_retinoscopy_oi') },
    dipOd: num('hc_dip_od'),
    dipOi: num('hc_dip_oi'),
    rx: { od: graduation('rx_od'), oi: graduation('rx_oi') },
    observations: text('hc_observations'),
  }
}
