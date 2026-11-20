/**
 * Planes de pago a plazos — UNA sola fuente de verdad para el cálculo
 * (dictados del dueño, 2026-11-19): el plan del POS («Realizar venta»)
 * y la reestructuración de deuda en la ficha del cliente dividen un
 * saldo en N cuotas con estas reglas:
 *
 * - Cuotas iguales A CENTAVOS: la suma de las cuotas es EXACTAMENTE
 *   el saldo; la ÚLTIMA cuota absorbe el redondeo.
 * - Fechas: semanal +7 días, quincenal +15 días, mensual +1 MES
 *   CALENDARIO (sumar meses a la fecha, nunca 30 días fijos).
 * - Las fechas viajan como 'YYYY-MM-DD' y la aritmética se ancla al
 *   mediodía local para que ningún cambio de horario mueva el día.
 */

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly'

export const PAYMENT_FREQUENCIES: PaymentFrequency[] = ['weekly', 'biweekly', 'monthly']

export function isPaymentFrequency(value: string): value is PaymentFrequency {
  return (PAYMENT_FREQUENCIES as string[]).includes(value)
}

/** «semanal» / «quincenal» / «mensual» (singular, para textos). */
export function frequencySingular(frequency: PaymentFrequency): string {
  return frequency === 'weekly' ? 'semanal' : frequency === 'biweekly' ? 'quincenal' : 'mensual'
}

/** «semanales» / «quincenales» / «mensuales» (plural, para textos). */
export function frequencyPlural(frequency: PaymentFrequency): string {
  return frequency === 'weekly' ? 'semanales' : frequency === 'biweekly' ? 'quincenales' : 'mensuales'
}

/** «cada semana» / «cada quincena» / «cada mes». */
export function frequencyEvery(frequency: PaymentFrequency): string {
  return frequency === 'weekly' ? 'cada semana' : frequency === 'biweekly' ? 'cada quincena' : 'cada mes'
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Parsea 'YYYY-MM-DD' a Date anclada al mediodía local. */
export function parsePlanDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

/** Formatea una Date como 'YYYY-MM-DD' en hora local. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Suma UN periodo de la frecuencia a una fecha 'YYYY-MM-DD'.
 * Mensual = mes calendario (31 ene → 28/29 feb → 28/29 mar no aplica:
 * cada paso suma sobre la fecha anterior, como dictó el dueño).
 */
export function addFrequencyPeriod(isoDate: string, frequency: PaymentFrequency): string {
  const d = parsePlanDate(isoDate)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 15)
  else d.setMonth(d.getMonth() + 1)
  return toISODate(d)
}

/**
 * Fecha del primer pago por default: hoy + un periodo (semanal +7,
 * quincenal +15, mensual +1 mes calendario).
 */
export function defaultFirstPaymentDate(frequency: PaymentFrequency, from: Date = new Date()): string {
  return addFrequencyPeriod(toISODate(from), frequency)
}

export interface InstallmentSpec {
  installment_number: number
  due_date: string
  amount: number
}

/**
 * Divide `totalAmount` en `count` cuotas: iguales a centavos y con la
 * última absorbiendo el redondeo, para que Σ cuotas == totalAmount
 * EXACTO. Las fechas corren desde `firstDueDate` sumando un periodo
 * de la frecuencia. `startNumber` permite continuar la numeración
 * tras cuotas conservadas (reestructuración).
 */
export function buildInstallmentSchedule(
  totalAmount: number,
  count: number,
  frequency: PaymentFrequency,
  firstDueDate: string,
  startNumber: number = 1
): InstallmentSpec[] {
  const n = Math.max(1, Math.floor(count) || 1)
  const totalCents = Math.round(Math.max(0, totalAmount) * 100)
  const baseCents = Math.floor(totalCents / n)
  const remainderCents = totalCents - baseCents * n

  const schedule: InstallmentSpec[] = []
  let due = firstDueDate
  for (let i = 0; i < n; i++) {
    if (i > 0) due = addFrequencyPeriod(due, frequency)
    const cents = i === n - 1 ? baseCents + remainderCents : baseCents
    schedule.push({
      installment_number: startNumber + i,
      due_date: due,
      amount: round2(cents / 100),
    })
  }
  return schedule
}

