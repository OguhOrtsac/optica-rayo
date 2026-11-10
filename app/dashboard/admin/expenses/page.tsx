'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Lock,
  Plus,
  Receipt,
  Repeat,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import {
  EXPENSE_CATEGORIES,
  createDailyExpense,
  createFixedExpense,
  deleteDailyExpense,
  deleteFixedExpense,
  getDailyExpenses,
  getFixedExpenses,
  setFixedExpenseActive,
  updateDailyExpense,
  updateFixedExpense,
  type DailyExpense,
  type FixedExpense,
} from '@/lib/expenses'

// Expenses are managed ONLY by the administrator (owner / super_admin),
// same gate as Promotions: the seller sells; the owner controls the
// money going out. RLS enforces the same rule in the database; this
// page gate is the friendly front door.
//
// Two kinds of expenses (the owner's model):
//  - «Del día»: one-off dated expenses (supplies, crystals, cleaning…).
//  - «Fijos»: recurring expenses (rent, water, electricity…) with a
//    full CRUD and a monthly-equivalent total.

type Tab = 'daily' | 'fixed'
type Periodicity = 'weekly' | 'monthly' | 'yearly'

const PERIODICITY_META: Record<Periodicity, { label: string; monthlyFactor: number }> = {
  weekly: { label: 'Semanal', monthlyFactor: 52 / 12 },
  monthly: { label: 'Mensual', monthlyFactor: 1 },
  yearly: { label: 'Anual', monthlyFactor: 1 / 12 },
}

const CATEGORY_CHIP: Record<string, string> = {
  Insumos: 'bg-[#dee8ff] text-[#00357f]',
  'Cristales y material': 'bg-[#e6f5fb] text-[#0077a3]',
  Limpieza: 'bg-[#e2f9ee] text-[#00422b]',
  Servicios: 'bg-[#fef3c7] text-[#92400e]',
  Equipo: 'bg-[#f0f3ff] text-[#00357f]',
  Otro: 'bg-[#f0f3ff] text-[#737784]',
}

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

function formatMoney(amount: number): string {
  return money.format(Number.isFinite(amount) ? amount : 0)
}

function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function todayStr(): string {
  return toISODate(new Date())
}

/** Parse a YYYY-MM-DD string as a LOCAL date (never UTC). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

/** «lunes 9 nov 2026» */
function formatDayHeader(dateStr: string): string {
  return parseLocalDate(dateStr)
    .toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace(',', '')
}

function monthlyEquivalent(fixed: FixedExpense): number {
  const meta = PERIODICITY_META[fixed.periodicity as Periodicity] ?? PERIODICITY_META.monthly
  return fixed.amount * meta.monthlyFactor
}

function periodicityLabel(value: string): string {
  return PERIODICITY_META[value as Periodicity]?.label ?? value
}

interface DailyForm {
  expense_date: string
  concept: string
  amount: string
  category: string
  notes: string
}

interface FixedForm {
  concept: string
  amount: string
  periodicity: Periodicity
  is_active: boolean
}

const EMPTY_FIXED_FORM: FixedForm = {
  concept: '',
  amount: '',
  periodicity: 'monthly',
  is_active: true,
}

function emptyDailyForm(): DailyForm {
  return {
    expense_date: todayStr(),
    concept: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0],
    notes: '',
  }
}

