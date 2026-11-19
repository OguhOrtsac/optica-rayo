/**
 * WhatsApp message templates — single source of truth.
 *
 * Every pre-filled WhatsApp text in the app is an editable template stored
 * in the `app_settings` table and edited from ONE place: the «Mensajes»
 * page (/dashboard/admin/mensajes). The reminder template predates this
 * module: its key (`reminder_template`) and default live in
 * `lib/reminder-config.ts` and are re-exported here so every message is
 * reachable from the same door. Each usage point reads the saved template
 * (via the getters in `lib/services.ts`) and falls back to the default
 * below when nothing has been saved yet — the defaults reproduce, word for
 * word, the texts that used to be hard-coded at each usage point.
 */

import { REMINDER_TEMPLATE_KEY, DEFAULT_REMINDER_TEMPLATE } from './reminder-config'

export { REMINDER_TEMPLATE_KEY, DEFAULT_REMINDER_TEMPLATE }

export const BIRTHDAY_TEMPLATE_KEY = 'birthday_template'
export const CATALOG_INQUIRY_TEMPLATE_KEY = 'catalog_inquiry_template'
export const LENS_REQUEST_REPLY_TEMPLATE_KEY = 'lens_request_reply_template'
export const PAYMENT_REMINDER_TEMPLATE_KEY = 'payment_reminder_template'
export const TICKET_TEMPLATE_KEY = 'ticket_template'

/**
 * Birthday greeting (panel → «Cumpleaños próximos» → Felicitar).
 * Placeholder: {nombre} — the customer's FIRST name.
 */
export const DEFAULT_BIRTHDAY_TEMPLATE =
  '¡Feliz cumpleaños, {nombre}! 🎉 Todo el equipo de Óptica Rayo te desea un día excelente. Pasa a saludarnos: tu examen de la vista va por nuestra cuenta en tu mes de cumpleaños.'

/**
 * Catalog product inquiry (catalog → «Consultar Disponibilidad» /
 * «Comprar Lentes»). Placeholders: {producto} — product name;
 * {referencia} — short product reference (without the '#', the template
 * carries it); {detalle} — the graduation/extras segment the customer
 * picked in the assistant (may expand to nothing).
 */
export const DEFAULT_CATALOG_INQUIRY_TEMPLATE =
  'Hola Óptica Rayo, estoy interesado en el producto: {producto} (Ref: #{referencia}). {detalle}¿Tienen disponibilidad en sucursal?'

/**
 * Reply to a lens request (panel → «Solicitudes de lentes armados»).
 * Placeholders: {nombre} — customer name; {armazon} — chosen frame;
 * {mica} — chosen lens material; {notas} — the FULL notes line
 * (`- Notas: "..."` plus its line break), or nothing when the request
 * carries no notes.
 */
export const DEFAULT_LENS_REQUEST_REPLY_TEMPLATE =
  'Hola *{nombre}*, recibimos tu diseño de lentes en el portal de *Optica Rayo* 🕶️.\n\n- Armazón: *{armazon}*\n- Mica: *{mica}*\n{notas}\n¿Te gustaría que agendemos tu visita para confirmar la graduación y cerrar tu orden?'

/**
 * Payment reminder (customer file → «Recordatorio de Cobranza»).
 * Placeholders: {nombre} — the customer's FULL name; {saldo} — the
 * pending balance already formatted as currency (the template adds the
 * «MXN» suffix, as the original hard-coded text did).
 */
export const DEFAULT_PAYMENT_REMINDER_TEMPLATE =
  'Hola {nombre}, te saludamos de Óptica Rayo. Te recordamos cordialmente que cuentas con un saldo pendiente de {saldo} MXN de tu compra. Puedes pasar a liquidarlo a sucursal o realizar una transferencia bancaria. ¡Muchas gracias por tu preferencia!'

