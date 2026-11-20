/**
 * WhatsApp purchase ticket («ticket de compra») built at the POS right
 * after a sale is registered, so the seller can send it to the buyer.
 *
 * Since the owner's dictation of 2026-11-19 the ticket text is an
 * EDITABLE template: it lives in «Mensajes» (app_settings key
 * `ticket_template`, default DEFAULT_TICKET_TEMPLATE in
 * lib/message-templates.ts) and buildTicketMessage only substitutes
 * the placeholders. When no template has been saved — or the saved one
 * is empty — the built-in default is used, so the ticket NEVER comes
 * out empty. The owner was explicit long ago: NO VAT breakdown on the
 * customer ticket — catalog prices already include the tax and
 * itemizing it makes customers think they were charged extra; the
 * ticket carries the single note «Los precios ya incluyen IVA».
 *
 * Placeholder map (also documented in the «Mensajes» card):
 * - {nombre}    buyer name; empty when the sale has no name — the
 *               greeting then loses the «, {nombre}» and reads
 *               «¡Gracias por su compra!» with no dangling comma.
 * - {orden}     order code (without '#'); {fecha} long sale date.
 * - {articulos} the item block: one line per product (its own price,
 *               complements NOT folded in) and one sub-line per
 *               complement with its price («Gratis» when 0).
 * - {subtotal} / {total} / {anticipo}  amounts, currency-formatted.
 * - {descuentos} the discount block WITH its trailing line break, or
 *               nothing when there is no discount.
 * - {saldo}     pending balance formatted, or nothing when it is 0.
 * - {plan}      with a payment plan: «Su saldo de $X quedó diferido a
 *               N pagos <frecuencia> de $Y · primer pago el <fecha>»;
 *               balance without a plan: «Saldo pendiente: $X»;
 *               fully paid: nothing.
 * - {meses}     the configured exam-reminder period (months).
 *
 * composeTicketParts() is the SINGLE source of truth for the ticket's
 * content: the text builder fills the template from it and the PNG
 * renderer (lib/ticket-image.ts) draws the receipt from it, so the
 * image and the text of one sale can never disagree.
 */

import { DEFAULT_TICKET_TEMPLATE } from './message-templates'
import { frequencyPlural, parsePlanDate } from './payment-plan'

export interface TicketComplementLine {
  name: string
  /** Amount charged for this complement (unit price × quantity); 0 = free. */
  lineTotal: number
}

export interface TicketLine {
  name: string
  quantity: number
  /** Amount charged for the product itself (unit price × quantity). */
  lineTotal: number
  complements: TicketComplementLine[]
}

export interface TicketDiscountInfo {
  amount: number
  /**
   * Short explanation shown in parentheses, e.g. «cupón BUENFIN15»,
   * «15%», «precio final», optionally followed by the captured reason
   * («precio final · Cliente frecuente»).
   */
  detail?: string
}

export interface TicketData {
  /** On-screen order code (see orderCodeFromSaleId). */
  orderCode: string
  date: Date
  /** Buyer name for the {nombre} greeting; may be empty. */
  customerName?: string
  lines: TicketLine[]
  subtotal: number
  discount?: TicketDiscountInfo | null
  total: number
  paid: number
  pendingBalance: number
  /** Configured reminder period (months) for the closing invitation. */
  reminderMonths: number
  /**
   * Plan de pagos generado con la venta (dictado 2026-11-19): el
   * bloque {plan} del ticket lo anuncia como saldo diferido.
   */
  paymentPlan?: {
    installments: number
    frequency: 'weekly' | 'biweekly' | 'monthly'
    installmentAmount: number
    firstPaymentDate: string
  } | null
  /**
   * Plantilla editable guardada en «Mensajes» (app_settings). Vacía o
   * ausente → se usa DEFAULT_TICKET_TEMPLATE: el ticket nunca sale
   * vacío.
   */
  template?: string
}

export const formatTicketPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(price)

const formatPrice = formatTicketPrice

const longDate = (d: Date) =>
  d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

/**
 * On-screen order code, exactly as the sales History shows it: the
 * last 6 characters of the first UUID segment, uppercased
 * (`sale.id.slice(2, 8)`). Also works for demo-mode ids.
 */
export function orderCodeFromSaleId(saleId: string): string {
  return saleId.slice(2, 8).toUpperCase()
}

/** One drawable/printable row of the ticket's item block. */
export interface TicketPartLine {
  /** Left text: «2 × Producto» or «+ Complemento» (sub-line). */
  label: string
  /** Right text: the formatted amount, or «Gratis». */
  amountLabel: string
  /** True for complement sub-lines (indented, smaller). */
  complement: boolean
}

