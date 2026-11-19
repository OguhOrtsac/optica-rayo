/**
 * WhatsApp purchase ticket («ticket de compra») built at the POS right
 * after a sale is registered, so the seller can send it to the buyer.
 *
 * Plain text with WhatsApp bold markers (*...*). The owner was
 * explicit: NO VAT breakdown on the customer ticket — catalog prices
 * already include the tax and itemizing it makes customers think they
 * were charged extra. The ticket only says what was bought (with its
 * complements), the discount and why, the total, what was paid and
 * any pending balance, and it closes inviting the customer back for
 * their next eye exam at the configured reminder period.
 */

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
  lines: TicketLine[]
  subtotal: number
  discount?: TicketDiscountInfo | null
  total: number
  paid: number
  pendingBalance: number
  /** Configured reminder period (months) for the closing invitation. */
  reminderMonths: number
  /**
   * Plan de pagos generado con la venta (dictado 2026-11-19): una
   * sola línea bajo el saldo — «Plan: N pagos quincenales de $X ·
   * primer pago el <fecha>».
   */
  paymentPlan?: {
    installments: number
    frequency: 'weekly' | 'biweekly' | 'monthly'
    installmentAmount: number
    firstPaymentDate: string
  } | null
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(price)

/**
 * On-screen order code, exactly as the sales History shows it: the
 * last 6 characters of the first UUID segment, uppercased
 * (`sale.id.slice(2, 8)`). Also works for demo-mode ids.
 */
export function orderCodeFromSaleId(saleId: string): string {
  return saleId.slice(2, 8).toUpperCase()
}

/** Builds the plain-text WhatsApp ticket for a registered sale. */
export function buildTicketMessage(data: TicketData): string {
  const lines: string[] = []

  lines.push('*Óptica Rayo* — Ticket de compra')
  lines.push(`Orden #${data.orderCode}`)
  lines.push(
    data.date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  )
  lines.push('')

  for (const line of data.lines) {
    lines.push(`• ${line.quantity} × ${line.name} — ${formatPrice(line.lineTotal)}`)
    for (const complement of line.complements) {
      lines.push(
        `  + ${complement.name} — ${complement.lineTotal > 0 ? formatPrice(complement.lineTotal) : 'Gratis'}`
      )
    }
  }

  lines.push('')
  lines.push(`Subtotal: ${formatPrice(data.subtotal)}`)
  if (data.discount && data.discount.amount > 0) {
    lines.push(
      `Descuento: −${formatPrice(data.discount.amount)}${data.discount.detail ? ` (${data.discount.detail})` : ''}`
    )
  }
  lines.push(`*Total: ${formatPrice(data.total)}*`)
  lines.push(`Pagado: ${formatPrice(data.paid)}`)
  if (data.pendingBalance > 0) {
    lines.push(`Saldo pendiente: ${formatPrice(data.pendingBalance)}`)
  }
  if (data.paymentPlan && data.pendingBalance > 0) {
    const freqLabel =
      data.paymentPlan.frequency === 'weekly'
        ? 'semanales'
        : data.paymentPlan.frequency === 'biweekly'
          ? 'quincenales'
          : 'mensuales'
    const [py, pm, pd] = data.paymentPlan.firstPaymentDate.split('-').map(Number)
    const firstDate = new Date(py || 1970, (pm || 1) - 1, pd || 1).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    lines.push(
      `Plan: ${data.paymentPlan.installments} pagos ${freqLabel} de ${formatPrice(data.paymentPlan.installmentAmount)} · primer pago el ${firstDate}`
    )
  }

  lines.push('')
  lines.push(
    `¡Muchas gracias por su compra! Lo volvemos a esperar en ${data.reminderMonths} meses para su examen de vista.`
  )

  return lines.join('\n')
}
