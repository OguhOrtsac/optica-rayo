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
  ChevronRight
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

const isOverdueDate = (dueDate: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

export default function PaymentsPage() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loadingDebtors, setLoadingDebtors] = useState(false)

  // Cliente seleccionado: solo se muestra su tarjeta breve con el botón
  // a su ficha; el registro de abonos ya no vive en esta página.
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
          return {
            id,
            full_name: d.name,
            email: d.email,
            totalDebt: d.totalDebt,
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
    setSelectedCustomer(customer)
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
        const totalDebt = salesData.reduce((sum: number, s: any) => sum + Number(s.pending_balance || 0), 0)
        const pending = instsData
          .filter((i: any) => i.status === 'pending')
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
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

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

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
        className={`w-full flex items-center justify-between p-3 text-left transition-colors cursor-pointer ${
          isSelected
            ? 'bg-[#dee8ff]/60 border-l-4 border-l-[#00357f]'
            : 'bg-white hover:bg-[#f0f3ff] border-l-4 border-l-transparent'
        }`}
      >
        <div className="min-w-0">
          <p className="font-bold text-xs text-[#111c2d] truncate">{c.full_name}</p>
          {extra?.nextDue ? (
            <p className={`text-[10px] font-bold truncate ${extra.isOverdue ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
              Próximo vencimiento: {formatDate(extra.nextDue)}{extra.isOverdue ? ' (vencido)' : ''}
            </p>
          ) : (
            <p className="text-[10px] text-[#737784] truncate">
              @{c.email?.replace('@opticarayo.com', '')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {extra?.totalDebt !== undefined && (
            <span className="text-xs font-black text-[#ba1a1a] font-mono">{formatPrice(extra.totalDebt)}</span>
          )}
          <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#00357f]' : 'text-[#cbd5e1]'}`} />
        </div>
      </button>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] pt-4 pb-24 md:pb-8 text-left">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-[#e7eeff] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors md:hidden">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Registrar Pagos</h1>
            </div>
            <p className="text-sm text-[#434653] mt-1 font-medium">Control de abonos de lentes a plazos y actualización de saldos.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: buscador + deudores / resultados */}
          <div className="lg:col-span-4 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 flex flex-col gap-4 lg:max-h-[650px]">
            <span className="text-[10px] font-black uppercase text-[#00357f] tracking-wider">Buscar Cliente</span>
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
                <span className="text-[10px] font-black uppercase text-[#737784] tracking-wider">Resultados</span>
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#ba1a1a] tracking-wider">
                    Deudores{debtors.length > 0 ? ` (${debtors.length})` : ''}
                  </span>
                  {loadingDebtors && (
                    <span className="w-3.5 h-3.5 border-2 border-[#ba1a1a] border-t-transparent rounded-full animate-spin" />
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
                  Toca un deudor para ver su saldo y abrir su ficha de cobranza.
                </p>
              </>
            )}
          </div>

          {/* RIGHT: tarjeta breve del cliente seleccionado */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedCustomer ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-3 h-[250px] shadow-sm">
                <div className="w-12 h-12 bg-[#f0f3ff] rounded-full flex items-center justify-center text-[#00357f]/40">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-xs text-[#737784] font-bold">Selecciona un cliente para ver su saldo y abrir su ficha.</p>
              </div>
            ) : loadingSummary || !selectedSummary ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl p-10 flex flex-col items-center justify-center h-[250px] shadow-sm">
                <div className="w-8 h-8 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#737784] font-medium mt-2">Cargando estado de cuenta...</p>
              </div>
            ) : (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-[#737784] tracking-wider block">Cliente seleccionado</span>
                    <h2 className="text-lg font-black text-[#111c2d] truncate mt-1">{selectedCustomer.full_name}</h2>
                    <p className="text-[11px] text-[#737784] font-medium truncate">
                      @{selectedCustomer.email?.replace('@opticarayo.com', '')}
                    </p>
                  </div>
                  {selectedSummary.totalDebt > 0 ? (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> Con adeudo
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" /> Al corriente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4">
                    <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Saldo pendiente total</span>
                    <span className={`text-xl font-black font-mono block mt-1 ${selectedSummary.totalDebt > 0 ? 'text-[#ba1a1a]' : 'text-emerald-700'}`}>
                      {formatPrice(selectedSummary.totalDebt)}
                    </span>
                  </div>
                  <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4">
                    <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Cuotas pendientes</span>
                    <span className="text-xl font-black text-[#111c2d] block mt-1">
                      {selectedSummary.pendingCount}
                    </span>
                  </div>
                  <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4">
                    <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Próximo vencimiento</span>
                    {selectedSummary.nextDue ? (
                      <span className={`text-sm font-bold block mt-1 ${selectedSummary.isOverdue ? 'text-[#ba1a1a]' : 'text-[#00357f]'}`}>
                        {formatDate(selectedSummary.nextDue)}
                        {selectedSummary.isOverdue && ' (vencido)'}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-emerald-700 block mt-1">Sin vencimientos</span>
                    )}
                  </div>
                </div>

                {selectedSummary.totalDebt > 0 ? (
                  <p className="text-[11px] text-[#737784] font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    En su ficha verás el detalle por venta y cuota, y podrás registrar el abono ahí mismo.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Este cliente no tiene adeudos pendientes en este momento.
                  </p>
                )}

                <Link
                  href={`/customers/${selectedCustomer.id}#cobranza`}
                  className="w-full py-3 bg-[#00357f] hover:bg-[#004aad] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                >
                  Abrir ficha y registrar pago
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
