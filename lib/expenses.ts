import { createClient as createBrowserClient } from '@/utils/supabase/client'

// ----------------------------------------------------
// Expenses (gastos del día + gastos fijos) y reportes por período.
//
// Módulo de administración: las tablas expenses / fixed_expenses
// solo las leen y escriben owner / super_admin (RLS en la base).
// Sin mocks: si la base falla, el error real sube a la pantalla.
// ----------------------------------------------------

export const EXPENSE_CATEGORIES = [
  'Insumos',
  'Cristales y material',
  'Limpieza',
  'Servicios',
  'Honorarios',
  'Equipo',
  'Otro',
] as const

export interface DailyExpense {
  id: string
  concept: string
  amount: number
  category: string
  expense_date: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface FixedExpense {
  id: string
  concept: string
  amount: number
  periodicity: 'weekly' | 'monthly' | 'yearly'
  is_active: boolean
  created_at: string
  /** Día de pago (migración 20261118): monthly = día del mes 1-31;
   *  weekly = 1 (lunes) a 7 (domingo); yearly = día del mes del
   *  aniversario. NULL = sin configurar. */
  due_day: number | null
  /** Última fecha (YYYY-MM-DD) en que se registró el pago. */
  last_paid_on: string | null
  /** La tabla no tiene columna de categoría; si algún día la gana,
   *  registerFixedPayment la aprovecha antes que el default. */
  category?: string | null
}

export interface DailyExpenseInput {
  concept: string
  amount: number
  category: string
  expense_date: string
  notes?: string
}

export interface FixedExpenseInput {
  concept: string
  amount: number
  periodicity: 'weekly' | 'monthly' | 'yearly'
  /** Día de pago según la periodicidad (ver FixedExpense.due_day). */
  due_day?: number | null
}

/** Postgres NUMERIC can arrive as string through PostgREST; normalize. */
function toAmount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function currentUserId(): Promise<string | null> {
  const supabase = createBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ----------------------------------------------------
// Gastos del día
// ----------------------------------------------------

/**
 * Daily expenses whose expense_date falls inside [fromISO, toISO]
 * (both inclusive), newest first.
 */
export async function getDailyExpenses(
  fromISO: string,
  toISO: string
): Promise<DailyExpense[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', fromISO)
    .lte('expense_date', toISO)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    ...row,
    amount: toAmount(row.amount),
  })) as DailyExpense[]
}

export async function createDailyExpense(input: DailyExpenseInput): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase.from('expenses').insert([
    {
      concept: input.concept,
      amount: input.amount,
      category: input.category,
      expense_date: input.expense_date,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      created_by: await currentUserId(),
    },
  ])

  if (error) throw new Error(error.message)
}

export async function updateDailyExpense(
  id: string,
  input: DailyExpenseInput
): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase
    .from('expenses')
    .update({
      concept: input.concept,
      amount: input.amount,
      category: input.category,
      expense_date: input.expense_date,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteDailyExpense(id: string): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

// ----------------------------------------------------
// Gastos fijos
// ----------------------------------------------------

/** Every fixed expense, active ones first and then by concept. */
export async function getFixedExpenses(): Promise<FixedExpense[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .order('is_active', { ascending: false })
    .order('concept', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    ...row,
    amount: toAmount(row.amount),
    due_day:
      row.due_day === null || row.due_day === undefined
        ? null
        : Math.trunc(Number(row.due_day)) || null,
    last_paid_on: row.last_paid_on ? String(row.last_paid_on).slice(0, 10) : null,
  })) as FixedExpense[]
}

/**
 * La columna due_day llega con la migración 20261118. Si la base aún
 * no la tiene, guardar un fijo no debe romperse: se reintenta sin el
 * campo y el resto del CRUD sigue funcionando como antes.
 */
function isMissingDueDayColumn(error: { message?: string } | null): boolean {
  return !!error?.message && /due_day/.test(error.message)
}