/** Lo que el cliente teclea en el POS / la reestructuración. */
export interface PaymentPlanInput {
  installments: number
  frequency: PaymentFrequency
  firstPaymentDate: string
}

/** Resumen de un plan ya generado (tarjeta de éxito, ticket, historial). */
export interface PaymentPlanSummary extends PaymentPlanInput {
  /** Monto de la cuota típica (la primera; la última puede variar por redondeo). */
  installmentAmount: number
  /** Monto de la última cuota (difiere solo si absorbió redondeo). */
  lastInstallmentAmount: number
  /** Saldo total que el plan divide. */
  totalAmount: number
}

export function summarizePlan(
  totalAmount: number,
  input: PaymentPlanInput,
  schedule: InstallmentSpec[]
): PaymentPlanSummary {
  return {
    ...input,
    installmentAmount: schedule[0]?.amount ?? 0,
    lastInstallmentAmount: schedule[schedule.length - 1]?.amount ?? 0,
    totalAmount: round2(totalAmount),
  }
}

/** Una cuota ya persistida (payment_installments), forma mínima. */
export interface StoredInstallment {
  installment_number?: number | null
  due_date: string
  amount: number
  amount_paid?: number | null
  status?: string | null
}

/** Resumen del plan de una venta YA guardada, derivado de sus cuotas. */
export interface DerivedPlanSummary {
  /** Cuotas aún no liquidadas. */
  pendingCount: number
  /** Frecuencia derivada del espaciamiento entre las fechas de pago. */
  frequency: PaymentFrequency
  /** Monto de la primera cuota pendiente. */
  installmentAmount: number
  /** Fecha ('YYYY-MM-DD') de la primera cuota pendiente. */
  firstPendingDate: string
}

const isSettledInstallment = (i: StoredInstallment): boolean =>
  i.status === 'paid' || Number(i.amount_paid ?? 0) >= Number(i.amount ?? 0)

/**
 * Deriva el resumen del plan de una venta guardada a partir de sus
 * cuotas persistidas (las cuotas no guardan su frecuencia: se infiere
 * del espaciamiento entre las dos primeras fechas — 7 días semanal,
 * 15 quincenal, ~1 mes mensual; con una sola cuota no hay espaciamiento
 * que leer y se asume mensual). Devuelve null cuando la venta no tiene
 * cuotas o ya están todas liquidadas (no hay plan vivo que anunciar).
 */
export function derivePlanSummary(
  installments: StoredInstallment[]
): DerivedPlanSummary | null {
  if (!installments || installments.length === 0) return null
  const sorted = [...installments].sort((a, b) => {
    const byNumber = (a.installment_number ?? 0) - (b.installment_number ?? 0)
    if (byNumber !== 0) return byNumber
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  })
  const pending = sorted.filter(i => !isSettledInstallment(i))
  if (pending.length === 0) return null

  let frequency: PaymentFrequency = 'monthly'
  if (sorted.length >= 2) {
    const first = parsePlanDate(sorted[0].due_date.slice(0, 10))
    const second = parsePlanDate(sorted[1].due_date.slice(0, 10))
    const gapDays = Math.round((second.getTime() - first.getTime()) / 86_400_000)
    if (gapDays >= 6 && gapDays <= 8) frequency = 'weekly'
    else if (gapDays >= 13 && gapDays <= 17) frequency = 'biweekly'
    else frequency = 'monthly'
  }

  return {
    pendingCount: pending.length,
    frequency,
    installmentAmount: Number(pending[0].amount ?? 0),
    firstPendingDate: pending[0].due_date.slice(0, 10),
  }
}
