/**
 * Shared configuration for the Exam Review Reminders module.
 * The administrator can edit both values from the dashboard; they are
 * stored in the `app_settings` table (with a local fallback in demo mode).
 * These constants are the defaults used when nothing has been saved yet.
 */

export const REMINDER_MONTHS_KEY = 'reminder_months'
export const REMINDER_TEMPLATE_KEY = 'reminder_template'

/** The owner chose: configurable period, 6 months by default. */
export const DEFAULT_REMINDER_MONTHS = 6

/**
 * Default WhatsApp message. Placeholders: {nombre} and {meses}.
 * Editable by the administrator from the Reminders tray.
 */
export const DEFAULT_REMINDER_TEMPLATE =
  'Hola {nombre}, te saludamos de Óptica Rayo. Han pasado {meses} meses desde tu última revisión de la vista y queremos invitarte a realizarte un nuevo examen. Recuerda que el examen es GRATIS y te ayuda a cuidar tu salud visual. Además, nos llegaron NUEVOS MODELOS de armazones que te pueden encantar. ¿Te agendamos una cita? ¡Esperamos verte pronto!'

/** Returns a new ISO date `months` after the given date. */
export function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

/** Builds the WhatsApp text from the editable template. */
export function buildReminderMessage(
  template: string,
  values: { nombre: string; meses: number }
): string {
  return template
    .replaceAll('{nombre}', values.nombre)
    .replaceAll('{meses}', String(values.meses))
}

/** Normalizes a Mexican phone number to wa.me international format. */
export function toWhatsAppNumber(phone: string): string | null {
  const clean = (phone || '').replace(/[^\d]/g, '')
  if (!clean) return null
  return clean.length === 10 ? `52${clean}` : clean
}