export async function createFixedExpense(input: FixedExpenseInput): Promise<void> {
  const supabase = createBrowserClient()
  const base = {
    concept: input.concept,
    amount: input.amount,
    periodicity: input.periodicity,
    created_by: await currentUserId(),
  }
  const { error } = await supabase
    .from('fixed_expenses')
    .insert([{ ...base, due_day: input.due_day ?? null }])

  if (error && isMissingDueDayColumn(error)) {
    const retry = await supabase.from('fixed_expenses').insert([base])
    if (retry.error) throw new Error(retry.error.message)
    return
  }
  if (error) throw new Error(error.message)
}

export async function updateFixedExpense(
  id: string,
  input: FixedExpenseInput
): Promise<void> {
  const supabase = createBrowserClient()
  const base = {
    concept: input.concept,
    amount: input.amount,
    periodicity: input.periodicity,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('fixed_expenses')
    .update({ ...base, due_day: input.due_day ?? null })
    .eq('id', id)

  if (error && isMissingDueDayColumn(error)) {
    const retry = await supabase.from('fixed_expenses').update(base).eq('id', id)
    if (retry.error) throw new Error(retry.error.message)
    return
  }
  if (error) throw new Error(error.message)
}

export async function deleteFixedExpense(id: string): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function setFixedExpenseActive(
  id: string,
  active: boolean
): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase
    .from('fixed_expenses')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ----------------------------------------------------
// Reporte por período (semana o rango de fechas)
// ----------------------------------------------------

export interface PeriodReport {
  salesTotal: number
  salesCount: number
  avgTicket: number
  dailyExpensesTotal: number
  expensesByCategory: { category: string; total: number }[]
  fixedMonthlyTotal: number
  fixedProrated: number
  profit: number
  salesByDay: { date: string; total: number; count: number }[]
  topProducts: { name: string; units: number; total: number }[]
}

/** A fixed expense converted to its monthly equivalent. */
function toMonthlyEquivalent(expense: FixedExpense): number {
  switch (expense.periodicity) {
    case 'weekly':
      return (expense.amount * 52) / 12
    case 'yearly':
      return expense.amount / 12
    default:
      return expense.amount
  }
}

/** Inclusive number of days between two YYYY-MM-DD dates. */
function inclusiveDays(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T12:00:00`)
  const end = new Date(`${endISO}T12:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, diff + 1)
}

/**
 * Period report: sales minus daily expenses minus the prorated
 * share of fixed expenses for the range [startISO, endISO].
 * Quotes (status 'Cotizacion') never count as sales.
 */
export async function getPeriodReport(
  startISO: string,
  endISO: string
): Promise<PeriodReport> {
  const supabase = createBrowserClient()
  const rangeStart = `${startISO}T00:00:00`
  const rangeEnd = `${endISO}T23:59:59`

  // --- Ventas del período ---
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('total, created_at')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd)
    .neq('status', 'Cotizacion')
    .order('created_at', { ascending: true })

  if (salesError) throw new Error(salesError.message)

  const sales = (salesData ?? []) as { total: number | string; created_at: string }[]
  const salesTotal = round2(sales.reduce((sum, s) => sum + toAmount(s.total), 0))
  const salesCount = sales.length
  const avgTicket = salesCount > 0 ? round2(salesTotal / salesCount) : 0

  const byDay = new Map<string, { date: string; total: number; count: number }>()
  for (const sale of sales) {
    const date = String(sale.created_at).slice(0, 10)
    const entry = byDay.get(date) ?? { date, total: 0, count: 0 }
    entry.total = round2(entry.total + toAmount(sale.total))
    entry.count += 1
    byDay.set(date, entry)
  }
  const salesByDay = Array.from(byDay.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  // --- Gastos del día del período ---
  const dailyExpenses = await getDailyExpenses(startISO, endISO)
  const dailyExpensesTotal = round2(
    dailyExpenses.reduce((sum, e) => sum + e.amount, 0)
  )
  const byCategory = new Map<string, number>()
  for (const expense of dailyExpenses) {
    byCategory.set(
      expense.category,
      round2((byCategory.get(expense.category) ?? 0) + expense.amount)
    )
  }
  const expensesByCategory = Array.from(byCategory.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  // --- Gastos fijos prorrateados ---
  const fixedExpenses = (await getFixedExpenses()).filter((f) => f.is_active)
  const fixedMonthlyTotal = round2(
    fixedExpenses.reduce((sum, f) => sum + toMonthlyEquivalent(f), 0)
  )
  const fixedProrated = round2(
    (fixedMonthlyTotal * inclusiveDays(startISO, endISO)) / 30
  )

  const profit = round2(salesTotal - dailyExpensesTotal - fixedProrated)

  // --- Productos más vendidos del período ---
  // sale_items NO tiene columna unit_price: el precio del renglón es
  // `price`, así que el total por producto es SUM(quantity * price).
  const { data: itemsData, error: itemsError } = await supabase
    .from('sale_items')
    .select('quantity, price, product_id, products(name), sales!inner(created_at, status)')
    .gte('sales.created_at', rangeStart)
    .lte('sales.created_at', rangeEnd)
    .neq('sales.status', 'Cotizacion')

  if (itemsError) throw new Error(itemsError.message)

  const byProduct = new Map<string, { name: string; units: number; total: number }>()
  for (const row of (itemsData ?? []) as any[]) {
    const key = row.product_id ?? 'sin-producto'
    const entry = byProduct.get(key) ?? {
      name: row.products?.name ?? 'Sin producto',
      units: 0,
      total: 0,
    }
    entry.units += row.quantity ?? 0
    entry.total = round2(entry.total + (row.quantity ?? 0) * toAmount(row.price))
    byProduct.set(key, entry)
  }
  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    salesTotal,
    salesCount,
    avgTicket,
    dailyExpensesTotal,
    expensesByCategory,
    fixedMonthlyTotal,
    fixedProrated,
    profit,
    salesByDay,
    topProducts,
  }
}