export default function AdminExpensesPage() {
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState<Tab>('daily')

  // Daily expenses (initial window: last 30 days, widened if the user
  // registers an older expense so it does not "disappear").
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toISODate(d)
  })
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])

  // Daily form modal
  const [dailyFormOpen, setDailyFormOpen] = useState(false)
  const [editingDaily, setEditingDaily] = useState<DailyExpense | null>(null)
  const [dailyForm, setDailyForm] = useState<DailyForm>(emptyDailyForm)
  const [dailyFormError, setDailyFormError] = useState<string | null>(null)
  const [savingDaily, setSavingDaily] = useState(false)
  const [confirmDeleteDaily, setConfirmDeleteDaily] = useState(false)
  const [deletingDaily, setDeletingDaily] = useState(false)

  // Fixed form modal
  const [fixedFormOpen, setFixedFormOpen] = useState(false)
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null)
  const [fixedForm, setFixedForm] = useState<FixedForm>(EMPTY_FIXED_FORM)
  const [fixedFormError, setFixedFormError] = useState<string | null>(null)
  const [savingFixed, setSavingFixed] = useState(false)
  const [confirmDeleteFixed, setConfirmDeleteFixed] = useState(false)
  const [deletingFixed, setDeletingFixed] = useState(false)
  const [busyFixedId, setBusyFixedId] = useState<string | null>(null)

  const loadAll = async (from: string) => {
    const [daily, fixed] = await Promise.all([
      getDailyExpenses(from, todayStr()),
      getFixedExpenses(),
    ])
    setDailyExpenses(daily)
    setFixedExpenses(fixed)
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadError(null)
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCanManage(false)
          return
        }

        // Authoritative role: the profiles row (same source the RLS
        // helper get_my_role() reads), with user_metadata as fallback.
        let roleValue: string | null = user.user_metadata?.role || null
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.role) roleValue = profile.role
        } catch {
          // keep the metadata fallback
        }
        const role = normalizeRole(roleValue)
        const allowed = role === 'owner' || role === 'super_admin'
        setCanManage(allowed)
        if (allowed) {
          const d = new Date()
          d.setDate(d.getDate() - 29)
          await loadAll(toISODate(d))
        }
      } catch (err: any) {
        console.error('Error loading expenses admin:', err)
        setLoadError(err?.message || 'No se pudieron cargar los gastos.')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshDaily = async (from = rangeFrom) => {
    setDailyExpenses(await getDailyExpenses(from, todayStr()))
  }

  const refreshFixed = async () => {
    setFixedExpenses(await getFixedExpenses())
  }

  // ---- Daily figures & grouping (from what is loaded, local dates) ----
  const todayTotal = useMemo(() => {
    const today = todayStr()
    return dailyExpenses
      .filter(e => e.expense_date === today)
      .reduce((sum, e) => sum + e.amount, 0)
  }, [dailyExpenses])

  const monthTotal = useMemo(() => {
    const monthPrefix = todayStr().slice(0, 7) // YYYY-MM, local
    return dailyExpenses
      .filter(e => e.expense_date.startsWith(monthPrefix))
      .reduce((sum, e) => sum + e.amount, 0)
  }, [dailyExpenses])

  const dailyGroups = useMemo(() => {
    const map = new Map<string, DailyExpense[]>()
    for (const e of dailyExpenses) {
      const arr = map.get(e.expense_date)
      if (arr) arr.push(e)
      else map.set(e.expense_date, [e])
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items,
        subtotal: items.reduce((sum, e) => sum + e.amount, 0),
      }))
  }, [dailyExpenses])

  // ---- Fixed figures ----
  const fixedMonthlyTotal = useMemo(
    () =>
      fixedExpenses
        .filter(f => f.is_active)
        .reduce((sum, f) => sum + monthlyEquivalent(f), 0),
    [fixedExpenses],
  )

  // ---- Daily form handlers ----
  const openCreateDaily = () => {
    setEditingDaily(null)
    setDailyForm(emptyDailyForm())
    setDailyFormError(null)
    setConfirmDeleteDaily(false)
    setDailyFormOpen(true)
  }

  const openEditDaily = (expense: DailyExpense) => {
    setEditingDaily(expense)
    setDailyForm({
      expense_date: expense.expense_date,
      concept: expense.concept,
      amount: String(expense.amount),
      category: expense.category,
      notes: expense.notes || '',
    })
    setDailyFormError(null)
    setConfirmDeleteDaily(false)
    setDailyFormOpen(true)
  }

  const handleSaveDaily = async () => {
    const concept = dailyForm.concept.trim()
    if (!concept) {
      setDailyFormError('El concepto es obligatorio.')
      return
    }
    const amount = Number(dailyForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDailyFormError('El monto debe ser un número mayor a 0.')
      return
    }
    if (!dailyForm.expense_date) {
      setDailyFormError('La fecha es obligatoria.')
      return
    }

    const payload = {
      expense_date: dailyForm.expense_date,
      concept,
      amount,
      category: dailyForm.category || EXPENSE_CATEGORIES[0],
      notes: dailyForm.notes.trim() || undefined,
    }

    try {
      setSavingDaily(true)
      setDailyFormError(null)
      if (editingDaily) {
        await updateDailyExpense(editingDaily.id, payload)
        setFeedbackMsg({ type: 'success', text: 'Gasto actualizado.' })
      } else {
        await createDailyExpense(payload)
        setFeedbackMsg({ type: 'success', text: 'Gasto registrado.' })
      }
      setDailyFormOpen(false)
      // Widen the window if the saved date is older than what is shown.
      const from = payload.expense_date < rangeFrom ? payload.expense_date : rangeFrom
      if (from !== rangeFrom) setRangeFrom(from)
      await refreshDaily(from)
    } catch (err: any) {
      setDailyFormError(err?.message || 'No se pudo guardar el gasto.')
    } finally {
      setSavingDaily(false)
    }
  }

  const handleDeleteDaily = async () => {
    if (!editingDaily) return
    try {
      setDeletingDaily(true)
      await deleteDailyExpense(editingDaily.id)
      setFeedbackMsg({ type: 'success', text: 'Gasto eliminado.' })
      setDailyFormOpen(false)
      await refreshDaily()
    } catch (err: any) {
      setDailyFormError(err?.message || 'No se pudo eliminar el gasto.')
    } finally {
      setDeletingDaily(false)
      setConfirmDeleteDaily(false)
    }
  }

  // ---- Fixed form handlers ----
  const openCreateFixed = () => {
    setEditingFixed(null)
    setFixedForm(EMPTY_FIXED_FORM)
    setFixedFormError(null)
    setConfirmDeleteFixed(false)
    setFixedFormOpen(true)
  }

  const openEditFixed = (fixed: FixedExpense) => {
    setEditingFixed(fixed)
    setFixedForm({
      concept: fixed.concept,
      amount: String(fixed.amount),
      periodicity: (fixed.periodicity as Periodicity) || 'monthly',
      is_active: fixed.is_active,
    })
    setFixedFormError(null)
    setConfirmDeleteFixed(false)
    setFixedFormOpen(true)
  }

  const handleSaveFixed = async () => {
    const concept = fixedForm.concept.trim()
    if (!concept) {
      setFixedFormError('El concepto es obligatorio.')
      return
    }
    const amount = Number(fixedForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFixedFormError('El monto debe ser un número mayor a 0.')
      return
    }

    // FixedExpenseInput does not carry is_active: the active flag is a
    // separate operation (setFixedExpenseActive), both on edit and on
    // create (new rows are born active in the base).
    const payload = {
      concept,
      amount,
      periodicity: fixedForm.periodicity,
    }

    try {
      setSavingFixed(true)
      setFixedFormError(null)
      if (editingFixed) {
        await updateFixedExpense(editingFixed.id, payload)
        if (fixedForm.is_active !== editingFixed.is_active) {
          await setFixedExpenseActive(editingFixed.id, fixedForm.is_active)
        }
        setFeedbackMsg({ type: 'success', text: 'Gasto fijo actualizado.' })
      } else {
        await createFixedExpense(payload)
        if (!fixedForm.is_active) {
          // Born active and createFixedExpense returns no id: find the
          // just-created row (same concept/amount/periodicity, newest
          // created_at) and switch it off.
          const fresh = await getFixedExpenses()
          const created = fresh
            .filter(
              f =>
                f.is_active &&
                f.concept === payload.concept &&
                f.amount === payload.amount &&
                f.periodicity === payload.periodicity,
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          if (created) await setFixedExpenseActive(created.id, false)
        }
        setFeedbackMsg({ type: 'success', text: 'Gasto fijo registrado.' })
      }
      setFixedFormOpen(false)
      await refreshFixed()
    } catch (err: any) {
      setFixedFormError(err?.message || 'No se pudo guardar el gasto fijo.')
    } finally {
      setSavingFixed(false)
    }
  }

  const handleDeleteFixed = async () => {
    if (!editingFixed) return
    try {
      setDeletingFixed(true)
      await deleteFixedExpense(editingFixed.id)
      setFeedbackMsg({ type: 'success', text: 'Gasto fijo eliminado.' })
      setFixedFormOpen(false)
      await refreshFixed()
    } catch (err: any) {
      setFixedFormError(err?.message || 'No se pudo eliminar el gasto fijo.')
    } finally {
      setDeletingFixed(false)
      setConfirmDeleteFixed(false)
    }
  }

  const handleToggleFixedActive = async (fixed: FixedExpense) => {
    try {
      setBusyFixedId(fixed.id)
      await setFixedExpenseActive(fixed.id, !fixed.is_active)
      setFeedbackMsg({
        type: 'success',
        text: fixed.is_active ? 'Gasto fijo desactivado.' : 'Gasto fijo activado.',
      })
      await refreshFixed()
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'No se pudo cambiar el estado del gasto fijo.',
      })
    } finally {
      setBusyFixedId(null)
    }
  }

  // ---- Shared bits ----
  const renderToggle = (
    active: boolean,
    onToggle: () => void,
    label: string,
    disabled = false,
  ) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none disabled:opacity-50 ${
        active ? 'bg-[#00357f]' : 'bg-[#cbd5e1]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
          active ? 'translate-x-5.5' : 'translate-x-0'
        }`}
      />
    </button>
  )

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando gastos…</p>
        </div>
      </main>
    )
  }

  if (!canManage) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
        <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <Receipt className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Gastos</h1>
          </div>
        </div>
        <div className="mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Los gastos los registra y administra <strong>solo el administrador</strong> (dueño).
              El vendedor no registra gastos: solo vende. Si necesitas registrar un gasto, pídelo al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex items-center gap-3 border-b border-[#e7eeff] pb-6">
        <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
          <Receipt className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Gastos</h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            El dinero que sale: gastos del día y gastos fijos del negocio.
          </p>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <p
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-4 py-3 text-xs font-bold border ${
            feedbackMsg.type === 'error'
              ? 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/20'
              : 'bg-[#e2f9ee] text-[#00422b] border-[#00422b]/15'
          }`}
        >
          {feedbackMsg.text}
        </p>
      )}

      {/* Load error: real data or a real error — never fake data */}
      {loadError && (
        <div role="alert" className="bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-bold text-[#93000a]">No se pudieron cargar los gastos</h2>
            <p className="text-xs text-[#93000a]/80 font-medium mt-0.5">{loadError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Tabs: Del día | Fijos */}
      <div className="bg-[#f0f3ff] border border-[#cbd5e1] rounded-2xl p-1.5 grid grid-cols-2 gap-1.5" role="tablist" aria-label="Tipo de gastos">
        <button
          role="tab"
          aria-selected={tab === 'daily'}
          onClick={() => setTab('daily')}
          className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            tab === 'daily' ? 'bg-[#00357f] text-white shadow-sm' : 'text-[#434653] hover:bg-[#dee8ff]/60'
          }`}
        >
          Del día
        </button>
        <button
          role="tab"
          aria-selected={tab === 'fixed'}
          onClick={() => setTab('fixed')}
          className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            tab === 'fixed' ? 'bg-[#00357f] text-white shadow-sm' : 'text-[#434653] hover:bg-[#dee8ff]/60'
          }`}
        >
          Fijos
        </button>
      </div>

      {tab === 'daily' && (
        <section className="space-y-5">
          {/* Daily figures */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#737784]">
                <Wallet className="w-3.5 h-3.5 text-[#00357f]" />
                Hoy
              </p>
              <p className="text-xl md:text-2xl font-extrabold text-[#111c2d] mt-1">{formatMoney(todayTotal)}</p>
            </div>
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#737784]">
                <Wallet className="w-3.5 h-3.5 text-[#00357f]" />
                Este mes
              </p>
              <p className="text-xl md:text-2xl font-extrabold text-[#111c2d] mt-1">{formatMoney(monthTotal)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#111c2d]">Gastos recientes <span className="text-[#737784] font-semibold">(últimos 30 días)</span></h2>
            <button
              onClick={openCreateDaily}
              className="bg-[#00357f] hover:bg-[#004aad] text-white px-4 py-2.5 min-h-[44px] rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo gasto
            </button>
          </div>

          {dailyExpenses.length === 0 ? (
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm text-center space-y-3">
              <Receipt className="w-8 h-8 text-[#0899c9] mx-auto" />
              <p className="text-sm font-bold text-[#111c2d]">Sin gastos registrados</p>
              <p className="text-xs text-[#434653] font-medium">
                Todavía no hay gastos del día en los últimos 30 días. Registra el primero con el botón «Nuevo gasto».
              </p>
              <button
                onClick={openCreateDaily}
                className="bg-[#00357f] hover:bg-[#004aad] text-white px-4 py-2.5 min-h-[44px] rounded-xl inline-flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo gasto
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {dailyGroups.map(group => (
                <div key={group.date} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h3 className="text-xs font-black tracking-wider text-[#00357f]">{formatDayHeader(group.date)}</h3>
                    <span className="text-xs font-bold text-[#737784]">{formatMoney(group.subtotal)}</span>
                  </div>
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden divide-y divide-[#f0f3ff]">
                    {group.items.map(expense => (
                      <button
                        key={expense.id}
                        onClick={() => openEditDaily(expense)}
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left hover:bg-[#f0f3ff]/60 transition-colors cursor-pointer"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-[#111c2d] truncate">{expense.concept}</span>
                          {expense.notes && (
                            <span className="block text-xs text-[#737784] font-medium truncate mt-0.5">{expense.notes}</span>
                          )}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${CATEGORY_CHIP[expense.category] ?? CATEGORY_CHIP.Otro}`}>
                          {expense.category}
                        </span>
                        <span className="text-sm font-extrabold text-[#111c2d] shrink-0">{formatMoney(expense.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'fixed' && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#111c2d]">Gastos fijos del negocio</h2>
            <button
              onClick={openCreateFixed}
              className="bg-[#00357f] hover:bg-[#004aad] text-white px-4 py-2.5 min-h-[44px] rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo fijo
            </button>
          </div>

          {fixedExpenses.length === 0 ? (
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm text-center space-y-3">
              <Repeat className="w-8 h-8 text-[#0899c9] mx-auto" />
              <p className="text-sm font-bold text-[#111c2d]">Sin gastos registrados</p>
              <p className="text-xs text-[#434653] font-medium">
                Todavía no hay gastos fijos. Registra la renta, el agua o la electricidad con el botón «Nuevo fijo».
              </p>
              <button
                onClick={openCreateFixed}
                className="bg-[#00357f] hover:bg-[#004aad] text-white px-4 py-2.5 min-h-[44px] rounded-xl inline-flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo fijo
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden divide-y divide-[#f0f3ff]">
                {fixedExpenses.map(fixed => (
                  <div
                    key={fixed.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] transition-colors ${fixed.is_active ? '' : 'opacity-60'}`}
                  >
                    <button
                      onClick={() => openEditFixed(fixed)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-[#111c2d] truncate">{fixed.concept}</span>
                        <span className="block text-xs text-[#737784] font-medium mt-0.5">
                          {periodicityLabel(fixed.periodicity)} · ≈ {formatMoney(monthlyEquivalent(fixed))}/mes
                        </span>
                      </span>
                      <span className="text-base font-extrabold text-[#111c2d] shrink-0">{formatMoney(fixed.amount)}</span>
                    </button>
                    {renderToggle(
                      fixed.is_active,
                      () => handleToggleFixedActive(fixed),
                      fixed.is_active ? `Desactivar ${fixed.concept}` : `Activar ${fixed.concept}`,
                      busyFixedId === fixed.id,
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-[#dee8ff]/50 border border-[#cbd5e1] rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wider text-[#00357f]">Total fijo mensual equivalente</p>
                <p className="text-lg font-extrabold text-[#00357f]">{formatMoney(fixedMonthlyTotal)}</p>
              </div>
              <p className="text-[11px] text-[#737784] font-semibold px-1">
                Suma solo los gastos fijos activos, convertidos a mes (semanal ×52÷12, anual ÷12).
              </p>
            </>
          )}
        </section>
      )}

      {/* Daily Create / Edit Modal */}
      {dailyFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f3ff] sticky top-0 bg-white z-10">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">
                {editingDaily ? 'Editar gasto' : 'Nuevo gasto'}
              </h2>
              <button
                onClick={() => setDailyFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#f0f3ff] text-[#737784] transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {dailyFormError && (
                <p role="alert" className="rounded-lg px-3 py-2 text-[11px] font-bold bg-[#ffdad6] text-[#93000a]">
                  {dailyFormError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="daily-date" className="text-xs font-bold text-[#111c2d]">Fecha *</label>
                  <input
                    id="daily-date"
                    value={dailyForm.expense_date}
                    onChange={e => setDailyForm({ ...dailyForm, expense_date: e.target.value })}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="daily-amount" className="text-xs font-bold text-[#111c2d]">Monto *</label>
                  <input
                    id="daily-amount"
                    value={dailyForm.amount}
                    onChange={e => setDailyForm({ ...dailyForm, amount: e.target.value })}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="number"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="daily-concept" className="text-xs font-bold text-[#111c2d]">Concepto *</label>
                <input
                  id="daily-concept"
                  value={dailyForm.concept}
                  onChange={e => setDailyForm({ ...dailyForm, concept: e.target.value })}
                  placeholder="Ej. Cristales para armazones, jabón y fabuloso…"
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="text"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="daily-category" className="text-xs font-bold text-[#111c2d]">Categoría</label>
                <select
                  id="daily-category"
                  value={dailyForm.category}
                  onChange={e => setDailyForm({ ...dailyForm, category: e.target.value })}
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="daily-notes" className="text-xs font-bold text-[#111c2d]">Notas</label>
                <textarea
                  id="daily-notes"
                  value={dailyForm.notes}
                  onChange={e => setDailyForm({ ...dailyForm, notes: e.target.value })}
                  placeholder="Opcional: proveedor, folio, detalle…"
                  rows={2}
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDailyFormOpen(false)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDaily}
                  disabled={savingDaily}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#00357f] hover:bg-[#004aad] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingDaily ? 'Guardando…' : editingDaily ? 'Guardar cambios' : 'Registrar gasto'}
                </button>
              </div>
              {editingDaily && (
                <div className="border-t border-[#f0f3ff] pt-4">
                  {!confirmDeleteDaily ? (
                    <button
                      onClick={() => setConfirmDeleteDaily(true)}
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold hover:bg-[#f5c6c0] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#93000a] text-center">¿Eliminar este gasto? No se puede deshacer.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteDaily(false)}
                          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDeleteDaily}
                          disabled={deletingDaily}
                          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingDaily ? 'Eliminando…' : 'Sí, eliminar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Create / Edit Modal */}
      {fixedFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f3ff] sticky top-0 bg-white z-10">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">
                {editingFixed ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
              </h2>
              <button
                onClick={() => setFixedFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#f0f3ff] text-[#737784] transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {fixedFormError && (
                <p role="alert" className="rounded-lg px-3 py-2 text-[11px] font-bold bg-[#ffdad6] text-[#93000a]">
                  {fixedFormError}
                </p>
              )}
              <div className="space-y-1.5">
                <label htmlFor="fixed-concept" className="text-xs font-bold text-[#111c2d]">Concepto *</label>
                <input
                  id="fixed-concept"
                  value={fixedForm.concept}
                  onChange={e => setFixedForm({ ...fixedForm, concept: e.target.value })}
                  placeholder="Ej. Renta del local, agua, electricidad…"
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="text"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="fixed-amount" className="text-xs font-bold text-[#111c2d]">Monto *</label>
                  <input
                    id="fixed-amount"
                    value={fixedForm.amount}
                    onChange={e => setFixedForm({ ...fixedForm, amount: e.target.value })}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fixed-periodicity" className="text-xs font-bold text-[#111c2d]">Periodicidad</label>
                  <select
                    id="fixed-periodicity"
                    value={fixedForm.periodicity}
                    onChange={e => setFixedForm({ ...fixedForm, periodicity: e.target.value as Periodicity })}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>
              {Number(fixedForm.amount) > 0 && (
                <p className="text-[11px] text-[#737784] font-semibold -mt-1">
                  Equivale a ≈ {formatMoney(Number(fixedForm.amount) * PERIODICITY_META[fixedForm.periodicity].monthlyFactor)}/mes.
                </p>
              )}
              <div className="flex items-center justify-between p-3.5 bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl select-none">
                <div>
                  <span className="block text-xs font-bold text-[#111c2d]">Gasto fijo activo</span>
                  <span className="block text-[10px] text-[#737784] mt-0.5">Solo los activos cuentan en el total mensual equivalente.</span>
                </div>
                {renderToggle(
                  fixedForm.is_active,
                  () => setFixedForm({ ...fixedForm, is_active: !fixedForm.is_active }),
                  'Gasto fijo activo',
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setFixedFormOpen(false)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFixed}
                  disabled={savingFixed}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#00357f] hover:bg-[#004aad] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingFixed ? 'Guardando…' : editingFixed ? 'Guardar cambios' : 'Registrar fijo'}
                </button>
              </div>
              {editingFixed && (
                <div className="border-t border-[#f0f3ff] pt-4">
                  {!confirmDeleteFixed ? (
                    <button
                      onClick={() => setConfirmDeleteFixed(true)}
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold hover:bg-[#f5c6c0] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#93000a] text-center">¿Eliminar este gasto fijo? No se puede deshacer.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteFixed(false)}
                          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDeleteFixed}
                          disabled={deletingFixed}
                          className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingFixed ? 'Eliminando…' : 'Sí, eliminar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
