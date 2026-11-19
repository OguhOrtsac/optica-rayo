'use client'

import * as React from 'react'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getCustomerSales, getCustomerInstallments, getReminderConfig, getMessageTemplate, updateCustomerGeneralData, getSaleRefinancings, restructureSalePayments, type ReminderConfig } from '@/lib/services'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { isAdminRole, normalizeRole, type AccessRole } from '@/lib/roles'
import {
  buildInstallmentSchedule,
  defaultFirstPaymentDate,
  frequencyPlural,
  type PaymentFrequency,
} from '@/lib/payment-plan'
import { registerInstallmentPaymentAction, registerSaleBalancePaymentAction } from '@/app/customers/actions'
import { buildReminderMessage } from '@/lib/reminder-config'
import { splitPhonePrefix, toWhatsAppNumber } from '@/lib/phone'
import PhoneInput from '@/components/phone-input'
import {
  normalizeClinicalHistory,
  hasClinicalHistory,
  HYPERTENSION_DIABETES_LABELS,
  CLINICAL_LEAD_NAME,
  CLINICAL_LEAD_FOLIO,
  type ClinicalHistory,
} from '@/lib/clinical-history'
import { orderCodeFromSaleId } from '@/lib/ticket'
import {
  PAYMENT_REMINDER_TEMPLATE_KEY,
  DEFAULT_PAYMENT_REMINDER_TEMPLATE,
  buildPaymentReminderMessage,
} from '@/lib/message-templates'
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Phone, 
  Calendar, 
  CalendarPlus,
  MessageCircle,
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
  RefreshCw,
  Pencil,
  X
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
    <div className="mt-3 border-t border-[#cbd5e1]/40 pt-3">
      {feedback && (
        <div className={`mb-2 p-2 rounded-lg text-[11px] font-bold border ${
          feedback.type === 'success'
            ? 'bg-[#e2f9ee] border-[#49da9f]/40 text-[#00422b]'
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

// Formulario en línea de abono para una venta con saldo pendiente SIN
// cuotas — el caso del anticipo parcial del POS: la venta quedó con
// pending_balance pero sin plan a plazos, y hasta ahora ese adeudo no
// se podía cobrar desde la app. Mismo formato que el de cuotas (monto +
// método; la fecha la sella la acción compartida al liquidar), pero
// llama a registerSaleBalancePaymentAction, que genera la cuota espejo
// del saldo y aplica el abono con la acción de siempre. Al terminar, el
// padre recarga y la venta pasa a la lista de cuotas.
function SaleBalancePayForm({ sale, formatPrice, onDone }: {
  sale: any
  formatPrice: (n: number) => string
  onDone: () => void
}) {
  const saldo = Math.max(Number(sale.pending_balance || 0), 0)
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
      const result = await registerSaleBalancePaymentAction(sale.id, val, method)
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
    <div className="mt-3 border-t border-[#cbd5e1]/40 pt-3">
      {feedback && (
        <div className={`mb-2 p-2 rounded-lg text-[11px] font-bold border ${
          feedback.type === 'success'
            ? 'bg-[#e2f9ee] border-[#49da9f]/40 text-[#00422b]'
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

// Modal «Reestructurar pagos» de la pestaña Cobranza (dictado del
// dueño, 2026-11-19): SOLO administrador — el botón que lo abre solo
// se pinta para isAdminRole y la acción de servidor vuelve a
// verificar el rol. Reestructura el SALDO pendiente de UNA venta: el
// costo por refinanciación (opcional) se suma al saldo y a la orden,
// las cuotas no liquidadas se sustituyen por el plan nuevo y la
// operación queda en el historial estructurado. La vista previa usa
// el mismo cálculo a centavos del plan del POS (lib/payment-plan).
function RestructurePaymentsModal({ sale, formatPrice, formatDate, onClose, onDone }: {
  sale: any
  formatPrice: (n: number) => string
  formatDate: (d: string) => string
  onClose: () => void
  onDone: () => void
}) {
  const pending = Number(sale.pending_balance || 0)
  const [feeInput, setFeeInput] = useState('0')
  const [countInput, setCountInput] = useState('4')
  const [frequency, setFrequency] = useState<PaymentFrequency>('biweekly')
  const [startDate, setStartDate] = useState(() => defaultFirstPaymentDate('biweekly'))
  const [dateTouched, setDateTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fee = Math.max(0, parseFloat(feeInput.replace(',', '.')) || 0)
  const count = Math.max(1, Math.floor(parseInt(countInput, 10) || 0) || 1)
  const newBalance = Math.round((pending + fee) * 100) / 100
  const schedule = newBalance > 0
    ? buildInstallmentSchedule(newBalance, count, frequency, startDate)
    : []
  const firstAmount = schedule[0]?.amount ?? 0
  const lastAmount = schedule[schedule.length - 1]?.amount ?? 0

  const handleFrequency = (f: PaymentFrequency) => {
    setFrequency(f)
    if (!dateTouched) setStartDate(defaultFirstPaymentDate(f))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('La fecha de inicio no es válida.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const res = await restructureSalePayments(sale.id, {
        feeAmount: fee,
        installmentsCount: count,
        frequency,
        firstDueDate: startDate,
      })
      if (!res.success) {
        setError(res.error || 'No se pudo reestructurar los pagos.')
        return
      }
      onDone()
    } catch (err: any) {
      setError(err?.message || 'No se pudo reestructurar los pagos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f3ff] sticky top-0 bg-white z-10">
          <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">
            Reestructurar pagos · Orden #{orderCodeFromSaleId(sale.id)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f0f3ff] text-[#737784] transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p role="alert" className="rounded-lg px-3 py-2 text-[11px] font-bold bg-[#ffdad6] text-[#93000a]">
              {error}
            </p>
          )}
          <div className="bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-[#434653]">Saldo pendiente actual</span>
            <span className="text-lg font-black font-mono text-[#ba1a1a]">{formatPrice(pending)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="restructure-fee" className="text-xs font-bold text-[#111c2d]">Costo por refinanciación</label>
              <input
                id="restructure-fee"
                type="number"
                min={0}
                step="0.01"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] tabular-nums"
              />
              <p className="text-[10px] text-[#737784] font-semibold">Opcional: recargo por el atraso; $0 = sin costo.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="restructure-count" className="text-xs font-bold text-[#111c2d]">Número de pagos</label>
              <input
                id="restructure-count"
                type="number"
                min={1}
                step={1}
                value={countInput}
                onChange={e => setCountInput(e.target.value)}
                className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111c2d]">Frecuencia</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'weekly', label: 'Semanal' },
                { id: 'biweekly', label: 'Quincenal' },
                { id: 'monthly', label: 'Mensual' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFrequency(f.id as PaymentFrequency)}
                  className={`py-2 text-sm font-semibold rounded-full border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                    frequency === f.id
                      ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                      : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#dee8ff]/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="restructure-start" className="text-xs font-bold text-[#111c2d]">A partir de cuándo (primer pago)</label>
            <input
              id="restructure-start"
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setDateTouched(true) }}
              className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]"
            />
          </div>
          {schedule.length > 0 && (
            <p className="text-xs font-bold text-[#00357f] bg-[#dee8ff]/50 border border-[#00357f]/15 rounded-xl px-3.5 py-2.5 leading-relaxed">
              Debía {formatPrice(pending)} + refinanciación {formatPrice(fee)} = {formatPrice(newBalance)} en{' '}
              {count} pagos {frequencyPlural(frequency)} de {formatPrice(firstAmount)}
              {lastAmount !== firstAmount && <> (último de {formatPrice(lastAmount)})</>}
              {' '}· primer pago el {formatDate(startDate)}
            </p>
          )}
          <p className="text-[11px] text-[#737784] font-semibold leading-relaxed">
            Las cuotas ya pagadas quedan como están y lo abonado no se toca. Las cuotas pendientes
            (incluidas las parcialmente pagadas: su abono ya está neto en el saldo) se sustituyen por este plan.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || newBalance <= 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#00357f] hover:bg-[#004aad] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {submitting ? 'Guardando…' : 'Reestructurar pagos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Bloque «Historial de refinanciaciones» de una venta en Cobranza:
// cada reestructura registrada (fecha, pagado y saldo previos, cuotas
// sustituidas, recargo, nuevo total y el plan nuevo completo).
function RefinancingHistory({ rows, formatPrice, formatDate }: {
  rows: any[]
  formatPrice: (n: number) => string
  formatDate: (d: string) => string
}) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="border-t border-[#cbd5e1]/40 bg-[#f9f9ff] px-5 py-4 space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-wider text-[#00357f]">
        Historial de refinanciaciones
      </h4>
      {rows.map((r: any) => (
        <div key={r.id} className="text-xs font-medium text-[#434653] leading-relaxed border-l-2 border-[#00357f]/30 pl-3 space-y-0.5">
          <p className="font-bold text-[#111c2d]">
            {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}Recargo: {formatPrice(Number(r.fee_amount || 0))}
            {' · '}Nuevo total de la orden: {formatPrice(Number(r.new_total || 0))}
          </p>
          <p>
            Llevaba pagado {formatPrice(Number(r.previous_paid_amount || 0))} y debía{' '}
            {formatPrice(Number(r.previous_pending_balance || 0))}; se sustituyeron{' '}
            {Number(r.replaced_installments || 0)} cuota{Number(r.replaced_installments || 0) !== 1 ? 's' : ''}.
          </p>
          <p>
            Plan nuevo: {Number(r.installments_count || 0)} pagos {frequencyPlural(r.frequency)} de{' '}
            {formatPrice(Number(r.installment_amount || 0))} · primer pago el {formatDate(r.first_due_date)}
          </p>
        </div>
      ))}
    </div>
  )
}

// Modal «Actualizar datos» de la tarjeta Datos Generales (pedido del
// dueño, 2026-11-19): edita SOLO nombre, teléfono (el de WhatsApp),
// fecha de nacimiento y dirección — los datos que se capturan al dar
// de alta al cliente y que los registros rápidos (POS, agenda, examen)
// dejan incompletos a propósito. Guarda por updateCustomerGeneralData
// (acción de servidor con verificación de rol staff; en demo, mocks)
// y al terminar el padre recarga el registro del cliente.
function EditCustomerDataModal({ customer, onClose, onSaved }: {
  customer: any
  onClose: () => void
  onSaved: () => void
}) {
  const cp = customer.customer_profiles || {}
  const [fullName, setFullName] = useState(customer.full_name || '')
  const [phone, setPhone] = useState(cp.phone || '')
  const [dateOfBirth, setDateOfBirth] = useState(cp.date_of_birth ? String(cp.date_of_birth).slice(0, 10) : '')
  const [address, setAddress] = useState(cp.address || '')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const name = fullName.trim()
    if (!name) {
      setFeedback('El nombre completo es obligatorio.')
      return
    }
    const phoneValue = phone.trim()
    // La regla de los 10 dígitos corre sobre el número LOCAL, ya sin
    // el prefijo elegido en el selector (+52 / +1 / otro).
    if (phoneValue && splitPhonePrefix(phoneValue).local.length < 10) {
      setFeedback('El teléfono debe tener al menos 10 dígitos.')
      return
    }
    if (dateOfBirth) {
      const parsed = new Date(`${dateOfBirth}T12:00:00`)
      if (isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        setFeedback('La fecha de nacimiento no es válida.')
        return
      }
    }
    try {
      setSubmitting(true)
      setFeedback(null)
      const result = await updateCustomerGeneralData(customer.id, {
        fullName: name,
        phone: phoneValue,
        dateOfBirth,
        address: address.trim(),
      })
      if (!result.success) {
        setFeedback(result.error || 'No se pudieron guardar los datos.')
      } else {
        onSaved()
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error al guardar los datos.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]'
  const labelClass = 'block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#111c2d]/50" role="dialog" aria-modal="true" aria-label="Actualizar datos del cliente">
      <div className="bg-white rounded-[20px] or-shadow-card w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-left max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-[#111c2d]">Actualizar datos</h4>
            <p className="text-[11px] text-[#737784] font-medium mt-0.5">
              Nombre, teléfono (WhatsApp), fecha de nacimiento y dirección del cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 shrink-0 rounded-lg border border-[#cbd5e1] text-[#737784] hover:text-[#111c2d] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[11px] font-bold">
            {feedback}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre Completo *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              disabled={submitting}
              placeholder="Ej. Ana Sofía Gómez"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Teléfono (WhatsApp)</label>
            {/* Prefijo elegible (+52 default sin el «1», +1 u otro):
                al abrir, el selector refleja el prefijo del número
                guardado y al guardar se recompone «+prefijo número». */}
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={submitting}
              selectClassName="bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-2 py-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] cursor-pointer shrink-0"
              customPrefixClassName="w-[68px] shrink-0 bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-2 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]"
              inputClassName={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Fecha de Nacimiento</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              disabled={submitting}
              placeholder="Calle, número, colonia, ciudad..."
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[44px] px-4 rounded-xl border border-[#cbd5e1] text-[#434653] text-sm font-bold transition-colors hover:bg-[#f0f3ff] cursor-pointer disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-4 rounded-xl bg-[#00357f] hover:bg-[#004aad] text-white text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
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
  // Rol de quien mira la ficha: la pestaña Cobranza NO se pinta para
  // el OPTOMETRISTA y su contenido no es alcanzable para él (decisión
  // del dueño, 2026-11-19: su mundo es el expediente clínico, sin
  // dinero). Mientras el rol no se resuelve, la pestaña se trata como
  // oculta: solo aparece cuando el rol ya probó NO ser optometrista.
  // En modo demo no hay sesión: el visor demo es el administrador.
  const [viewerRole, setViewerRole] = useState<AccessRole | null>(null)
  const [reminderCfg, setReminderCfg] = useState<ReminderConfig | null>(null)
  // Plantilla del recordatorio de cobranza (fuente única en app_settings,
  // editable en Configuración → Mensajes); el texto de siempre es el
  // respaldo mientras carga o si la lectura falla.
  const [paymentTemplate, setPaymentTemplate] = useState<string>(DEFAULT_PAYMENT_REMINDER_TEMPLATE)
  // Modal «Actualizar datos» de la tarjeta Datos Generales y su aviso
  // breve de confirmación (pedido del dueño, 2026-11-19).
  const [showEditDataModal, setShowEditDataModal] = useState(false)
  const [dataUpdated, setDataUpdated] = useState(false)
  // Reestructuración de pagos (dictado 2026-11-19): historial por
  // venta, la venta cuyo modal está abierto y el aviso de guardado.
  const [refinancingsBySale, setRefinancingsBySale] = useState<Record<string, any[]>>({})
  const [restructureTarget, setRestructureTarget] = useState<any | null>(null)
  const [restructureDone, setRestructureDone] = useState(false)

  useEffect(() => {
    getReminderConfig().then(setReminderCfg).catch(() => setReminderCfg(null))
    getMessageTemplate(PAYMENT_REMINDER_TEMPLATE_KEY).then(setPaymentTemplate).catch(() => {})
  }, [])

  // Rol del visitante (mismo patrón que la Agenda: la fila de
  // `profiles` manda, la metadata respalda, demo = administrador).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let resolved: AccessRole = 'guest'
      try {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
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
          resolved = normalizeRole(roleValue)
        } else if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          resolved = 'owner'
        }
      } catch {
        // stays 'guest': Cobranza simply never opens for this viewer
      }
      if (!cancelled) setViewerRole(resolved)
    })()
    return () => { cancelled = true }
  }, [])

  // El ancla #cobranza (p. ej. desde la página de pagos) abre la ficha
  // directamente en la pestaña de Cobranza — salvo para el
  // optometrista: para él esa pestaña no existe ni por enlace.
  useEffect(() => {
    if (viewerRole === null || viewerRole === 'optometrist') return
    if (window.location.hash === '#cobranza') {
      setActiveTab('billing')
    }
  }, [viewerRole])

  // La pestaña activa se auto-desplaza hasta quedar visible en su fila
  // (clave al abrir con #cobranza: Cobranza es la última y quedaría
  // cortada a la derecha en pantallas angostas).
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  useEffect(() => {
    if (loading) return
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTab, loading])

  // Historial de refinanciaciones por venta (degrada a vacío si la
  // tabla aún no existe: el bloque simplemente no se pinta).
  const loadRefinancings = useCallback(async (salesList: any[]) => {
    try {
      const entries = await Promise.all(
        salesList.map(async (s: any) => [s.id, await getSaleRefinancings(s.id)] as const)
      )
      setRefinancingsBySale(Object.fromEntries(entries))
    } catch {
      // Sin historial visible si la lectura falla.
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
        loadRefinancings(salesData)
      }
    } catch (err: any) {
      setError(`Error al cargar los datos: ${err.message || 'Error inesperado.'}`)
    } finally {
      setLoading(false)
    }
  }, [customerId, loadRefinancings])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Recarga solo el registro del cliente tras «Actualizar datos» (sin
  // el spinner de pantalla completa de la carga inicial).
  const refreshCustomer = useCallback(async () => {
    try {
      const custData = await getCustomerById(customerId)
      if (custData) setCustomer(custData)
    } catch {
      // Si la recarga falla, la recarga completa sigue disponible.
    }
  }, [customerId])

  // Al guardar en el modal: cerrarlo, mostrar la confirmación breve y
  // refrescar el registro para que la tarjeta muestre los datos nuevos.
  const handleDataSaved = useCallback(() => {
    setShowEditDataModal(false)
    setDataUpdated(true)
    refreshCustomer()
    setTimeout(() => setDataUpdated(false), 4000)
  }, [refreshCustomer])

  // Recarga solo datos de dinero tras registrar un abono.
  const reloadBilling = useCallback(async () => {
    try {
      const [salesData, installmentsData] = await Promise.all([
        getCustomerSales(customerId),
        getCustomerInstallments(customerId),
      ])
      setSales(salesData)
      setInstallments(installmentsData)
      loadRefinancings(salesData)
    } catch {
      // Si la recarga falla, la recarga completa sigue disponible.
    }
  }, [customerId, loadRefinancings])

  // Al guardar una reestructuración: cerrar el modal, avisar y
  // recargar el dinero (la venta, sus cuotas y el historial nuevos).
  const handleRestructureDone = useCallback(() => {
    setRestructureTarget(null)
    setRestructureDone(true)
    reloadBilling()
    setTimeout(() => setRestructureDone(false), 4000)
  }, [reloadBilling])

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
      Number(it.lens_material_price || 0) > 0 || (it.sale_item_treatments || []).length > 0 || !!it.is_complement)
    return { sum, hasComponents }
  }

  // Historia clínica capturada con el examen (la hoja en papel del
  // negocio, ver lib/clinical-history.ts), en el orden de la hoja.
  // Esta ficha es vista de personal: el cliente nunca ve su
  // graduación ni su historia clínica.
  const renderClinicalHistory = (exam: any) => {
    const history = normalizeClinicalHistory(exam.clinical_history)
    if (!hasClinicalHistory(history)) return null
    const h = history as ClinicalHistory
    const yesNo = (v: string | null) => (v === 'si' ? 'Sí' : v === 'no' ? 'No' : '—')
    const antecedents: { label: string; value: string }[] = [
      { label: '¿Le molestan las luces?', value: yesNo(h.bothersLights) },
      { label: '¿Ha usado lentes antes?', value: yesNo(h.usedGlassesBefore) },
      ...(h.glassesTime ? [{ label: 'Tiempo con ellos', value: h.glassesTime }] : []),
      { label: 'Fecha del último examen', value: h.lastExamDate ? formatDate(h.lastExamDate) : '—' },
      { label: '¿A qué se dedica?', value: h.occupation || '—' },
      {
        label: '¿Cirugías en sus ojos?',
        value: h.eyeSurgeryDetail ? `${yesNo(h.eyeSurgery)} — ${h.eyeSurgeryDetail}` : yesNo(h.eyeSurgery),
      },
      {
        label: 'Hipertensión o diabetes',
        value: h.hypertensionDiabetes ? HYPERTENSION_DIABETES_LABELS[h.hypertensionDiabetes] : '—',
      },
      {
        label: '¿Toma medicamentos?',
        value: h.medicationsDetail ? `${yesNo(h.medications)} — ${h.medicationsDetail}` : yesNo(h.medications),
      },
      { label: '¿Algún familiar usa lentes?', value: yesNo(h.familyUsesGlasses) },
      { label: 'Uso de aparatos electrónicos', value: h.screenTime || '—' },
    ]
    const vaRows = [
      { label: 'AV S/C Lejos', v: h.vaScFar },
      { label: 'AV S/C Cerca', v: h.vaScNear },
      { label: 'AV C/C Lejos', v: h.vaCcFar },
      { label: 'AV C/C Cerca', v: h.vaCcNear },
    ]
    const hasVa = vaRows.some(r => r.v.od || r.v.oi || r.v.ao)
    const gradLine = (g: { sphere: number | null; cylinder: number | null; axis: number | null; add: number | null }) =>
      `Esf ${formatExamValue(g.sphere)} · Cil ${formatExamValue(g.cylinder)} · Eje ${g.axis !== null && g.axis !== undefined ? `${g.axis}°` : '--'} · Add ${formatAddValue(g.add)}`
    const hasRx = [h.rx.od, h.rx.oi].some(g => g.sphere !== null || g.cylinder !== null || g.axis !== null || g.add !== null)

    return (
      <div className="border-t border-[#cbd5e1]/40 pt-4 space-y-4 text-left">
        <div>
          <span className="text-[10px] font-black text-[#00357f] uppercase tracking-wider">Historia clínica</span>
          <p className="text-[10px] text-[#737784] font-semibold mt-0.5">
            Responsable clínico: {CLINICAL_LEAD_NAME} · Folio SEP CONOCER {CLINICAL_LEAD_FOLIO}
          </p>
        </div>

        {/* Antecedentes, en el orden de la hoja */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {antecedents.map(item => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-lg px-3 py-2">
              <span className="text-[10px] text-[#737784] font-bold">{item.label}</span>
              <span className="text-[11px] font-bold text-[#111c2d] text-right">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Agudeza visual */}
        {hasVa && (
          <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl p-3">
            <span className="block text-[8px] text-[#737784] font-bold uppercase tracking-wider mb-2">Agudeza visual</span>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-1 text-center text-[11px]">
              <div />
              {['OD', 'OI', 'AO'].map(col => (
                <div key={col} className="font-black text-[#00357f] bg-[#eef4ff] rounded-md py-1">{col}</div>
              ))}
              {vaRows.map(row => (
                <div key={row.label} className="contents">
                  <span className="text-left font-bold text-[#434653] py-1">{row.label}</span>
                  {[row.v.od, row.v.oi, row.v.ao].map((val, idx) => (
                    <span key={idx} className="bg-white border border-[#cbd5e1]/40 rounded-md py-1 font-semibold text-[#111c2d]">{val || '—'}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retinoscopía y DIP por ojo */}
        {(h.retinoscopy.od || h.retinoscopy.oi || h.dipOd !== null || h.dipOi !== null) && (
          <div className="flex flex-wrap gap-1.5">
            {(h.retinoscopy.od || h.retinoscopy.oi) && (
              <span className="bg-[#f0f3ff] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#434653]">
                Retinoscopía: OD {h.retinoscopy.od || '—'} · OI {h.retinoscopy.oi || '—'}
              </span>
            )}
            {(h.dipOd !== null || h.dipOi !== null) && (
              <span className="bg-[#f0f3ff] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#434653]">
                DIP por ojo: OD {h.dipOd !== null ? `${h.dipOd} mm` : '—'} · OI {h.dipOi !== null ? `${h.dipOi} mm` : '—'}
              </span>
            )}
          </div>
        )}

        {/* RX inicial (la vigente es la RX Final de la receta de arriba) */}
        {hasRx && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl px-3 py-2.5">
              <span className="block text-[8px] text-[#737784] font-bold uppercase tracking-wider">RX inicial · OD</span>
              <span className="text-[11px] font-mono font-bold text-[#434653]">{gradLine(h.rx.od)}</span>
            </div>
            <div className="bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl px-3 py-2.5">
              <span className="block text-[8px] text-[#737784] font-bold uppercase tracking-wider">RX inicial · OI</span>
              <span className="text-[11px] font-mono font-bold text-[#434653]">{gradLine(h.rx.oi)}</span>
            </div>
          </div>
        )}

        {/* Observaciones de la hoja */}
        {h.observations && (
          <div className="text-xs bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3 rounded-xl">
            <span className="font-bold text-[#737784] block mb-0.5">Observaciones (historia clínica):</span>
            <span className="text-[#434653] leading-relaxed block font-medium">{h.observations}</span>
          </div>
        )}
      </div>
    )
  }



  if (loading) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando expediente del cliente...</p>
      </main>
    )
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8">
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

  // Resumen de cobranza: saldo pendiente según las cuotas (saldo por cuota =
  // monto − abonado) MÁS el saldo de las ventas sin cuotas (anticipo del
  // POS), cuántas ventas lo reparten y el próximo vencimiento.
  const billing = (() => {
    const pending = installments
      .filter((i: any) => i.status === 'pending')
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    const fromInstallments = pending.reduce(
      (acc: number, i: any) => acc + Math.max(Number(i.amount || 0) - Number(i.amount_paid || 0), 0), 0)
    const salesWithInstallments = sales.filter((s: any) => installments.some((i: any) => i.sale_id === s.id))
    // Ventas con saldo pero SIN cuotas (anticipo parcial del POS): su
    // adeudo vive solo en pending_balance y también es cobrable. Cada
    // venta cae en un solo grupo (con cuotas o sin cuotas), así que el
    // total pendiente suma ambas fuentes sin duplicar.
    const salesWithoutInstallments = sales.filter(
      (s: any) => Number(s.pending_balance || 0) > 0 && !installments.some((i: any) => i.sale_id === s.id))
    const fromLooseBalances = salesWithoutInstallments.reduce(
      (acc: number, s: any) => acc + Number(s.pending_balance || 0), 0)
    const salesWithPending = new Set(pending.map((i: any) => i.sale_id))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next = pending[0] || null
    return {
      pending,
      pendingTotal: fromInstallments + fromLooseBalances,
      pendingCount: pending.length,
      pendingSalesCount: salesWithPending.size,
      salesWithInstallments,
      salesWithoutInstallments,
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

  // Teléfono del cliente listo para tel:/wa.me (con código de país,
  // SIN el «1» mexicano): normalizador único de lib/phone.
  const phoneWithCode = toWhatsAppNumber(cp.phone) || ''

  // Acciones rápidas de la cabecera: botones táctiles ≥44px, icono + texto.
  const quickActionClass = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-sm'

  // Pestañas de la ficha: etiquetas de UNA palabra, con sus insignias.
  const fichaTabs = [
    { key: 'profile', label: 'Datos', Icon: User, badge: 0, badgeClass: '' },
    { key: 'exams', label: 'Clínica', Icon: Eye, badge: exams.length, badgeClass: 'bg-[#dee8ff] text-[#00357f]' },
    { key: 'sales', label: 'Ventas', Icon: ShoppingBag, badge: sales.length, badgeClass: 'bg-[#dee8ff] text-[#00357f]' },
    { key: 'billing', label: 'Cobranza', Icon: Wallet, badge: billing.pendingCount, badgeClass: 'bg-[#ffdad6] text-[#ba1a1a]' },
  ] as const

  // Cobranza se pinta solo cuando el rol ya probó NO ser optometrista
  // (con el rol sin resolver también queda fuera: aparece al resolverse).
  const visibleFichaTabs =
    viewerRole === null || viewerRole === 'optometrist'
      ? fichaTabs.filter((tab) => tab.key !== 'billing')
      : fichaTabs

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Back and Header */}
      <div className="space-y-4">
        <Link href="/customers" className="inline-flex items-center gap-2 text-xs font-bold text-[#737784] hover:text-[#00357f] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Clientes
        </Link>

        {/* Customer Profile Header Card: identidad + saldo protagonista + acciones rápidas */}
        <div className="p-6 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-16 h-16 shrink-0 bg-[#dee8ff] text-[#00357f] rounded-full flex items-center justify-center font-black text-xl select-none">
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
              </div>
            </div>
          </div>

          {/* Saldo: UNA sola vez como cifra protagonista en la cabecera */}
          {billing.pendingTotal > 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-[#ffdad6] px-4 py-3">
              <span className="shrink-0 w-9 h-9 rounded-full bg-white/60 text-[#ba1a1a] flex items-center justify-center">
                <Wallet className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#ba1a1a]">Saldo pendiente</span>
                <span className="block text-xl font-black font-mono text-[#ba1a1a] leading-tight">{formatPrice(billing.pendingTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-[#e2f9ee] px-4 py-3">
              <span className="shrink-0 w-9 h-9 rounded-full bg-white/60 text-[#00422b] flex items-center justify-center">
                <Check className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-black text-[#00422b] leading-tight">Al corriente</span>
                <span className="block text-[11px] font-semibold text-[#00422b]">Sin saldo pendiente</span>
              </div>
            </div>
          )}

          {/* Acciones rápidas. Dictado del dueño (2026-11-18): Llamar,
              WhatsApp y Agendar examen van SIEMPRE en el mismo renglón,
              compactos, y Agendar examen en azul bajito (antes era azul
              sólido y los botones se envolvían a dos renglones). Cobrar,
              cuando aparece, ocupa su propio renglón completo. */}
          <div className="flex flex-col gap-2 border-t border-[#f0f3ff] pt-4">
            <div className="flex gap-2">
              {phoneWithCode && (
                <a
                  href={`tel:+${phoneWithCode}`}
                  className={`${quickActionClass} flex-1 min-w-0 bg-white border border-[#cbd5e1] text-[#00357f] hover:bg-[#dee8ff]/40`}
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  Llamar
                </a>
              )}
              {phoneWithCode && (
                <a
                  href={`https://wa.me/${phoneWithCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${quickActionClass} flex-1 min-w-0 bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113]`}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  WhatsApp
                </a>
              )}
              <Link
                href="/agendar"
                className={`${quickActionClass} flex-1 min-w-0 bg-[#dee8ff] hover:bg-[#c9dbff] text-[#00357f]`}
              >
                <CalendarPlus className="w-4 h-4 shrink-0" />
                Agendar examen
              </Link>
            </div>
            {billing.pendingTotal > 0 && viewerRole !== null && viewerRole !== 'optometrist' && (
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className={`${quickActionClass} w-full bg-[#ba1a1a] hover:bg-[#a31616] text-white`}
              >
                <Wallet className="w-4 h-4" />
                Cobrar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs navigation: fila desplazable con botones flex-none y
          etiquetas de una palabra (el patrón anterior, flex-1 con
          min-w-[92px], dejaba que el texto desbordara sobre la vecina).
          La siguiente pestaña asoma y un degradado a la derecha avisa
          que hay más; la activa se auto-desplaza hasta quedar visible. */}
      <div className="relative">
        <div
          role="tablist"
          className="flex overflow-x-auto bg-white rounded-t-xl border-b border-[#cbd5e1] shadow-sm"
        >
          {visibleFichaTabs.map(({ key, label, Icon, badge, badgeClass }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                ref={el => { tabRefs.current[key] = el }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(key)}
                className={`flex-none min-h-[48px] whitespace-nowrap px-4 text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors border-b-[3px] ${
                  isActive
                    ? 'border-[#00357f] text-[#00357f] font-semibold bg-[#dee8ff]/20'
                    : 'border-transparent text-[#737784] font-medium hover:text-[#111c2d]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {badge > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Pista de «hay más»: degradado que se desvanece en el borde derecho */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent rounded-tr-xl" />
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="flex justify-between items-center border-b border-[#f0f3ff] pb-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                  <span className="w-6 h-6 rounded-lg bg-[#dee8ff] text-[#00357f] flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  Datos Generales
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded font-black uppercase">
                    CRM Activo
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEditDataModal(true)}
                    className="inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-lg bg-[#dee8ff] hover:bg-[#c9dbff] text-[#00357f] text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Actualizar datos
                  </button>
                </div>
              </div>

              {dataUpdated && (
                <p className="text-[11px] font-bold text-[#00422b] bg-[#e2f9ee] border border-[#49da9f]/40 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" /> Datos del cliente actualizados.
                </p>
              )}

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
                        const phoneWithCode = toWhatsAppNumber(cp.phone)
                        if (!phoneWithCode) return
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

                    {/* Recordatorio de Cobranza: acción propia (envía el
                        recordatorio por WhatsApp); la cifra del saldo ya
                        vive como protagonista en la cabecera, así que la
                        etiqueta no la repite. */}
                    {billing.pendingTotal > 0 && (
                      <button
                        onClick={() => {
                          const phoneWithCode = toWhatsAppNumber(cp.phone)
                          if (!phoneWithCode) return
                          const message = buildPaymentReminderMessage(paymentTemplate, {
                            nombre: customer.full_name,
                            saldo: formatPrice(billing.pendingTotal),
                          })
                          window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank')
                        }}
                        type="button"
                        className="flex-1 bg-[#ffdad6] hover:bg-[#ffcdd0] text-[#ba1a1a] font-bold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 border border-[#ba1a1a]/25"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Recordatorio de Cobranza
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Antecedentes clínicos */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                <span className="w-6 h-6 rounded-lg bg-[#dee8ff] text-[#00357f] flex items-center justify-center">
                  <HeartHandshake className="w-3.5 h-3.5" />
                </span>
                Antecedentes Médicos
              </h3>
              <p className="text-xs text-[#434653] leading-relaxed bg-[#f9f9ff] p-4 rounded-xl border border-[#cbd5e1]/40 min-h-[60px] font-medium">
                {cp.medical_notes || 'Sin observaciones o condiciones registradas.'}
              </p>
            </div>

            {/* Contacto de Emergencia */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                <span className="w-6 h-6 rounded-lg bg-[#dee8ff] text-[#00357f] flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5" />
                </span>
                Contacto de Emergencia
              </h3>
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
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                <span className="w-6 h-6 rounded-lg bg-[#0899c9]/10 text-[#0899c9] flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5" />
                </span>
                Exámenes del Cliente
              </h3>
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

                      {/* Historia clínica (la hoja en papel), si el examen la trae */}
                      {renderClinicalHistory(exam)}

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
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                <span className="w-6 h-6 rounded-lg bg-[#dee8ff] text-[#00357f] flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </span>
                Historial de Compras
              </h3>
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
                        {sale.sale_items?.filter((item: any) => !item.is_complement).map((item: any, idx: number) => {
                          const treatments = item.sale_item_treatments || []
                          const materialPrice = Number(item.lens_material_price || 0)
                          const showMaterial = !!item.lens_material?.name && materialPrice > 0
                          const itemComplements = (sale.sale_items || []).filter((c: any) => c.is_complement && c.complement_for === item.product?.name)
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
                              {(showMaterial || treatments.length > 0 || itemComplements.length > 0) && (
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
                                  {itemComplements.map((c: any, ci: number) => (
                                    <div key={`comp-${ci}`} className="flex justify-between items-center text-[11px] pl-3">
                                      <span className="text-[#434653] font-medium">Complemento: <strong className="text-[#111c2d]">{c.complement_name || 'Complemento'}</strong></span>
                                      {Number(c.price) > 0 ? (
                                        <span className="font-mono text-[#434653]">
                                          {(c.quantity || 1) > 1 ? `${c.quantity} x ${formatPrice(Number(c.price))} = ` : ''}{formatPrice(Number(c.price) * (c.quantity || 1))}
                                        </span>
                                      ) : (
                                        <span className="bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[10px]">Gratis</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {/* Complements whose parent product is no longer listed */}
                        {(sale.sale_items || []).filter((c: any) => c.is_complement && !(sale.sale_items || []).some((i: any) => !i.is_complement && i.product?.name === c.complement_for)).map((c: any, ci: number) => (
                          <div key={`orphan-${ci}`} className="text-xs bg-[#f9f9ff] px-3.5 py-2.5 rounded-xl border border-[#cbd5e1]/40 flex justify-between items-center">
                            <span className="text-[#434653] font-medium">Complemento: <strong className="text-[#111c2d]">{c.complement_name || 'Complemento'}</strong></span>
                            {Number(c.price) > 0 ? (
                              <span className="font-mono text-[#434653]">{formatPrice(Number(c.price) * (c.quantity || 1))}</span>
                            ) : (
                              <span className="bg-[#e2f9ee] text-[#00422b] px-2 py-0.5 rounded-full font-bold text-[10px]">Gratis</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {saleBreakdown(sale).hasComponents && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-between items-center text-[11px] bg-[#dee8ff]/30 border border-[#cbd5e1]/40 rounded-xl px-3.5 py-2">
                          <span className="font-bold text-[#434653]">
                            Suma del desglose: <span className="font-mono text-[#00357f]">{formatPrice(saleBreakdown(sale).sum)}</span>
                          </span>
                          {Number(sale.discount_applied || 0) > 0 && (
                            <span className="font-bold text-[#00422b]">
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
                          <div className="bg-[#e2f9ee] border border-[#49da9f]/40 p-2.5 rounded-xl flex items-center justify-between text-[#00422b] font-bold">
                            <span>Cupón: <strong className="font-mono uppercase">{sale.coupon.code}</strong></span>
                            <span>-{sale.coupon.discount_percent}%</span>
                          </div>
                        )}
                        {sale.discount_applied > 0 && !sale.coupon && (
                          <div className="bg-[#e2f9ee] border border-[#49da9f]/40 p-2.5 rounded-xl text-[#00422b] font-bold">
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
        {activeTab === 'billing' && viewerRole !== null && viewerRole !== 'optometrist' && (
          <div className="space-y-6" id="cobranza">
            <div className="flex justify-between items-center">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00357f]">
                <span className="w-6 h-6 rounded-lg bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5" />
                </span>
                Cobranza y Pagos a Plazos
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00357f]">
                <CreditCard className="w-3.5 h-3.5" /> Estado de cuenta
              </span>
            </div>

            {restructureDone && (
              <p className="text-xs font-bold text-[#00422b] bg-[#e2f9ee] border border-[#49da9f]/40 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> Pagos reestructurados: la venta ya muestra su plan nuevo.
              </p>
            )}

            {/* Resumen de cobranza */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Pago pendiente total</span>
                  <span className={`text-3xl font-black font-mono ${billing.pendingTotal > 0 ? 'text-[#ba1a1a]' : 'text-[#00422b]'}`}>
                    {formatPrice(billing.pendingTotal)}
                  </span>
                </div>
                <div className="space-y-1 sm:border-x sm:border-[#cbd5e1]/40 sm:px-4">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Se reparte en</span>
                  {billing.pendingCount > 0 ? (
                    <span className="text-sm font-bold text-[#111c2d] block">
                      {billing.pendingCount} cuota{billing.pendingCount !== 1 ? 's' : ''} pendiente{billing.pendingCount !== 1 ? 's' : ''}
                      {' '}de {billing.pendingSalesCount} venta{billing.pendingSalesCount !== 1 ? 's' : ''}
                      {billing.salesWithoutInstallments.length > 0 && (
                        <> + {billing.salesWithoutInstallments.length} venta{billing.salesWithoutInstallments.length !== 1 ? 's' : ''} con saldo sin plan</>
                      )}
                    </span>
                  ) : billing.salesWithoutInstallments.length > 0 ? (
                    <span className="text-sm font-bold text-[#111c2d] block">
                      {billing.salesWithoutInstallments.length} venta{billing.salesWithoutInstallments.length !== 1 ? 's' : ''} con saldo pendiente (sin plan a plazos)
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-[#00422b] block">Sin cuotas pendientes</span>
                  )}
                </div>
                <div className="space-y-1 sm:pl-4">
                  <span className="text-[9px] font-black uppercase text-[#737784] tracking-wider block">Próximo vencimiento</span>
                  {billing.nextDue ? (
                    <span className={`text-sm font-bold block ${billing.nextOverdue ? 'text-[#ba1a1a]' : 'text-[#00357f]'}`}>
                      {formatDate(billing.nextDue)}{billing.nextOverdue ? ' (vencido)' : ''}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-[#00422b] block">Al corriente</span>
                  )}
                </div>
              </div>
              {billing.pendingTotal <= 0 && (
                <p className="text-xs font-bold text-[#00422b] bg-[#e2f9ee] border border-[#49da9f]/40 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" /> El cliente no tiene adeudos pendientes en este momento.
                </p>
              )}
            </div>

            {/* Cuotas por venta: historial completo (pagadas y pendientes),
                más las ventas con saldo sin plan a plazos (anticipo POS) */}
            {installments.length === 0 && billing.salesWithoutInstallments.length === 0 ? (
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
                        <span className="font-bold text-[#00357f]">Orden #{orderCodeFromSaleId(sale.id)}</span>
                        <span className="text-[#737784]">Total: <strong className="font-mono text-[#111c2d]">{formatPrice(sale.total)}</strong></span>
                        <span className="text-[#737784]">Abonado: <strong className="font-mono text-[#111c2d]">{formatPrice(Number(sale.paid_amount || 0))}</strong></span>
                        <span className={Number(sale.pending_balance || 0) > 0 ? 'text-[#ba1a1a] font-bold' : 'text-[#00422b] font-bold'}>
                          Resta: {formatPrice(Number(sale.pending_balance || 0))}
                        </span>
                        {Number(sale.pending_balance || 0) > 0 && isAdminRole(viewerRole) && (
                          <button
                            type="button"
                            onClick={() => setRestructureTarget(sale)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00357f] text-white text-[11px] font-bold hover:bg-[#004aad] transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reestructurar pagos
                          </button>
                        )}
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
                              className={`p-4 border rounded-xl ${
                                isPending
                                  ? 'border-[#cbd5e1] bg-white'
                                  : 'border-[#b9e7cf] bg-[#e2f9ee]/50'
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
                                      <span className="text-[#00422b] font-bold">
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
                                {isPending ? (
                                  <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${overdue ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#fef3c7] text-[#92400e]'}`}>
                                    {overdue ? 'Vencida' : 'Pendiente'}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[10px] font-black text-[#00422b] uppercase flex items-center gap-0.5 bg-[#e2f9ee] px-2 py-0.5 rounded-full">
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
                      <RefinancingHistory
                        rows={refinancingsBySale[sale.id] || []}
                        formatPrice={formatPrice}
                        formatDate={formatDate}
                      />
                    </div>
                  )
                })}

                {/* Ventas con saldo SIN plan a plazos (anticipo parcial del
                    POS): no tienen cuotas, así que se cobran directo sobre
                    el saldo de la venta. Al primer abono se genera su cuota
                    espejo y pasan a la lista de arriba. */}
                {billing.salesWithoutInstallments.map((sale: any) => (
                  <div key={sale.id} className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-[#f9f9ff] border-b border-[#cbd5e1]/40 px-5 py-3.5 flex flex-wrap justify-between items-center gap-2 text-xs font-medium">
                      <span className="font-bold text-[#00357f]">Orden #{orderCodeFromSaleId(sale.id)}</span>
                      <span className="text-[#737784]">Total: <strong className="font-mono text-[#111c2d]">{formatPrice(sale.total)}</strong></span>
                      <span className="text-[#737784]">Abonado: <strong className="font-mono text-[#111c2d]">{formatPrice(Number(sale.paid_amount || 0))}</strong></span>
                      <span className="text-[#ba1a1a] font-bold">
                        Resta: {formatPrice(Number(sale.pending_balance || 0))}
                      </span>
                      {isAdminRole(viewerRole) && (
                        <button
                          type="button"
                          onClick={() => setRestructureTarget(sale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00357f] text-white text-[11px] font-bold hover:bg-[#004aad] transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reestructurar pagos
                        </button>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="p-4 border rounded-xl border-[#cbd5e1] bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <span className="block text-[10px] font-bold text-[#434653]">
                              Saldo por anticipo parcial
                            </span>
                            <span className="block text-[11px] font-bold text-[#00668a]">
                              Esta venta no tiene plan a plazos: el abono se registra directo sobre su saldo.
                            </span>
                          </div>
                          <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e]">
                            Pendiente
                          </span>
                        </div>

                        <SaleBalancePayForm
                          sale={sale}
                          formatPrice={formatPrice}
                          onDone={reloadBilling}
                        />
                      </div>
                    </div>
                    <RefinancingHistory
                      rows={refinancingsBySale[sale.id] || []}
                      formatPrice={formatPrice}
                      formatDate={formatDate}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showEditDataModal && customer && (
        <EditCustomerDataModal
          customer={customer}
          onClose={() => setShowEditDataModal(false)}
          onSaved={handleDataSaved}
        />
      )}

      {restructureTarget && (
        <RestructurePaymentsModal
          sale={restructureTarget}
          formatPrice={formatPrice}
          formatDate={formatDate}
          onClose={() => setRestructureTarget(null)}
          onDone={handleRestructureDone}
        />
      )}
    </main>
  )
}