// ----------------------------------------------------
// Vencimientos de gastos fijos (migración 20261118)
// ----------------------------------------------------
//
// Cada fijo «toca» en una fecha por periodo (due_day). Un pago
// registrado (registerFixedPayment) crea el gasto del día y sella
// last_paid_on; con eso se sabe qué vencimientos ya están cubiertos.
//
// Regla de cobertura de un vencimiento D:
//  - cubierto si last_paid_on >= D (se pagó el día o después), o
//  - cubierto si el pago cayó dentro del ciclo de D (después del
//    vencimiento anterior) Y a lo sumo 3 días antes de D — pagar
//    unos días antes dentro de la ventana de «por vencer» cuenta
//    como pagar ESE vencimiento, no el siguiente.
// Un pago NO cubre dos ciclos: el siguiente vencimiento después de
// last_paid_on sigue pendiente aunque el pago haya sido tardío.

/** Days before a due date during which an early payment still
 *  counts as paying that due date (mirrors the por_vencer window). */
const EARLY_PAY_GRACE_DAYS = 3

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function toLocalISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Parse a YYYY-MM-DD string as a LOCAL date (never UTC). */
function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function addDaysTo(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** Whole days from a to b (b − a), both taken at local midnight. */
function diffWholeDays(a: Date, b: Date): number {
  return Math.round((localMidnight(b).getTime() - localMidnight(a).getTime()) / 86_400_000)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** The creation date of the fixed expense, in LOCAL time. */
function createdLocalDate(fixed: FixedExpense): Date {
  const parsed = new Date(fixed.created_at)
  return Number.isNaN(parsed.getTime()) ? localMidnight(new Date()) : localMidnight(parsed)
}

/** The due day resolved to a concrete number for the periodicity. */
function resolvedDueDay(fixed: FixedExpense): number {
  const raw = fixed.due_day
  if (fixed.periodicity === 'weekly') {
    return raw !== null && raw >= 1 && raw <= 7 ? raw : 1 // lunes
  }
  if (fixed.periodicity === 'yearly') {
    if (raw !== null && raw >= 1 && raw <= 31) return raw
    return createdLocalDate(fixed).getDate()
  }
  // monthly
  return raw !== null && raw >= 1 && raw <= 31 ? raw : 1
}

/** The due date that falls inside the period containing `ref`. */
function occurrenceInPeriod(fixed: FixedExpense, ref: Date): Date {
  const due = resolvedDueDay(fixed)
  if (fixed.periodicity === 'weekly') {
    const monday = addDaysTo(ref, -((ref.getDay() + 6) % 7))
    return addDaysTo(monday, due - 1)
  }
  if (fixed.periodicity === 'yearly') {
    const anchorMonth = createdLocalDate(fixed).getMonth()
    const day = Math.min(due, daysInMonth(ref.getFullYear(), anchorMonth))
    return new Date(ref.getFullYear(), anchorMonth, day)
  }
  const day = Math.min(due, daysInMonth(ref.getFullYear(), ref.getMonth()))
  return new Date(ref.getFullYear(), ref.getMonth(), day)
}

/** Move a due date one period forward (+1) or backward (−1). */
function stepOccurrence(fixed: FixedExpense, occ: Date, dir: 1 | -1): Date {
  if (fixed.periodicity === 'weekly') return addDaysTo(occ, 7 * dir)
  const due = resolvedDueDay(fixed)
  if (fixed.periodicity === 'yearly') {
    const year = occ.getFullYear() + dir
    const month = occ.getMonth()
    return new Date(year, month, Math.min(due, daysInMonth(year, month)))
  }
  const next = new Date(occ.getFullYear(), occ.getMonth() + dir, 1)
  return new Date(
    next.getFullYear(),
    next.getMonth(),
    Math.min(due, daysInMonth(next.getFullYear(), next.getMonth())),
  )
}

/** Whether the payment sealed in last_paid_on covers due date D. */
function isDueCovered(fixed: FixedExpense, due: Date): boolean {
  if (!fixed.last_paid_on) return false
  const paid = parseLocalISODate(fixed.last_paid_on)
  if (paid.getTime() >= localMidnight(due).getTime()) return true
  const prev = stepOccurrence(fixed, due, -1)
  return paid.getTime() > localMidnight(prev).getTime() && diffWholeDays(paid, due) <= EARLY_PAY_GRACE_DAYS
}

/**
 * The next due date that is NOT yet covered by a payment, counting
 * only due dates on/after the fixed expense was created (a fixed
 * expense is never «vencido» for periods before it existed).
 */
export function nextDueDate(fixed: FixedExpense, today: Date): Date {
  const created = createdLocalDate(fixed)
  let occ = occurrenceInPeriod(fixed, today)
  // Walk back to the first occurrence on/after the creation date.
  for (let i = 0; i < 600; i++) {
    const prev = stepOccurrence(fixed, occ, -1)
    if (prev.getTime() < created.getTime()) break
    occ = prev
  }
  while (occ.getTime() < created.getTime()) occ = stepOccurrence(fixed, occ, 1)
  // Advance past every covered due date.
  for (let i = 0; i < 1200 && isDueCovered(fixed, occ); i++) {
    occ = stepOccurrence(fixed, occ, 1)
  }
  return occ
}

export type FixedPaymentState = 'al_corriente' | 'por_vencer' | 'vencido'

/**
 * Payment state of a fixed expense:
 *  - 'vencido':    the next unpaid due date is already in the past.
 *  - 'por_vencer': it falls today or within the next 3 days.
 *  - 'al_corriente': anything else (inactive fixed expenses included:
 *    a paused fixed expense never alerts).
 */
export function fixedPaymentState(fixed: FixedExpense, today: Date): FixedPaymentState {
  if (!fixed.is_active) return 'al_corriente'
  const due = nextDueDate(fixed, today)
  const days = diffWholeDays(today, due)
  if (days < 0) return 'vencido'
  if (days <= 3) return 'por_vencer'
  return 'al_corriente'
}

/**
 * Registers the payment of a fixed expense: creates the matching
 * daily expense dated today (concept and amount of the fixed one;
 * category = the fixed one's category if it ever gains one, else
 * 'Servicios') and seals last_paid_on = today on the fixed row.
 */
export async function registerFixedPayment(id: string): Promise<void> {
  const supabase = createBrowserClient()
  const { data: fixed, error: fetchError } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !fixed) {
    throw new Error(fetchError?.message || 'No se encontró el gasto fijo.')
  }

  const todayISO = toLocalISODate(new Date())
  const { error: insertError } = await supabase.from('expenses').insert([
    {
      concept: fixed.concept,
      amount: toAmount(fixed.amount),
      category: (fixed as any).category || 'Servicios',
      expense_date: todayISO,
      notes: 'Pago de gasto fijo registrado desde Finanzas.',
      created_by: await currentUserId(),
    },
  ])
  if (insertError) throw new Error(insertError.message)

  const { error: updateError } = await supabase
    .from('fixed_expenses')
    .update({ last_paid_on: todayISO, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) throw new Error(updateError.message)
}

/**
 * Creates bell notifications for the CURRENT user for every active
 * fixed expense that is por_vencer or vencido. Returns how many
 * notifications were created.
 *
 * DEDUPLICATION RULE: at most one notification per fixed expense,
 * per state title, per payment cycle. Before inserting, it looks
 * for an existing notification of this user with the EXACT same
 * title created within the current cycle window — from one period
 * before the pending due date (7/31/366 days) up to now. If one
 * exists, nothing is inserted. Because the title changes when the
 * state escalates (por vencer → vencido), a vencido alert can still
 * be created even if a por_vencer one existed earlier in the cycle.
 */
export async function ensureFixedPaymentNotifications(): Promise<number> {
  const supabase = createBrowserClient()
  const userId = await currentUserId()
  if (!userId) return 0

  const fixedList = await getFixedExpenses()
  const today = new Date()
  const moneyFmt = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  })
  let created = 0

  for (const fixed of fixedList) {
    if (!fixed.is_active) continue
    const state = fixedPaymentState(fixed, today)
    if (state === 'al_corriente') continue

    const due = nextDueDate(fixed, today)
    const title =
      state === 'vencido'
        ? `Pago fijo vencido: ${fixed.concept}`
        : `Pago fijo por vencer: ${fixed.concept}`

    const periodDays =
      fixed.periodicity === 'weekly' ? 7 : fixed.periodicity === 'yearly' ? 366 : 31
    const windowStartISO = addDaysTo(due, -periodDays).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('title', title)
      .gte('created_at', windowStartISO)
      .limit(1)
    if (existing && existing.length > 0) continue

    const dueLabel = due.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const message =
      state === 'vencido'
        ? `«${fixed.concept}» por ${moneyFmt.format(fixed.amount)} venció el ${dueLabel} y sigue sin registrarse como pagado.`
        : `«${fixed.concept}» por ${moneyFmt.format(fixed.amount)} se paga el ${dueLabel}.`

    const { error } = await supabase.from('notifications').insert([
      { user_id: userId, title, message, type: 'general', is_read: false },
    ])
    if (!error) created += 1
  }
  return created
}

