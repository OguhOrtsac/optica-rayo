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
  })) as FixedExpense[]
}

export async function createFixedExpense(input: FixedExpenseInput): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase.from('fixed_expenses').insert([
    {
      concept: input.concept,
      amount: input.amount,
      periodicity: input.periodicity,
      created_by: await currentUserId(),
    },
  ])

  if (error) throw new Error(error.message)
}

export async function updateFixedExpense(
  id: string,
  input: FixedExpenseInput
): Promise<void> {
  const supabase = createBrowserClient()
  const { error } = await supabase
    .from('fixed_expenses')
    .update({
      concept: input.concept,
      amount: input.amount,
      periodicity: input.periodicity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

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
