'use client'

import * as React from 'react'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getCustomerSales, getCustomerInstallments, getReminderConfig, type ReminderConfig } from '@/lib/services'
import { registerInstallmentPaymentAction } from '@/app/customers/actions'
import { buildReminderMessage } from '@/lib/reminder-config'
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Phone, 
  Calendar, 
  Briefcase, 
  HeartHandshake, 
  Eye, 
  ShoppingBag,
  AlertTriangle,
  PlusCircle,
  TrendingDown,
  Wallet,
  CreditCard,
  DollarSign,
  Check,
  RefreshCw
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

// Formulario en línea de abono para UNA cuota pendiente de la pestaña
// Cobranza. Usa EXACTAMENTE la misma acción que la página de pagos
// (registerInstallmentPaymentAction): monto + método, y al terminar el
// padre recarga los datos de dinero.
function InstallmentPayForm({ installment, formatPrice, onDone }: {
  installment: any
  formatPrice: (n: number) => string
  onDone: () => void
}) {
  const saldo = Math.max(Number(installment.amount || 0) - Number(installment.amount_paid || 0), 0)
  const [amount, setAmount] = useState<string>(saldo ? saldo.toString() : '')
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) {
      setFeedback({ type: 'error', text: 'Introduce un monto de abono válido.' })
      return
    }
    try {
      setSubmitting(true)
      setFeedback(null)
      const result = await registerInstallmentPaymentAction(installment.id, val, method)
      if (result.error) {
        setFeedback({ type: 'error', text: result.error })
      } else {
        setFeedback({ type: 'success', text: result.success || '¡Abono registrado correctamente!' })
        onDone()
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al procesar el abono.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2.5 border-t border-[#cbd5e1]/40 pt-2.5">
      {feedback && (
        <div className={`mb-2 p-2 rounded-lg text-[11px] font-bold border ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
        }`}>
          {feedback.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[110px]">
          <label className="block text-[9px] font-bold text-[#434653] uppercase mb-1">
            Registrar abono (saldo {formatPrice(saldo)})
          </label>
          <div className="relative">
            <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737784]" />
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-8 pr-2 py-2 text-xs font-bold text-[#111c2d] outline-none focus:border-[#00357f]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-bold text-[#434653] uppercase mb-1">Método</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value as any)}
            className="bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#00357f]"
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-3.5 bg-[#00357f] hover:bg-[#004aad] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
        >
          {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Confirmar
        </button>
      </form>
    </div>
  )
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id: customerId } = React.use(params)

  const [customer, setCustomer] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'exams' | 'sales' | 'billing'>('profile')
  const [reminderCfg, setReminderCfg] = useState<ReminderConfig | null>(null)

  useEffect(() => {
    getReminderConfig().then(setReminderCfg).catch(() => setReminderCfg(null))
  }, [])

  // El ancla #cobranza (p. ej. desde la página de pagos) abre la ficha
  // directamente en la pestaña de Cobranza.
  useEffect(() => {
    if (window.location.hash === '#cobranza') {
      setActiveTab('billing')
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [custData, examsData, salesData, installmentsData] = await Promise.all([
        getCustomerById(customerId),
        getCustomerExams(customerId),
        getCustomerSales(customerId),
        getCustomerInstallments(customerId),
      ])

      if (!custData) {
        setError('El cliente no fue encontrado o no existe.')
      } else {
        setCustomer(custData)
        setExams(examsData)
        setSales(salesData)
        setInstallments(installmentsData)
      }
    } catch (err: any) {
      setError(`Error al cargar los datos: ${err.message || 'Error inesperado.'}`)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Recarga solo datos de dinero tras registrar un abono.
  const reloadBilling = useCallback(async () => {
    try {
      const [salesData, installmentsData] = await Promise.all([
        getCustomerSales(customerId),
        getCustomerInstallments(customerId),
      ])
      setSales(salesData)
      setInstallments(installmentsData)
    } catch {
      // Si la recarga falla, la recarga completa sigue disponible.
    }
  }, [customerId])

  const getInitials = (name: string) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'P'

  const calculateAge = (dob: string) => {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  // Calendar dates ('YYYY-MM-DD' or midnight timestamps) are read as
  // LOCAL dates: new Date('2026-11-20') is midnight UTC and renders as
  // November 19 in Mexico — verified live with a quota due on the 20th.
  // Real timestamps keep their instant.
  const parseLocalDate = (dateStr: string) => {
    const isCalendarDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) || /T00:00:00/.test(dateStr)
    if (!isCalendarDate) return new Date(dateStr)
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return parseLocalDate(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatExamValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '--'
    const num = typeof val === 'number' ? val : parseFloat(val)
    if (isNaN(num)) return '--'
    return (num >= 0 ? '+' : '') + num.toFixed(2)
  }

  const formatAddValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '--'
    const num = typeof val === 'number' ? val : parseFloat(val)
    if (isNaN(num)) return '--'
    return `+${num.toFixed(2)}`
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Cambio entre dos valores de receta (actual − anterior): '=' cuando no
  // hubo cambio, '--' cuando alguno de los dos no existe.
  const formatDelta = (current: any, previous: any) => {
    const parse = (v: any) => (v === null || v === undefined || v === '' ? NaN : parseFloat(v))
    const c = parse(current)
    const p = parse(previous)
    if (isNaN(c) || isNaN(p)) return '--'
    const d = Math.round((c - p) * 100) / 100
    if (d === 0) return '='
    return formatExamValue(d)
  }

  // Suma de partidas de una venta (producto + micas + tratamientos, por
  // cantidad) para verificar en pantalla que el desglose cuadra con el
  // total cobrado (antes del descuento cuando lo hubo).
  const saleBreakdown = (sale: any) => {
    const items = sale.sale_items || []
    const sum = items.reduce((acc: number, it: any) => {
      const treatments = (it.sale_item_treatments || []).reduce(
        (a: number, t: any) => a + Number(t.price || 0), 0)
      return acc + Number(it.quantity || 0) * (Number(it.price || 0) + Number(it.lens_material_price || 0) + treatments)
    }, 0)
    const hasComponents = items.some((it: any) =>
      Number(it.lens_material_price || 0) > 0 || (it.sale_item_treatments || []).length > 0)
    return { sum, hasComponents }
  }



  if (loading) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando expediente del cliente...</p>
      </main>
    )
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-[#ba1a1a]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#111c2d]">{error || 'Expediente no disponible'}</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-[#00357f] hover:underline">
            Volver a la lista de clientes
          </Link>
        </div>
      </main>
    )
  }

  const cp = customer.customer_profiles || {}
  const age = calculateAge(cp.date_of_birth)

  // Calculations for total debt
  const totalPending = sales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)

  // Resumen de cobranza: saldo pendiente según las cuotas (saldo por cuota =
  // monto − abonado), cuántas ventas lo reparten y el próximo vencimiento.
  // Si no hubiera cuotas pero la venta marcara saldo, manda el total de ventas.
  const billing = (() => {
    const pending = installments
      .filter((i: any) => i.status === 'pending')
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    const fromInstallments = pending.reduce(
      (acc: number, i: any) => acc + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0)
    const salesWithInstallments = sales.filter((s: any) => installments.some((i: any) => i.sale_id === s.id))
    const salesWithPending = new Set(pending.map((i: any) => i.sale_id))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next = pending[0] || null
    return {
      pending,
      pendingTotal: installments.length > 0 ? fromInstallments : totalPending,
      pendingCount: pending.length,
      pendingSalesCount: salesWithPending.size,
      salesWithInstallments,
      nextDue: next ? next.due_date : null,
      nextOverdue: next ? parseLocalDate(next.due_date) < today : false,
    }
  })()

  // Comparativa de graduación: examen más reciente vs el anterior
  // (getCustomerExams devuelve la lista del más nuevo al más viejo).
  const examComparison = (() => {
    if (exams.length < 2) return null
    const actual = exams[0]
    const anterior = exams[1]
    const hasAdd = (e: any, key: string) => e[key] !== null && e[key] !== undefined && e[key] !== ''
    const rows = [
      { label: 'OD · Esfera', ant: formatExamValue(anterior.od_sphere), act: formatExamValue(actual.od_sphere), delta: formatDelta(actual.od_sphere, anterior.od_sphere) },
      { label: 'OD · Cilindro', ant: formatExamValue(anterior.od_cylinder), act: formatExamValue(actual.od_cylinder), delta: formatDelta(actual.od_cylinder, anterior.od_cylinder) },
      { label: 'OI · Esfera', ant: formatExamValue(anterior.oi_sphere), act: formatExamValue(actual.oi_sphere), delta: formatDelta(actual.oi_sphere, anterior.oi_sphere) },
      { label: 'OI · Cilindro', ant: formatExamValue(anterior.oi_cylinder), act: formatExamValue(actual.oi_cylinder), delta: formatDelta(actual.oi_cylinder, anterior.oi_cylinder) },
    ]
    if (hasAdd(actual, 'od_add') || hasAdd(anterior, 'od_add')) {
      rows.push({ label: 'OD · Adición', ant: formatAddValue(anterior.od_add), act: formatAddValue(actual.od_add), delta: formatDelta(actual.od_add, anterior.od_add) })
    }
    if (hasAdd(actual, 'oi_add') || hasAdd(anterior, 'oi_add')) {
      rows.push({ label: 'OI · Adición', ant: formatAddValue(anterior.oi_add), act: formatAddValue(actual.oi_add), delta: formatDelta(actual.oi_add, anterior.oi_add) })
    }
    return { actual, anterior, rows }
  })()

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Back and Header */}
      <div className="space-y-4">
        <Link href="/dashboard/admin/customers" className="inline-flex items-center gap-2 text-xs font-bold text-[#737784] hover:text-[#00357f] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Clientes
        </Link>

        {/* Customer Profile Header Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-[#dee8ff] text-[#00357f] rounded-full flex items-center justify-center font-black text-xl select-none">
            {getInitials(customer.full_name)}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
            <h1 className="text-2xl font-black text-[#111c2d] leading-none">{customer.full_name}</h1>
            <p className="text-xs text-[#737784] font-medium">
              @{customer.email?.replace('@opticarayo.com', '')}
              {age !== null && ` · ${age} años`}
              {cp.occupation && ` · ${cp.occupation}`}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {cp.blood_type && cp.blood_type !== 'NS' && (
                <span className="bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#ffdad6]">
                  Tipo: {cp.blood_type}
                </span>
              )}
              <span className="bg-[#dee8ff]/60 text-[#00357f] text-[10px] font-bold px-2 py-0.5 rounded">
                Alta: {new Date(customer.created_at).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
              </span>
              {totalPending > 0 && (
                <span className="bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                  Saldo pendiente: {formatPrice(totalPending)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#cbd5e1] bg-white rounded-t-xl overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 min-w-[92px] whitespace-nowrap py-3.5 px-1 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <User className="w-4 h-4" />
          Expediente
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex-1 min-w-[92px] whitespace-nowrap py-3.5 px-1 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'exams'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <Eye className="w-4 h-4" />
          Historial Clínico
          {exams.length > 0 && (
            <span className="ml-1 bg-[#dee8ff] text-[#00357f] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {exams.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 min-w-[92px] whitespace-nowrap py-3.5 px-1 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'sales'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Ventas y Compras
          {sales.length > 0 && (
            <span className="ml-1 bg-[#dee8ff] text-[#00357f] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {sales.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex-1 min-w-[92px] whitespace-nowrap py-3.5 px-1 text-xs font-bold transition-all border-b-2 text-center flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'billing'
              ? 'border-[#00357f] text-[#00357f] bg-[#dee8ff]/20'
              : 'border-transparent text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cobranza
          {billing.pendingCount > 0 && (
            <span className="ml-1 bg-[#ffdad6] text-[#ba1a1a] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {billing.pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="flex justify-between items-center border-b border-[#f0f3ff] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Datos Generales</h3>
                <span className="text-[10px] bg-[#49da9f]/20 text-[#00422b] px-2 py-0.5 rounded font-black uppercase">
                  CRM Activo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Teléfono</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.phone || 'No registrado'}</span>
                </div>
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Fecha de Nacimiento</span>
                  <span className="text-sm font-bold text-[#111c2d]">{formatDate(cp.date_of_birth)}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Dirección</span>
                  <span className="text-sm font-bold text-[#111c2d] leading-normal">{cp.address || 'No registrada'}</span>
                </div>
              </div>

              {/* WHATSAPP CRM BUTTONS */}
              {cp.phone && (
                <div className="border-t border-[#f0f3ff] pt-5 space-y-3">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#737784]">
                    Automatización de Recordatorios por WhatsApp
                  </span>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Recordatorio de Cita */}
                    <button
                      onClick={() => {
                        const cleanPhone = cp.phone.replace(/[^\d]/g, '')
                        const phoneWithCode = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
                        const message = reminderCfg
                          ? buildReminderMessage(reminderCfg.template, {
                              nombre: customer.full_name.split(' ')[0] || customer.full_name,
                              meses: reminderCfg.months,
                            })
                          : `Hola ${customer.full_name}, te saludamos de Óptica Rayo. Te invitamos a realizarte un nuevo examen de la vista: recuerda que el examen es GRATIS. ¿Te agendamos una cita? ¡Esperamos verte pronto!`
                        window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                      }}
                      type="button"
                      className="flex-1 bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113] font-bold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Phone className="w-4 h-4" />
                      Enviar Recordatorio de Examen
                    </button>

                    {/* Recordatorio de Cobranza */}
                    {totalPending > 0 && (
                      <button
                        onClick={() => {
                          const cleanPhone = cp.phone.replace(/[^\d]/g, '')
                          const phoneWithCode = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
                          const message = `Hola ${customer.full_name}, te saludamos de Óptica Rayo. Te recordamos cordialmente que cuentas con un saldo pendiente de ${formatPrice(totalPending)} MXN de tu compra. Puedes pasar a liquidarlo a sucursal o realizar una transferencia bancaria. ¡Muchas gracias por tu preferencia!`
                          window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                        }}
                        type="button"
                        className="flex-1 bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] font-bold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 border border-[#ba1a1a]/25"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Cobranza de Saldo ({formatPrice(totalPending)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Antecedentes clínicos */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Antecedentes Médicos</h3>
              <p className="text-xs text-[#434653] leading-relaxed bg-[#f9f9ff] p-4 rounded-xl border border-[#cbd5e1]/40 min-h-[60px] font-medium">
                {cp.medical_notes || 'Sin observaciones o condiciones registradas.'}
              </p>
            </div>

            {/* Contacto de Emergencia */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Contacto de Emergencia</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Nombre del Contacto</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.emergency_contact_name || 'No registrado'}</span>
                </div>
                <div>
                  <span className="block text-[#737784] uppercase font-bold tracking-wider mb-1">Teléfono</span>
                  <span className="text-sm font-bold text-[#111c2d]">{cp.emergency_contact_phone || 'No registrado'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EXAMS */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737784]">Exámenes del Cliente</h3>
              <Link
                href={`/customers/${customerId}/exam/new`}
                className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4.5 h-4.5" /> Nuevo Examen Clínico
              </Link>
            </div>

            {exams.length === 0 ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl py-12 text-center space-y-3 shadow-sm p-6">
                <p className="text-xs text-[#737784] font-semibold">Este cliente no tiene historial de exámenes aún.</p>
                <Link href={`/customers/${customerId}/exam/new`} className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                  Realizar primer examen visual →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Comparativa: examen anterior vs actual */}
                {examComparison && (
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-[#f9f9ff] border-b border-[#cbd5e1] px-6 py-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#00357f]">
                        Comparativa de Graduación
                      </span>
                      <h4 className="text-xs font-bold text-[#111c2d]">
                        Examen anterior vs actual
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[#737784] border-b border-[#cbd5e1]/40">
                            <th className="px-6 py-3 font-bold uppercase text-[9px] tracking-wider">Concepto</th>
                            <th className="px-3 py-3 font-bold uppercase text-[9px] tracking-wider">Anterior ({formatDate(examComparison.anterior.exam_date)})</th>
                            <th className="px-3 py-3 font-bold uppercase text-[9px] tracking-wider">Actual ({formatDate(examComparison.actual.exam_date)})</th>
                            <th className="px-6 py-3 font-bold uppercase text-[9px] tracking-wider text-right">Cambio (Δ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examComparison.rows.map(row => (
                            <tr key={row.label} className="border-b border-[#cbd5e1]/20 last:border-0">
                              <td className="px-6 py-2.5 font-bold text-[#111c2d]">{row.label}</td>
                              <td className="px-3 py-2.5 font-mono text-[#434653]">{row.ant}</td>
                              <td className="px-3 py-2.5 font-mono font-bold text-[#00357f]">{row.act}</td>
                              <td className="px-6 py-2.5 font-mono font-bold text-right text-[#111c2d]">{row.delta}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {exams.map((exam, i) => (
                  <div key={exam.id} className="bg-white border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-sm">
                    {/* Header del examen */}
                    <div className="bg-[#f9f9ff] border-b border-[#cbd5e1] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#00357f]">
                          Examen #{exams.length - i}
                        </span>
                        <h4 className="text-xs font-bold text-[#111c2d]">
                          {formatDate(exam.exam_date)}
                        </h4>
                      </div>
                      <span className="text-[10px] text-[#737784] font-bold">
                        Optometrista: <strong className="text-[#111c2d]">{exam.examiner?.full_name || 'Staff Óptica'}</strong>
                      </span>
                    </div>

                    {/* Receta Grid */}
                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Ojo Derecho */}
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00357f]" />
                            Ojo Derecho (OD)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-[#00357f]">{formatExamValue(exam.od_sphere)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-[#00357f]">{formatExamValue(exam.od_cylinder)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-[#00357f]">{exam.od_axis !== null ? `${exam.od_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-[11px] text-[#434653] font-medium">
                            <span>Adición: <strong className="font-mono text-[#00357f]">{formatAddValue(exam.od_add)}</strong></span>
                            <span>Agudeza: <strong className="text-[#111c2d]">{exam.od_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>

                        {/* Ojo Izquierdo */}
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-[#00668a] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00668a]" />
                            Ojo Izquierdo (OI)
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Esfera</span>
                              <span className="font-mono font-bold text-[#00668a]">{formatExamValue(exam.oi_sphere)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Cilindro</span>
                              <span className="font-mono font-bold text-[#00668a]">{formatExamValue(exam.oi_cylinder)}</span>
                            </div>
                            <div className="bg-white border border-[#cbd5e1]/40 p-2 rounded-lg">
                              <span className="block text-[8px] text-[#737784] font-bold uppercase">Eje</span>
                              <span className="font-mono font-bold text-[#00668a]">{exam.oi_axis !== null ? `${exam.oi_axis}°` : '--'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-[11px] text-[#434653] font-medium">
                            <span>Adición: <strong className="font-mono text-[#00668a]">{formatAddValue(exam.oi_add)}</strong></span>
                            <span>Agudeza: <strong className="text-[#111c2d]">{exam.oi_visual_acuity || 'N/A'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Datos Ópticos Adicionales */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Distancia Pupilar</span>
                          <span className="text-xs font-bold text-[#111c2d]">
                            {exam.pd_distance ? `${exam.pd_distance} mm` : '--'} / {exam.pd_near ? `${exam.pd_near} mm` : '--'}
                          </span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Tipo Lente</span>
                          <span className="text-xs font-bold text-[#111c2d] capitalize">{exam.lens_type || 'No especificado'}</span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Tratamiento</span>
                          <span className="text-xs font-bold text-[#111c2d] truncate block">{exam.treatment || 'Ninguno'}</span>
                        </div>
                        <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
                          <span className="block text-[8px] text-[#737784] uppercase font-bold tracking-wider">Próxima Cita</span>
                          <span className="text-xs font-bold text-[#111c2d]">{exam.next_exam_date ? new Date(exam.next_exam_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Recomendación de Armazón & Notas Clínicas */}
                      {(exam.frame_recommendation || exam.clinical_notes) && (
                        <div className="border-t border-[#cbd5e1]/40 pt-4 space-y-3 text-left">
                          {exam.frame_recommendation && (
                            <div className="text-xs bg-[#dee8ff]/50 border border-[#cbd5e1] p-3 rounded-xl">
                              <span className="font-bold text-[#00357f] block mb-0.5">Armazón Recomendado:</span>
                              <span className="text-[#434653] font-medium">{exam.frame_recommendation}</span>
                            </div>
                          )}
                          {exam.clinical_notes && (
                            <div className="text-xs bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3 rounded-xl">
                              <span className="font-bold text-[#737784] block mb-0.5">Observaciones Clínicas:</span>
                              <span className="text-[#434653] leading-relaxed block font-medium">{exam.clinical_notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SALES */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737784]">Historial de Compras</h3>
              <Link
                href={`/customers/${customerId}/sale/new`}
                className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4.5 h-4.5" /> Registrar Nueva Venta
              </Link>
            </div>

            {sales.length === 0 ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl py-12 text-center space-y-3 shadow-sm p-6">
                <p className="text-xs text-[#737784] font-semibold">Este cliente no registra transacciones de compra.</p>
                <Link href={`/customers/${customerId}/sale/new`} className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                  Registrar venta nueva →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div key={sale.id} className="bg-white border border-[#cbd5e1] rounded-2xl p-5 space-y-4 shadow-sm">
                    {/* Cabecera venta */}
                    <div className="flex justify-between items-start border-b border-[#cbd5e1]/40 pb-3">
                      <div>
                        <span className="text-[9px] text-[#737784] block uppercase font-bold">Venta registrada</span>
                        <span className="text-xs font-bold text-[#111c2d]">{formatDate(sale.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#737784] block uppercase font-bold">Total cobrado</span>
                        <span className="text-sm font-black text-[#00357f] font-mono">{formatPrice(sale.total)}</span>
                      </div>
                    </div>

                    {/* Items de la venta (con desglose de micas y tratamientos) */}
                    <div className="space-y-2 text-left">
                      <span className="text-[9px] font-black text-[#737784] uppercase tracking-wider block">Productos</span>
                      <div className="space-y-1.5">
                        {sale.sale_items?.map((item: any, idx: number) => {
                          const treatments = item.sale_item_treatments || []
                          const materialPrice = Number(item.lens_material_price || 0)
                          const showMaterial = !!item.lens_material?.name && materialPrice > 0
                          return (
                            <div key={idx} className="text-xs bg-[#f9f9ff] px-3.5 py-2.5 rounded-xl border border-[#cbd5e1]/40 space-y-1.5">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-[#111c2d]">{item.product?.name || 'Producto'}</span>
                                  <span className="text-[9px] text-[#737784] ml-2 font-bold uppercase">({item.product?.category === 'frames' ? 'Armazón' : item.product?.category === 'lenses' ? 'Micas' : item.product?.category === 'contact_lenses' ? 'Contacto' : 'Accesorio'})</span>
                                </div>
                                <span className="text-[#434653] font-medium">
                                  {item.quantity} x <strong className="font-mono text-[#00357f]">{formatPrice(item.price)}</strong>
                                </span>
                              </div>
                              {(showMaterial || treatments.length > 0) && (
                                <div className="border-t border-[#cbd5e1]/40 pt-1.5 space-y-1">
                                  {showMaterial && (
                                    <div className="flex justify-between items-center text-[11px] pl-3">
                                      <span className="text-[#434653] font-medium">Micas: <strong className="text-[#111c2d]">{item.lens_material.name}</strong></span>
                                      <span className="font-mono text-[#434653]">
                                        {item.quantity > 1 ? `${item.quantity} x ${formatPrice(materialPrice)} = ` : ''}{formatPrice(materialPrice * item.quantity)}
                                      </span>
                                    </div>
                                  )}
                                  {treatments.map((t: any, ti: number) => (
                                    <div key={ti} className="flex justify-between items-center text-[11px] pl-3">
                                      <span className="text-[#434653] font-medium">Tratamiento: <strong className="text-[#111c2d]">{t.treatment?.name || 'Tratamiento'}</strong></span>
                                      <span className="font-mono text-[#434653]">
                                        {item.quantity > 1 ? `${item.quantity} x ${formatPrice(Number(t.price || 0))} = ` : ''}{formatPrice(Number(t.price || 0) * item.quantity)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {saleBreakdown(sale).hasComponents && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-between items-center text-[11px] bg-[#dee8ff]/30 border border-[#cbd5e1]/40 rounded-xl px-3.5 py-2">
                          <span className="font-bold text-[#434653]">
                            Suma del desglose: <span className="font-mono text-[#00357f]">{formatPrice(saleBreakdown(sale).sum)}</span>
                          </span>
                          {Number(sale.discount_applied || 0) > 0 && (
                            <span className="font-bold text-[#005c3e]">
                              − Descuento {formatPrice(Number(sale.discount_applied))} = <span className="font-mono">{formatPrice(sale.total)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cupones y notas adicionales */}
                    {(sale.coupon || sale.discount_applied > 0 || sale.notes) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-left">
                        {sale.coupon && (
                          <div className="bg-[#49da9f]/10 border border-[#49da9f]/30 p-2.5 rounded-xl flex items-center justify-between text-[#005c3e] font-bold">
                            <span>Cupón: <strong className="font-mono uppercase">{sale.coupon.code}</strong></span>
                            <span>-{sale.coupon.discount_percent}%</span>
                          </div>
                        )}
                        {sale.discount_applied > 0 && !sale.coupon && (
                          <div className="bg-[#49da9f]/10 border border-[#49da9f]/30 p-2.5 rounded-xl text-[#005c3e] font-bold">
                            Descuento directo: <strong className="font-mono">{formatPrice(sale.discount_applied)}</strong>
                          </div>
                        )}
                        {sale.notes && (
                          <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3 rounded-xl text-[#434653] sm:col-span-2 font-medium">
                            <span className="font-bold text-[#737784] block mb-0.5 text-[9px] uppercase">Notas de la compra:</span>
                            {sale.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: BILLING (COBRANZA) */}
        {activeTab === 'billing' && (
          <div className="space-y-6" id="cobranza">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#737784]">Cobranza y Pagos a Plazos</h3>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00357f]">
                <CreditCard className="w-3.5 h-3.5" /> Estado de cuenta
              </span>
            </div>

            {/* Resumen de cobranza */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Pago pendiente total</span>
                  <span className={`text-3xl font-black font-mono ${billing.pendingTotal > 0 ? 'text-[#ba1a1a]' : 'text-emerald-700'}`}>
                    {formatPrice(billing.pendingTotal)}
                  </span>
                </div>
                <div className="space-y-1 sm:border-x sm:border-[#cbd5e1]/40 sm:px-4">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Se reparte en</span>
                  {billing.pendingCount > 0 ? (
                    <span className="text-sm font-bold text-[#111c2d] block">
                      {billing.pendingCount} cuota{billing.pendingCount !== 1 ? 's' : ''} pendiente{billing.pendingCount !== 1 ? 's' : ''}
                      {' '}de {billing.pendingSalesCount} venta{billing.pendingSalesCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-emerald-700 block">Sin cuotas pendientes</span>
                  )}
                </div>
                <div className="space-y-1 sm:pl-4">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Próximo vencimiento</span>
                  {billing.nextDue ? (
                    <span className={`text-sm font-bold block ${billing.nextOverdue ? 'text-[#ba1a1a]' : 'text-[#00357f]'}`}>
                      {formatDate(billing.nextDue)}{billing.nextOverdue ? ' (vencido)' : ''}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-emerald-700 block">Al corriente</span>
                  )}
                </div>
              </div>
              {billing.pendingTotal <= 0 && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" /> El cliente no tiene adeudos pendientes en este momento.
                </p>
              )}
            </div>

            {/* Cuotas por venta: historial completo (pagadas y pendientes) */}
            {installments.length === 0 ? (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl py-12 text-center space-y-3 shadow-sm p-6">
                <p className="text-xs text-[#737784] font-semibold">Este cliente no tiene compras a plazos registradas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {billing.salesWithInstallments.map((sale: any) => {
                  const saleInsts = installments
                    .filter((i: any) => i.sale_id === sale.id)
                    .sort((a: any, b: any) => Number(a.installment_number || 0) - Number(b.installment_number || 0))
                  const todayStart = new Date()
                  todayStart.setHours(0, 0, 0, 0)
                  return (
                    <div key={sale.id} className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
                      <div className="bg-[#f9f9ff] border-b border-[#cbd5e1]/40 px-5 py-3.5 flex flex-wrap justify-between items-center gap-2 text-xs font-medium">
                        <span className="font-bold text-[#00357f]">Orden #{sale.id.slice(0, 6).toUpperCase()}</span>
                        <span className="text-[#737784]">Total: <strong className="font-mono text-[#111c2d]">{formatPrice(sale.total)}</strong></span>
                        <span className="text-[#737784]">Abonado: <strong className="font-mono text-[#111c2d]">{formatPrice(Number(sale.paid_amount || 0))}</strong></span>
                        <span className={Number(sale.pending_balance || 0) > 0 ? 'text-[#ba1a1a] font-bold' : 'text-emerald-700 font-bold'}>
                          Resta: {formatPrice(Number(sale.pending_balance || 0))}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        {saleInsts.map((inst: any) => {
                          const isPending = inst.status === 'pending'
                          const amountNum = Number(inst.amount || 0)
                          const paidNum = Number(inst.amount_paid || 0)
                          const saldo = Math.max(amountNum - paidNum, 0)
                          const overdue = isPending && parseLocalDate(inst.due_date) < todayStart
                          return (
                            <div
                              key={inst.id}
                              className={`p-3.5 border rounded-xl ${
                                isPending
                                  ? 'border-[#cbd5e1] bg-white'
                                  : 'border-emerald-200 bg-emerald-50/20 opacity-85'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <span className="block text-[10px] font-bold text-[#434653]">
                                    Pago #{inst.installment_number}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                    <span className="font-extrabold text-[#111c2d] font-mono">{formatPrice(amountNum)}</span>
                                    {isPending ? (
                                      <span className={`font-bold ${overdue ? 'text-[#ba1a1a]' : 'text-[#737784]'}`}>
                                        Vence: {formatDate(inst.due_date)}{overdue ? ' (vencida)' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 font-bold">
                                        Pagado: {inst.payment_date ? formatDate(inst.payment_date) : '—'}
                                      </span>
                                    )}
                                  </div>
                                  {isPending && (
                                    <span className="block text-[11px] font-bold text-[#00668a]">
                                      Abonado: {formatPrice(paidNum)} de {formatPrice(amountNum)} · Saldo: {formatPrice(saldo)}
                                    </span>
                                  )}
                                </div>
                                {!isPending && (
                                  <span className="shrink-0 text-[10px] font-black text-emerald-700 uppercase flex items-center gap-0.5">
                                    <Check className="w-3.5 h-3.5" /> Pagado
                                  </span>
                                )}
                              </div>

                              {isPending && (
                                <InstallmentPayForm
                                  installment={inst}
                                  formatPrice={formatPrice}
                                  onDone={reloadBilling}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
