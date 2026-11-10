'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  searchCustomers,
  getSales,
  getCustomerSales,
  getCustomerInstallments
} from '@/lib/services'
import {
  Search,
  User,
  Wallet,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  Users,
  ChevronRight,
  X,
  Phone,
  MessageCircle
} from 'lucide-react'

type Customer = {
  id: string
  full_name: string
  email: string
  created_at: string
  customer_profiles: {
    phone?: string
    date_of_birth?: string
  } | null
}

type Debtor = {
  id: string
  full_name: string
  email: string
  totalDebt: number
  pendingCount: number
  nextDue: string | null
  isOverdue: boolean
}

type SelectedSummary = {
  totalDebt: number
  pendingCount: number
  nextDue: string | null
  isOverdue: boolean
}

// Due dates are calendar dates ('YYYY-MM-DD', or a midnight timestamp):
// they must be read as LOCAL dates. `new Date('2026-11-20')` is midnight
// UTC, which in Mexico renders and compares as November 19 — verified
// live in production (a quota due on the 20th showed as the 19th, and a
// quota due "today" could read as overdue).
const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const isOverdueDate = (dueDate: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parseLocalDate(dueDate) < today
}

export default function PaymentsPage() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loadingDebtors, setLoadingDebtors] = useState(false)

  // Cliente seleccionado: su estado de cuenta se muestra en el modal;
  // el registro de abonos vive en su ficha (pestaña Cobranza).
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedSummary, setSelectedSummary] = useState<SelectedSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Directorio (búsqueda)
  const loadCustomers = useCallback(async (q: string) => {
    setLoadingCustomers(true)
    try {
      const data = await searchCustomers(q)
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers('')
  }, [loadCustomers])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, loadCustomers])

  // Deudores: ventas con saldo pendiente, agrupadas por cliente, con el
  // próximo vencimiento tomado de sus cuotas pendientes.
  const loadDebtors = useCallback(async () => {
    setLoadingDebtors(true)
    try {
      const allSales = await getSales()
      const byCustomer = new Map<string, { name: string; email: string; totalDebt: number; saleIds: string[] }>()
      for (const s of allSales as any[]) {
        const pending = Number(s.pending_balance || 0)
        if (pending <= 0) continue
        const key = (s as any).customer_id || s.customer_name || ''
        const prev = byCustomer.get(key)
        if (prev) {
          prev.totalDebt += pending
          prev.saleIds.push(s.id)
        } else {
          byCustomer.set(key, {
            name: s.customer_name || 'Cliente',
            email: '',
            totalDebt: pending,
            saleIds: [s.id]
          })
        }
      }
      const entries = Array.from(byCustomer.entries())
      const withDue = await Promise.all(entries.map(async ([id, d]) => {
        let nextDue: string | null = null
        try {
          const insts = await getCustomerInstallments(id)
          const pending = insts
            .filter((i: any) => i.status === 'pending')
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          if (pending.length > 0) {
            nextDue = pending[0].due_date
          }
          const pendingCount = pending.length
          // Ground truth cross-check: what the installments say is owed
          // wins if the sales' stored balance drifted lower.
          const installmentsDebt = pending.reduce((sum: number, i: any) => sum + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)), 0)
          return {
            id,
            full_name: d.name,
            email: d.email,
            totalDebt: Math.max(d.totalDebt, installmentsDebt),
            pendingCount,
            nextDue,
            isOverdue: nextDue ? isOverdueDate(nextDue) : false
          } satisfies Debtor
        } catch {
          return {
            id,
            full_name: d.name,
            email: d.email,
            totalDebt: d.totalDebt,
            pendingCount: 0,
            nextDue,
            isOverdue: false
          } satisfies Debtor
        }
      }))
      withDue.sort((a, b) => b.totalDebt - a.totalDebt)
      setDebtors(withDue)
    } catch (err) {
      console.error('Error loading debtors:', err)
    } finally {
      setLoadingDebtors(false)
    }
  }, [])

  useEffect(() => {
    loadDebtors()
  }, [loadDebtors])

  // Resumen breve del cliente seleccionado (saldo + próximo vencimiento).
  const handleSelectCustomer = async (customer: Customer) => {
    // Las filas de deudores se construyen desde las ventas y llegan sin
    // correo ni teléfono; el directorio ya cargado en la página sí los
    // trae. Se completan SOLO los datos de despliegue del modal (el
    // cálculo del saldo, las cuotas y los vencimientos no se tocan).
    const full = customers.find(c => c.id === customer.id)
    const enrichedCustomer: Customer = full
      ? {
          ...customer,
          email: customer.email || full.email,
          customer_profiles: customer.customer_profiles ?? full.customer_profiles
        }
      : customer
    setSelectedCustomer(enrichedCustomer)
    setSelectedSummary(null)
    setLoadingSummary(true)
    try {
      const known = debtors.find(d => d.id === customer.id)
      if (known) {
        setSelectedSummary({
          totalDebt: known.totalDebt,
          pendingCount: known.pendingCount,
          nextDue: known.nextDue,
          isOverdue: known.isOverdue
        })
      } else {
        const [salesData, instsData] = await Promise.all([
          getCustomerSales(customer.id),
          getCustomerInstallments(customer.id)
        ])
        const salesDebt = salesData.reduce((sum: number, s: any) => sum + Number(s.pending_balance || 0), 0)
        const pending = instsData
          .filter((i: any) => i.status === 'pending')
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        // The installments are the ground truth of what is owed: if the
        // sales' stored balance ever drifts from them, the larger figure
        // is the honest one to show.
        const installmentsDebt = pending.reduce((sum: number, i: any) => sum + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)), 0)
        const totalDebt = Math.max(salesDebt, installmentsDebt)
        setSelectedSummary({
          totalDebt,
          pendingCount: pending.length,
          nextDue: pending.length > 0 ? pending[0].due_date : null,
          isOverdue: pending.length > 0 ? isOverdueDate(pending[0].due_date) : false
        })
      }
    } catch (err) {
      console.error('Error loading customer summary:', err)
    } finally {
      setLoadingSummary(false)
    }
  }

  // Cerrar el modal limpia la selección, con la misma semántica que
  // volver a la lista: sin cliente seleccionado no hay resumen abierto.
  const closeModal = useCallback(() => {
    setSelectedCustomer(null)
    setSelectedSummary(null)
    setLoadingSummary(false)
  }, [])

  // Escape cierra el modal y el fondo no se desplaza mientras está abierto.
  useEffect(() => {
    if (!selectedCustomer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [selectedCustomer, closeModal])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  // Teléfono del cliente seleccionado, listo para tel:/wa.me con código
  // de país (mismo formato que la ficha del cliente).
  const cleanPhone = (selectedCustomer?.customer_profiles?.phone || '').replace(/[^\d]/g, '')
  const phoneWithCode = cleanPhone ? (cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone) : ''

  // Semáforo del modal: la banda superior lleva el color del estado del
  // cliente (rojo si hay cuota vencida, ámbar si debe sin vencer, verde
  // si está al corriente y azul neutro mientras carga el resumen).
  const semaphore = loadingSummary || !selectedSummary
    ? { band: 'bg-[#dee8ff]', text: 'text-[#00357f]', label: 'Cargando estado de cuenta', Icon: Clock }
    : selectedSummary.isOverdue
      ? { band: 'bg-[#ffdad6]', text: 'text-[#ba1a1a]', label: 'Saldo vencido', Icon: AlertTriangle }
      : selectedSummary.totalDebt > 0
        ? { band: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'Con adeudo', Icon: Clock }
        : { band: 'bg-[#e2f9ee]', text: 'text-[#00422b]', label: 'Al corriente', Icon: CheckCircle2 }

  // Con búsqueda: resultados del directorio. Sin búsqueda: deudores primero.
  const directoryResults = useMemo(() => {
    if (!query.trim()) return []
    return customers
  }, [query, customers])

  const renderCustomerRow = (c: Customer, extra?: { totalDebt?: number; nextDue?: string | null; isOverdue?: boolean }) => {
    const isSelected = selectedCustomer?.id === c.id
    return (
      <button
        key={c.id}
        onClick={() => handleSelectCustomer(c)}
        className={`w-full flex items-center justify-between px-3 py-3 min-h-[48px] text-left transition-colors cursor-pointer ${
          isSelected
            ? 'bg-[#dee8ff]/60 border-l-4 border-l-[#00357f]'
            : 'bg-white hover:bg-[#f0f3ff] border-l-4 border-l-transparent'
        }`}
      >
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[#111c2d] truncate">{c.full_name}</p>
          {extra?.nextDue ? (
            <p className={`text-xs font-semibold truncate ${extra.isOverdue ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
              Próximo vencimiento: {formatDate(extra.nextDue)}{extra.isOverdue ? ' (vencido)' : ''}
            </p>
          ) : (
            <p className="text-xs text-[#737784] truncate">
              @{c.email?.replace('@opticarayo.com', '')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {extra?.totalDebt !== undefined && (
            <span className={`shrink-0 px-2 py-0.5 rounded-full font-mono text-xs font-black ${extra.isOverdue ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#fef3c7] text-[#92400e]'}`}>
              {formatPrice(extra.totalDebt)}
            </span>
          )}
          <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#00357f]' : 'text-[#cbd5e1]'}`} />
        </div>
      </button>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] pt-4 pb-24 md:pb-8 text-left">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-[#e7eeff] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors md:hidden">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl md:text-[28px] font-extrabold text-[#00357f] tracking-tight">Registrar Pagos</h1>
            </div>
            <p className="text-sm text-[#434653] mt-1 font-medium">Control de abonos de lentes a plazos y actualización de saldos.</p>
          </div>
        </div>

        {/* Directorio: tocar un deudor o un cliente buscado abre su
            estado de cuenta en el modal; ya no hay columna de resumen. */}
        <div className="max-w-2xl mx-auto w-full bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 flex flex-col gap-4 lg:max-h-[650px]">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                <Search className="w-5 h-5" />
              </span>
              <h2 className="text-base font-semibold text-[#111c2d]">Buscar cliente</h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
              <input
                type="text"
                placeholder="Escribe el nombre del cliente..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-10 pr-4 py-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
              />
              {loadingCustomers && (
                <span className="absolute inset-y-0 right-3 flex items-center">
                  <div className="w-3.5 h-3.5 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                </span>
              )}
            </div>

            {query.trim() ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-semibold text-[#111c2d]">Resultados</h3>
                  {directoryResults.length > 0 && (
                    <span className="ml-auto shrink-0 bg-[#dee8ff] text-[#00357f] text-xs font-bold px-2.5 py-1 rounded-full">
                      {directoryResults.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-[#cbd5e1]/40 divide-y divide-[#cbd5e1]/30 min-h-[200px]">
                  {directoryResults.length === 0 && !loadingCustomers ? (
                    <div className="py-12 text-center text-xs text-[#737784] font-semibold space-y-2">
                      <Users className="w-8 h-8 text-[#cbd5e1] mx-auto" />
                      <p>Sin resultados en el directorio.</p>
                    </div>
                  ) : (
                    directoryResults.map(c => renderCustomerRow(c))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-semibold text-[#111c2d]">Deudores</h3>
                  {debtors.length > 0 && (
                    <span className="shrink-0 bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold px-2.5 py-1 rounded-full">
                      {debtors.length}
                    </span>
                  )}
                  {loadingDebtors && (
                    <span className="ml-auto w-3.5 h-3.5 border-2 border-[#ba1a1a] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-[#cbd5e1]/40 divide-y divide-[#cbd5e1]/30 min-h-[200px]">
                  {debtors.length === 0 && !loadingDebtors ? (
                    <div className="py-12 text-center text-xs text-[#737784] font-semibold space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p>Sin adeudos pendientes hoy.</p>
                    </div>
                  ) : (
                    debtors.map(d => renderCustomerRow(
                      { id: d.id, full_name: d.full_name, email: d.email, created_at: '', customer_profiles: null },
                      { totalDebt: d.totalDebt, nextDue: d.nextDue, isOverdue: d.isOverdue }
                    ))
                  )}
                </div>
                <p className="text-[10px] text-[#737784] font-medium">
                  Toca un deudor para ver su saldo y registrar su abono.
                </p>
              </>
            )}
          </div>

      </div>
      {/* MODAL: estado de cuenta del cliente seleccionado. Todo lo que
          antes vivía en la columna de resumen vive ahora aquí dentro;
          la página detrás conserva la lista tal cual. */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Estado de cuenta de ${selectedCustomer.full_name}`}
        >
          <div className="fixed inset-0 bg-[#111c2d]/55 backdrop-blur-[2px]" />
          <div
            className="relative flex min-h-full items-start sm:items-center justify-center p-4"
            onClick={closeModal}
          >
            <div
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Banda semáforo: el color del estado del cliente */}
              <div className={`${semaphore.band} px-5 py-4 flex items-center justify-between gap-3`}>
                <span className={`inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider ${semaphore.text}`}>
                  <semaphore.Icon className="w-5 h-5 shrink-0" />
                  {semaphore.label}
                </span>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className={`p-2 rounded-full hover:bg-white/60 transition-colors cursor-pointer ${semaphore.text}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#00357f] block">Cliente seleccionado</span>
                  <h2 className="text-xl font-bold text-[#111c2d] truncate mt-1">{selectedCustomer.full_name}</h2>
                  <p className="text-[11px] text-[#737784] font-medium truncate">
                    @{selectedCustomer.email?.replace('@opticarayo.com', '')}
                  </p>
                  {selectedCustomer.customer_profiles?.phone && (
                    <p className="text-xs text-[#434653] font-semibold mt-0.5">{selectedCustomer.customer_profiles.phone}</p>
                  )}
                </div>

                {loadingSummary || !selectedSummary ? (
                  <div className="py-10 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[#737784] font-medium mt-2">Cargando estado de cuenta...</p>
                  </div>
                ) : (
                  <>
                    <div className={`border rounded-xl p-4 ${selectedSummary.totalDebt > 0 ? 'bg-[#ffdad6]/60 border-[#ba1a1a]/15' : 'bg-[#e2f9ee] border-[#00422b]/10'}`}>
                      <span className="text-xs font-semibold text-[#434653] block">Saldo pendiente total</span>
                      <span className={`text-3xl font-black font-mono block mt-1 ${selectedSummary.totalDebt > 0 ? 'text-[#ba1a1a]' : 'text-[#00422b]'}`}>
                        {formatPrice(selectedSummary.totalDebt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#f0f3ff]/70 border border-[#cbd5e1]/40 rounded-xl p-4">
                        <span className="text-xs font-semibold text-[#434653] block">Cuotas pendientes</span>
                        <span className="text-xl font-bold text-[#111c2d] block mt-1">
                          {selectedSummary.pendingCount}
                        </span>
                      </div>
                      <div className="bg-[#f0f3ff]/70 border border-[#cbd5e1]/40 rounded-xl p-4">
                        <span className="text-xs font-semibold text-[#434653] block">Próximo vencimiento</span>
                        {selectedSummary.nextDue ? (
                          <span className={`text-sm font-bold block mt-1 ${selectedSummary.isOverdue ? 'text-[#ba1a1a]' : 'text-[#00357f]'}`}>
                            {formatDate(selectedSummary.nextDue)}
                            {selectedSummary.isOverdue && ' (vencido)'}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-[#00422b] block mt-1">Sin vencimientos</span>
                        )}
                      </div>
                    </div>

                    {selectedSummary.totalDebt > 0 ? (
                      <p className="text-[11px] text-[#737784] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        En su ficha verás el detalle por venta y cuota, y podrás registrar el abono ahí mismo.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#00422b] font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Este cliente no tiene adeudos pendientes en este momento.
                      </p>
                    )}

                    {phoneWithCode && (
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={`tel:+${phoneWithCode}`}
                          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#00357f]/30 text-[#00357f] text-sm font-bold transition-all active:scale-[0.98]"
                        >
                          <Phone className="w-4 h-4" /> Llamar
                        </a>
                        <a
                          href={`https://wa.me/${phoneWithCode}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#00422b]/30 text-[#00422b] text-sm font-bold transition-all active:scale-[0.98]"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                      </div>
                    )}

                    <div className="space-y-3">
                      {selectedSummary.totalDebt > 0 && (
                        <Link
                          href={`/customers/${selectedCustomer.id}#cobranza`}
                          className="w-full py-3 bg-[#15803d] hover:bg-[#166534] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                        >
                          <Wallet className="w-4 h-4" />
                          Registrar abono
                        </Link>
                      )}
                      <Link
                        href={`/customers/${selectedCustomer.id}`}
                        className="w-full py-3 bg-[#00357f] hover:bg-[#004aad] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                      >
                        Ir a perfil
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="w-full py-3 bg-[#ffdad6] hover:bg-[#ffc9c4] text-[#ba1a1a] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        Cerrar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
