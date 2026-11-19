/**
 * Ticket de compra como IMAGEN (dictado del dueño, 2026-11-19): el
 * vendedor comparte un PNG con forma de recibo por WhatsApp, junto
 * con el texto del ticket. Se dibuja con canvas puro (sin librerías)
 * desde composeTicketParts() — la MISMA composición que alimenta el
 * texto (lib/ticket.ts) — para que imagen y texto de una venta nunca
 * se contradigan: mismos artículos, mismos montos, mismo plan.
 *
 * Formato: recibo vertical de 720px de ancho (renderizado a 2× para
 * nitidez), fondo blanco, alto según el contenido.
 */

import { composeTicketParts, formatTicketPrice, type TicketData } from './ticket'

const WIDTH = 720
const SCALE = 2
const PAD = 48
const CONTENT_WIDTH = WIDTH - PAD * 2

const BRAND = '#00357f'
const INK = '#111c2d'
const MUTED = '#737784'
const FAINT_LINE = '#dee8ff'
const GREEN = '#00422b'

const FONT_STACK = '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif'

interface Row {
  height: number
  draw: (ctx: CanvasRenderingContext2D, y: number) => void
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const probe = current ? `${current} ${word}` : word
    if (ctx.measureText(probe).width <= maxWidth || !current) {
      current = probe
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/**
 * Renders the purchase ticket as a PNG blob. Throws when the browser
 * cannot produce the image (the caller falls back to the text ticket).
 */
export async function renderTicketImageBlob(data: TicketData): Promise<Blob> {
  const parts = composeTicketParts(data)

  // Measurement pass on a scratch context: the same fonts the draw
  // pass uses, so the computed height matches the drawing exactly.
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) throw new Error('Canvas no disponible')
  const rows: Row[] = []

  const textRow = (
    text: string,
    font: string,
    color: string,
    opts: { align?: CanvasTextAlign; lineHeight?: number; indent?: number } = {}
  ): Row => {
    const lineHeight = opts.lineHeight ?? 1.3
    scratch.font = font
    const wrapped = wrapText(scratch, text, CONTENT_WIDTH - (opts.indent ?? 0))
    const size = parseInt(font.match(/(\d+)px/)?.[1] || '24', 10)
    return {
      height: wrapped.length * size * lineHeight,
      draw: (ctx, y) => {
        ctx.font = font
        ctx.fillStyle = color
        ctx.textAlign = opts.align ?? 'left'
        ctx.textBaseline = 'top'
        const x = opts.align === 'center' ? WIDTH / 2 : PAD + (opts.indent ?? 0)
        wrapped.forEach((line, i) => ctx.fillText(line, x, y + i * size * lineHeight))
      }
    }
  }

  const amountRow = (
    label: string,
    amount: string,
    font: string,
    labelColor: string,
    amountColor: string,
    opts: { indent?: number } = {}
  ): Row => {
    const indent = opts.indent ?? 0
    scratch.font = font
    const amountWidth = scratch.measureText(amount).width
    const wrapped = wrapText(scratch, label, CONTENT_WIDTH - indent - amountWidth - 24)
    const size = parseInt(font.match(/(\d+)px/)?.[1] || '24', 10)
    const lineHeight = size * 1.3
    return {
      height: wrapped.length * lineHeight,
      draw: (ctx, y) => {
        ctx.font = font
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.fillStyle = labelColor
        wrapped.forEach((line, i) => ctx.fillText(line, PAD + indent, y + i * lineHeight))
        ctx.textAlign = 'right'
        ctx.fillStyle = amountColor
        ctx.fillText(amount, WIDTH - PAD, y)
      }
    }
  }

  const dividerRow = (dashed: boolean): Row => ({
    height: 26,
    draw: (ctx, y) => {
      ctx.strokeStyle = FAINT_LINE
      ctx.lineWidth = 2
      ctx.setLineDash(dashed ? [8, 7] : [])
      ctx.beginPath()
      ctx.moveTo(PAD, y + 13)
      ctx.lineTo(WIDTH - PAD, y + 13)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  const gapRow = (height: number): Row => ({ height, draw: () => {} })

  // Franja de marca superior.
  rows.push({
    height: 14,
    draw: (ctx, y) => {
      ctx.fillStyle = BRAND
      ctx.fillRect(0, y, WIDTH, 14)
    }
  })
  rows.push(gapRow(30))
  rows.push(textRow('Óptica Rayo', `800 46px ${FONT_STACK}`, BRAND, { lineHeight: 1.15 }))
  rows.push(textRow('Ticket de compra', `600 25px ${FONT_STACK}`, MUTED))
  rows.push(gapRow(6))
  rows.push(textRow(`Orden #${parts.orderCode} · ${parts.dateLabel}`, `500 22px ${FONT_STACK}`, MUTED))
  if (parts.customerName) {
    rows.push(gapRow(4))
    rows.push(textRow(`Cliente: ${parts.customerName}`, `700 25px ${FONT_STACK}`, INK))
  }
  rows.push(dividerRow(true))
  rows.push(textRow('ARTÍCULOS COMPRADOS', `700 19px ${FONT_STACK}`, MUTED))
  rows.push(gapRow(8))
  for (const line of parts.lines) {
    rows.push(
      line.complement
        ? amountRow(line.label, line.amountLabel, `500 22px ${FONT_STACK}`, '#434653', line.amountLabel === 'Gratis' ? GREEN : '#434653', { indent: 30 })
        : amountRow(line.label, line.amountLabel, `600 25px ${FONT_STACK}`, INK, INK)
    )
  }
  rows.push(dividerRow(true))
  rows.push(amountRow('Subtotal', formatTicketPrice(parts.subtotal), `500 25px ${FONT_STACK}`, '#434653', '#434653'))
  if (parts.discount) {
    rows.push(
      amountRow(
        `Descuento${parts.discount.detail ? ` (${parts.discount.detail})` : ''}`,
        `−${formatTicketPrice(parts.discount.amount)}`,
        `700 25px ${FONT_STACK}`,
        GREEN,
        GREEN
      )
    )
  }
  rows.push(gapRow(6))
  rows.push(amountRow('Total', formatTicketPrice(parts.total), `800 36px ${FONT_STACK}`, INK, BRAND))
  rows.push(gapRow(4))
  rows.push(amountRow('Anticipo', formatTicketPrice(parts.paid), `500 25px ${FONT_STACK}`, '#434653', '#434653'))
  if (parts.planLine) {
    rows.push(gapRow(2))
    rows.push(textRow(parts.planLine, `600 23px ${FONT_STACK}`, BRAND))
  }
  rows.push(gapRow(10))
  rows.push(textRow('Los precios ya incluyen IVA', `500 20px ${FONT_STACK}`, MUTED))
  rows.push(dividerRow(true))
  rows.push(textRow('¡Gracias por su compra!', `800 29px ${FONT_STACK}`, BRAND, { align: 'center' }))
  rows.push(gapRow(4))
  rows.push(
    textRow(
      `Lo volvemos a esperar en ${parts.reminderMonths} meses para su examen de vista.`,
      `500 20px ${FONT_STACK}`,
      MUTED,
      { align: 'center' }
    )
  )
  rows.push(gapRow(34))

  const totalHeight = rows.reduce((sum, r) => sum + r.height, 0)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = Math.ceil(totalHeight) * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, totalHeight)

  let y = 0
  for (const row of rows) {
    row.draw(ctx, y)
    y += row.height
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo generar la imagen del ticket')
  return blob
}

/** File name for the shared/downloaded ticket image of one order. */
export function ticketImageFileName(orderCode: string): string {
  return `ticket-${orderCode}.png`
}