/** Everything the ticket says, composed ONCE from the sale snapshot. */
export interface TicketParts {
  orderCode: string
  dateLabel: string
  customerName: string
  /** Structured item rows (image renderer). */
  lines: TicketPartLine[]
  /** The {articulos} block as plain text (template). */
  articulosText: string
  subtotal: number
  discount: TicketDiscountInfo | null
  /** «Descuento: −$X (detalle)» or '' when there is no discount. */
  discountText: string
  total: number
  paid: number
  pendingBalance: number
  /** The {plan} block (see the placeholder map above); '' when paid in full. */
  planLine: string
  reminderMonths: number
}

/** Composes the ticket's content from the sale snapshot (one truth). */
export function composeTicketParts(data: TicketData): TicketParts {
  const lines: TicketPartLine[] = []
  const articulos: string[] = []
  for (const line of data.lines) {
    lines.push({
      label: `${line.quantity} × ${line.name}`,
      amountLabel: formatPrice(line.lineTotal),
      complement: false
    })
    articulos.push(`• ${line.quantity} × ${line.name} — ${formatPrice(line.lineTotal)}`)
    for (const complement of line.complements) {
      const amountLabel = complement.lineTotal > 0 ? formatPrice(complement.lineTotal) : 'Gratis'
      lines.push({ label: `+ ${complement.name}`, amountLabel, complement: true })
      articulos.push(`  + ${complement.name} — ${amountLabel}`)
    }
  }

  const discount = data.discount && data.discount.amount > 0 ? data.discount : null
  // Línea del descuento (dictado del dueño, 2026-11-19): con detalle
  // (el motivo del descuento de mostrador, o el cupón) va entre
  // paréntesis tras «Descuento»; sin detalle, solo el monto.
  const discountText = discount
    ? discount.detail
      ? `Descuento (${discount.detail}): −${formatPrice(discount.amount)}`
      : `Descuento: −${formatPrice(discount.amount)}`
    : ''

  let planLine = ''
  if (data.pendingBalance > 0) {
    if (data.paymentPlan) {
      planLine =
        `Su saldo de ${formatPrice(data.pendingBalance)} quedó diferido a ` +
        `${data.paymentPlan.installments} pagos ${frequencyPlural(data.paymentPlan.frequency)} ` +
        `de ${formatPrice(data.paymentPlan.installmentAmount)} · primer pago el ` +
        longDate(parsePlanDate(data.paymentPlan.firstPaymentDate))
    } else {
      planLine = `Saldo pendiente: ${formatPrice(data.pendingBalance)}`
    }
  }

  return {
    orderCode: data.orderCode,
    dateLabel: longDate(data.date),
    customerName: (data.customerName || '').trim(),
    lines,
    articulosText: articulos.join('\n'),
    subtotal: data.subtotal,
    discount,
    discountText,
    total: data.total,
    paid: data.paid,
    pendingBalance: data.pendingBalance,
    planLine,
    reminderMonths: data.reminderMonths
  }
}

/**
 * Builds the WhatsApp ticket text from the editable template saved in
 * «Mensajes» (data.template), falling back to the built-in default
 * when none was saved. Empty blocks never leave doubled blank lines.
 */
export function buildTicketMessage(data: TicketData): string {
  const parts = composeTicketParts(data)
  const template = data.template && data.template.trim() ? data.template : DEFAULT_TICKET_TEMPLATE

  let out = template
  // {nombre}: sin nombre, el saludo pierde la coma («compra, {nombre}!»
  // → «compra!») en vez de dejarla colgando.
  if (parts.customerName) {
    out = out.replaceAll('{nombre}', parts.customerName)
  } else {
    out = out.replaceAll(', {nombre}', '').replaceAll('{nombre}', '')
  }
  out = out
    .replaceAll('{orden}', parts.orderCode)
    .replaceAll('{fecha}', parts.dateLabel)
    .replaceAll('{articulos}', parts.articulosText)
    .replaceAll('{subtotal}', formatPrice(parts.subtotal))
    // {descuentos} lleva su propio salto de línea: la plantilla lo
    // pega a «*Total*» en el mismo renglón lógico.
    .replaceAll('{descuentos}', parts.discountText ? `${parts.discountText}\n` : '')
    .replaceAll('{total}', formatPrice(parts.total))
    .replaceAll('{anticipo}', formatPrice(parts.paid))
    .replaceAll('{saldo}', parts.pendingBalance > 0 ? formatPrice(parts.pendingBalance) : '')
    .replaceAll('{plan}', parts.planLine)
    .replaceAll('{meses}', String(parts.reminderMonths))

  // Limpieza: los bloques vacíos ({plan}, {saldo} en 0…) no dejan
  // renglones en blanco dobles ni espacios colgando al final de línea.
  return out
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
