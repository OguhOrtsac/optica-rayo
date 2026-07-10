'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  searchCustomers, 
  getCustomerSales, 
  getCustomerInstallments 
} from '@/lib/services'
import { registerInstallmentPaymentAction } from '@/app/customers/actions'
import { 
  Search, 
  User, 
  CreditCard, 
  Calendar, 
  Check, 
  AlertTriangle, 
  ArrowLeft, 
  RefreshCw, 
  Coins, 
  DollarSign, 
  Wallet,
  Clock,
  CheckCircle2,
  Users
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

export default function PaymentsPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  // Details for selected customer
  const [sales, setSales] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Payment Form State
  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null)
  const [amountToPay, setAmountToPay] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load directory list
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

  // Debounced query search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, loadCustomers])

  // Fetch billing details
  const fetchBillingDetails = async (customerId: string) => {
    setLoadingDetails(true)
    setFeedback(null)
    setSelectedInstallment(null)
    try {
      const [salesData, installmentsData] = await Promise.all([
        getCustomerSales(customerId),
        getCustomerInstallments(customerId)
      ])
      // Filter sales with active pending balance
      setSales(salesData.filter((s: any) => (s.pending_balance ?? 0) > 0))
      setInstallments(installmentsData)
    } catch (err) {
      console.error('Error loading billing details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    fetchBillingDetails(customer.id)
  }

  // Next installment calculation
  const billingSummary = useMemo(() => {
    if (sales.length === 0) return null

    const pendingInstallments = installments
      .filter((i: any) => i.status === 'pending')
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    const nextInst = pendingInstallments[0] || null
    const totalDebt = sales.reduce((sum, s) => sum + Number(s.pending_balance || 0), 0)

    let isOverdue = false
    if (nextInst) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = new Date(nextInst.due_date)
      isOverdue = dueDate < today
    }

    return {
      nextInstallment: nextInst,
      totalDebt,
      isOverdue,
      pendingCount: pendingInstallments.length
    }
  }, [sales, installments])

  const handleSelectInstallment = (inst: any) => {
    setSelectedInstallment(inst)
    setAmountToPay(inst.amount.toString())
    setFeedback(null)
  }

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInstallment || !amountToPay || isSubmitting) return

    const paymentVal = parseFloat(amountToPay)
    if (isNaN(paymentVal) || paymentVal <= 0) {
      setFeedback({ type: 'error', text: 'Por favor introduce un monto de abono válido.' })
      return
    }

    try {
      setIsSubmitting(true)
      setFeedback(null)

      const result = await registerInstallmentPaymentAction(
        selectedInstallment.id,
        paymentVal,
        paymentMethod
      )

      if (result.error) {
        setFeedback({ type: 'error', text: result.error })
      } else {
        setFeedback({ type: 'success', text: result.success || '¡Abono registrado correctamente!' })
        setSelectedInstallment(null)
        // Refresh customer billing data
        if (selectedCustomer) {
          await fetchBillingDetails(selectedCustomer.id)
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al procesar el abono.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

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

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: Customer Search & List (4 Cols) */}
          <div className="lg:col-span-4 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 flex flex-col gap-4 h-[calc(100vh-12rem)] min-h-[400px] lg:max-h-[650px]">
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

            {/* Customers list scroll */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-[#cbd5e1]/40 divide-y divide-[#cbd5e1]/30">
              {customers.length === 0 && !loadingCustomers ? (
                <div className="py-12 text-center text-xs text-[#737784] font-semibold space-y-2">
                  <Users className="w-8 h-8 text-[#cbd5e1] mx-auto" />
                  <p>Sin resultados en el directorio.</p>
                </div>
              ) : (
                customers.map(c => {
                  const isSelected = selectedCustomer?.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                        isSelected 
                          ? 'bg-[#dee8ff]/60 border-l-4 border-l-[#00357f]' 
                          : 'bg-white hover:bg-[#f0f3ff] border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[#111c2d] truncate">{c.full_name}</p>
                        <p className="text-[10px] text-[#737784] truncate">
                          @{c.email?.replace('@opticarayo.com', '')}
                        </p>
                      </div>
                      <User className={`w-4 h-4 ${isSelected ? 'text-[#00357f]' : 'text-[#cbd5e1]'}`} />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* RIGHT: Billing Details and Register (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedCustomer ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-3 h-[250px] shadow-sm">
                <div className="w-12 h-12 bg-[#f0f3ff] rounded-full flex items-center justify-center text-[#00357f]/40">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-xs text-[#737784] font-bold">Selecciona un cliente del directorio para visualizar su adeudo.</p>
              </div>
            ) : loadingDetails ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl p-10 flex flex-col items-center justify-center h-[250px] shadow-sm">
                <div className="w-8 h-8 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#737784] font-medium mt-2">Cargando estado de cuenta...</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Billing Summary Box */}
                {billingSummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase text-[#737784] tracking-wider block">Deuda Total Pendiente</span>
                      <span className="text-2xl font-black text-[#ba1a1a]">{formatPrice(billingSummary.totalDebt)}</span>
                    </div>

                    <div className="space-y-1 border-t md:border-t-0 md:border-x border-[#cbd5e1]/40 pt-3 md:pt-0 md:px-4">
                      <span className="text-[8px] font-black uppercase text-[#737784] tracking-wider block">Próxima Cuota</span>
                      {billingSummary.nextInstallment ? (
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-[#00357f]">
                            {formatPrice(billingSummary.nextInstallment.amount)}
                          </span>
                          <span className={`block text-[10px] font-bold ${billingSummary.isOverdue ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
                            Vence: {formatDate(billingSummary.nextInstallment.due_date)}
                            {billingSummary.isOverdue && ' (Vencida)'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600">Al corriente</span>
                      )}
                    </div>

                    <div className="space-y-1 pt-3 md:pt-0 md:pl-4">
                      <span className="text-[8px] font-black uppercase text-[#737784] tracking-wider block">Estado de Cuenta</span>
                      <div className="flex items-center gap-1">
                        {billingSummary.isOverdue ? (
                          <span className="inline-flex items-center gap-1 bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" /> Pago Retrasado
                          </span>
                        ) : billingSummary.nextInstallment ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            <Clock className="w-3.5 h-3.5" /> Pago Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            <Check className="w-3.5 h-3.5" /> Liquidado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 text-center text-xs font-bold text-emerald-600 flex items-center justify-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" /> El cliente no tiene adeudos pendientes en este momento.
                  </div>
                )}

                {/* Sales with active debt & Installments table */}
                {sales.length > 0 && (
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-[#f9f9ff] border-b border-[#cbd5e1]/40 p-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Plan de Pagos y Abonos</h3>
                    </div>

                    <div className="p-4 space-y-6">
                      {sales.map((sale: any) => {
                        const saleInsts = installments.filter((inst: any) => inst.sale_id === sale.id)
                        return (
                          <div key={sale.id} className="space-y-3 border-b border-[#cbd5e1]/30 pb-4 last:border-0 last:pb-0">
                            <div className="flex flex-wrap justify-between items-center gap-2 bg-[#f0f3ff] p-3 rounded-xl text-xs font-medium">
                              <span className="font-bold text-[#00357f]">Orden #{sale.id.slice(0, 6).toUpperCase()}</span>
                              <span className="text-[#737784]">Total: {formatPrice(sale.total)}</span>
                              <span className="text-[#737784]">Abonado: {formatPrice(sale.paid_amount)}</span>
                              <span className="text-[#ba1a1a] font-bold">Resta: {formatPrice(sale.pending_balance)}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {saleInsts.map((inst: any) => {
                                const isPending = inst.status === 'pending'
                                const isSelectable = isPending && (!selectedInstallment || selectedInstallment.id === inst.id)
                                return (
                                  <div 
                                    key={inst.id} 
                                    className={`p-3 border rounded-xl flex items-center justify-between transition-all ${
                                      inst.status === 'paid' 
                                        ? 'border-emerald-200 bg-emerald-50/20 opacity-80' 
                                        : 'border-[#cbd5e1] bg-white hover:border-[#00357f]/60'
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <span className="block text-[10px] font-bold text-[#434653]">
                                        Pago #{inst.installment_number}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-extrabold text-[#111c2d]">{formatPrice(inst.amount)}</span>
                                        <span className={`text-[10px] ${isPending ? 'text-[#737784]' : 'text-emerald-700'}`}>
                                          {isPending ? `Vence: ${formatDate(inst.due_date)}` : `Pagado: ${formatDate(inst.payment_date)}`}
                                        </span>
                                      </div>
                                    </div>

                                    {isPending ? (
                                      <button
                                        onClick={() => handleSelectInstallment(inst)}
                                        className="text-[10px] font-black uppercase tracking-wider text-[#00357f] hover:underline cursor-pointer"
                                      >
                                        Abonar
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-0.5">
                                        <Check className="w-3.5 h-3.5" /> Pagado
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Form Modal to Register payment */}
                {selectedInstallment && (
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="flex justify-between items-center border-b border-[#cbd5e1]/40 pb-2">
                      <h4 className="font-extrabold text-xs text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" /> Registrar Abono de Cuota #{selectedInstallment.installment_number}
                      </h4>
                      <button 
                        onClick={() => setSelectedInstallment(null)}
                        className="text-[10px] text-[#737784] font-bold hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>

                    {feedback && (
                      <div className={`p-3 rounded-lg text-xs font-bold border ${
                        feedback.type === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                      }`}>
                        {feedback.text}
                      </div>
                    )}

                    <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-[#434653] uppercase mb-1">Monto a Pagar</label>
                        <div className="relative">
                          <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737784]" />
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={amountToPay}
                            onChange={e => setAmountToPay(e.target.value)}
                            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-8 pr-3 py-2 text-xs font-bold text-[#111c2d] outline-none focus:border-[#00357f]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#434653] uppercase mb-1">Método de Pago</label>
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value as any)}
                          className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#00357f]"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta Débito/Crédito</option>
                          <option value="transfer">Transferencia Bancaria</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2 bg-[#00357f] hover:bg-[#004aad] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Confirmar Pago
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