// ----------------------------------------------------
// Pagos de un periodo (para la utilidad de caja)
// ----------------------------------------------------

export interface PeriodPayments {
  /** Gastos del día (expenses) fechados dentro del rango. */
  dailyExpensesTotal: number
  /** Equivalente mensual de los fijos activos. */
  fixedMonthlyTotal: number
  /** Fijos prorrateados por los días del rango (misma regla que
   *  getPeriodReport: mensual × días ÷ 30). */
  fixedProrated: number
  /** dailyExpensesTotal + fixedProrated. */
  total: number
}

/**
 * Money out for a range: daily expenses dated inside [fromISO, toISO]
 * plus the prorated share of active fixed expenses.
 */
export async function getPeriodPayments(
  fromISO: string,
  toISO: string
): Promise<PeriodPayments> {
  const daily = await getDailyExpenses(fromISO, toISO)
  const dailyExpensesTotal = round2(daily.reduce((sum, e) => sum + e.amount, 0))

  const fixedExpenses = (await getFixedExpenses()).filter((f) => f.is_active)
  const fixedMonthlyTotal = round2(
    fixedExpenses.reduce((sum, f) => sum + toMonthlyEquivalent(f), 0)
  )
  const fixedProrated = round2(
    (fixedMonthlyTotal * inclusiveDays(fromISO, toISO)) / 30
  )

  return {
    dailyExpensesTotal,
    fixedMonthlyTotal,
    fixedProrated,
    total: round2(dailyExpensesTotal + fixedProrated),
  }
}