/**
 * Purchase ticket (POS → tarjeta de éxito → «Enviar ticket por
 * WhatsApp»). Placeholders: {nombre} — the buyer's name (empty when
 * the sale carries no name: the greeting loses the «, {nombre}» so it
 * reads «¡Gracias por su compra!»); {orden} — order code without '#';
 * {fecha} — long sale date; {articulos} — the item block (products
 * with their complements as sub-lines); {subtotal} / {total} /
 * {anticipo} / {saldo} — amounts already formatted as currency
 * ({saldo} expands to nothing when there is no pending balance);
 * {descuentos} — the discount block INCLUDING its trailing line break
 * (nothing when there is no discount, so «*Total*» follows the
 * subtotal directly); {plan} — the deferred-balance line («Su saldo
 * de … quedó diferido a N pagos …» with a plan, «Saldo pendiente: …»
 * without one, nothing when the sale is fully paid); {meses} — the
 * configured exam-reminder period. The composition and the cleanup of
 * empty blocks live in lib/ticket.ts (buildTicketMessage); when
 * nothing has been saved this default IS the ticket, word for word.
 */
export const DEFAULT_TICKET_TEMPLATE = `*Óptica Rayo* — Ticket de compra
Orden #{orden} · {fecha}

¡Gracias por su compra, {nombre}!

*Artículos comprados*
{articulos}

Subtotal: {subtotal}
{descuentos}*Total: {total}*
Anticipo: {anticipo}
{plan}
Los precios ya incluyen IVA.

¡Lo esperamos de vuelta!
Lo volvemos a esperar en {meses} meses para su examen de vista.`

/** Every editable template key, for validation in the services layer. */
export const MESSAGE_TEMPLATE_KEYS = [
  REMINDER_TEMPLATE_KEY,
  BIRTHDAY_TEMPLATE_KEY,
  CATALOG_INQUIRY_TEMPLATE_KEY,
  LENS_REQUEST_REPLY_TEMPLATE_KEY,
  PAYMENT_REMINDER_TEMPLATE_KEY,
  TICKET_TEMPLATE_KEY,
] as const

export type MessageTemplateKey = (typeof MESSAGE_TEMPLATE_KEYS)[number]

/** Default text per key — the fallback when app_settings has no row yet. */
export const MESSAGE_TEMPLATE_DEFAULTS: Record<MessageTemplateKey, string> = {
  [REMINDER_TEMPLATE_KEY]: DEFAULT_REMINDER_TEMPLATE,
  [BIRTHDAY_TEMPLATE_KEY]: DEFAULT_BIRTHDAY_TEMPLATE,
  [CATALOG_INQUIRY_TEMPLATE_KEY]: DEFAULT_CATALOG_INQUIRY_TEMPLATE,
  [LENS_REQUEST_REPLY_TEMPLATE_KEY]: DEFAULT_LENS_REQUEST_REPLY_TEMPLATE,
  [PAYMENT_REMINDER_TEMPLATE_KEY]: DEFAULT_PAYMENT_REMINDER_TEMPLATE,
  [TICKET_TEMPLATE_KEY]: DEFAULT_TICKET_TEMPLATE,
}

/** Builds the birthday greeting from the editable template. */
export function buildBirthdayMessage(
  template: string,
  values: { nombre: string }
): string {
  return template.replaceAll('{nombre}', values.nombre)
}

/** Builds the catalog inquiry text from the editable template. */
export function buildCatalogInquiryMessage(
  template: string,
  values: { producto: string; referencia: string; detalle: string }
): string {
  return template
    .replaceAll('{producto}', values.producto)
    .replaceAll('{referencia}', values.referencia)
    .replaceAll('{detalle}', values.detalle)
}

/**
 * Builds the lens-request reply from the editable template. `notas` is the
 * request's raw notes text; the {notas} placeholder expands to the whole
 * formatted notes line (with its trailing line break) or to nothing.
 */
export function buildLensRequestReplyMessage(
  template: string,
  values: { nombre: string; armazon: string; mica: string; notas: string }
): string {
  const notesLine = values.notas ? `- Notas: _"${values.notas}"_\n` : ''
  return template
    .replaceAll('{nombre}', values.nombre)
    .replaceAll('{armazon}', values.armazon)
    .replaceAll('{mica}', values.mica)
    .replaceAll('{notas}', notesLine)
}

/** Builds the payment reminder from the editable template. */
export function buildPaymentReminderMessage(
  template: string,
  values: { nombre: string; saldo: string }
): string {
  return template
    .replaceAll('{nombre}', values.nombre)
    .replaceAll('{saldo}', values.saldo)
}
