'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Edit, Plus, TicketPercent, X } from 'lucide-react'
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  type CouponWithUses,
} from '@/lib/services'

/**
 * Cupones de descuento (la tabla `coupons` que el POS aplica) dentro
 * de Admin → Promociones (dictado del dueño, 2026-11-19): crear y
 * editar cupones con LÍMITE DE USOS — «Ilimitado» por default o un
 * número — y ver el consumo derivado de las ventas guardadas con ese
 * coupon_id («3 de 5 usos» / «Ilimitado»). Al llegar al límite, el
 * cupón se muestra AGOTADO (estado derivado del conteo; no se borra
 * nada) y el POS deja de aplicarlo con su mensaje exacto.
 */

interface CouponForm {
  code: string
  discount_percent: string
  valid_until: string
  is_active: boolean
  unlimited: boolean
  max_uses: string
}

function defaultValidUntil(): string {
  const d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const EMPTY_FORM: CouponForm = {
  code: '',
  discount_percent: '',
  valid_until: defaultValidUntil(),
  is_active: true,
  unlimited: true,
  max_uses: '',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminCouponsSection() {
  const [coupons, setCoupons] = useState<CouponWithUses[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CouponWithUses | null>(null)
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setCoupons(await getAllCoupons())
    } catch (err) {
      console.error('Error loading coupons admin:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (coupon: CouponWithUses) => {
    setEditing(coupon)
    setForm({
      code: coupon.code,
      discount_percent: String(coupon.discount_percent),
      valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 10) : defaultValidUntil(),
      is_active: coupon.is_active,
      unlimited: (coupon.max_uses ?? null) === null,
      max_uses: coupon.max_uses != null ? String(coupon.max_uses) : '',
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase()
    if (!code) {
      setFormError('El código es obligatorio.')
      return
    }
    const discount = Number(form.discount_percent)
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      setFormError('El descuento debe ser un número entre 1 y 100.')
      return
    }
    let maxUses: number | null = null
    if (!form.unlimited) {
      const parsed = Math.floor(Number(form.max_uses))
      if (!Number.isFinite(parsed) || parsed < 1) {
        setFormError('El límite de usos debe ser un número entero mayor a 0, o elige «Ilimitado».')
        return
      }
      maxUses = parsed
    }
    const validUntil = form.valid_until
      ? new Date(`${form.valid_until}T23:59:59`).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    try {
      setSaving(true)
      setFormError(null)
      const payload = {
        code,
        discount_percent: discount,
        valid_until: validUntil,
        is_active: form.is_active,
        max_uses: maxUses,
      }
      if (editing) {
        await updateCoupon(editing.id, payload)
        setFeedback({ type: 'success', text: 'Cupón actualizado.' })
      } else {
        await createCoupon(payload)
        setFeedback({ type: 'success', text: 'Cupón creado.' })
      }
      setFormOpen(false)
      await refresh()
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el cupón.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4" aria-label="Cupones de descuento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#00357f] tracking-tight flex items-center gap-2">
            <TicketPercent className="w-5 h-5" />
            Cupones de descuento
          </h2>
          <p className="text-sm text-[#434653] mt-0.5 font-medium">
            Los códigos que el POS aplica al cobrar. Un uso = una venta guardada con ese cupón.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#00357f] hover:bg-[#004aad] text-white px-5 py-2.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cupón
        </button>
      </div>

      {feedback && (
        <p
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-4 py-3 text-xs font-bold border ${
            feedback.type === 'error'
              ? 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/20'
              : 'bg-[#e2f9ee] text-[#00422b] border-[#00422b]/15'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {loading ? (
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm text-center">
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando cupones…</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm text-center space-y-2">
          <TicketPercent className="w-8 h-8 text-[#0899c9] mx-auto" />
          <p className="text-sm font-bold text-[#111c2d]">Todavía no hay cupones</p>
          <p className="text-xs text-[#434653] font-medium">
            Crea el primero con el botón «Nuevo Cupón»: el vendedor podrá aplicarlo en el POS por su código.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map(coupon => {
            const limit = coupon.max_uses ?? null
            const exhausted = limit !== null && coupon.uses >= limit
            return (
              <article key={coupon.id} className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-dashed border-[#00357f]/40 text-[#00357f] text-sm font-black tracking-wider">
                    {coupon.code}
                  </span>
                  {exhausted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ffdad6] text-[#ba1a1a]">
                      Agotada
                    </span>
                  ) : coupon.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e2f9ee] text-[#00422b]">
                      <CheckCircle2 className="w-3 h-3" />
                      Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#dee8ff] text-[#00357f]">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#dee8ff] text-[#00357f] text-xs font-black">
                    <TicketPercent className="w-3.5 h-3.5" />
                    {coupon.discount_percent}% de descuento
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black ${exhausted ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#f0f3ff] text-[#434653]'}`}>
                    {limit !== null ? `${coupon.uses} de ${limit} usos` : 'Ilimitado'}
                  </span>
                </div>
                <p className="text-xs text-[#737784] font-semibold">
                  Vigente hasta el {formatDate(coupon.valid_until)}
                </p>
                <div className="flex flex-wrap gap-2 pt-2 mt-auto border-t border-[#f0f3ff]">
                  <button
                    onClick={() => openEdit(coupon)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-bold text-[#00357f] hover:bg-[#dee8ff]/40 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editar
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f3ff] sticky top-0 bg-white z-10">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">
                {editing ? 'Modificar Cupón' : 'Nuevo Cupón'}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#f0f3ff] text-[#737784] transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <p role="alert" className="rounded-lg px-3 py-2 text-[11px] font-bold bg-[#ffdad6] text-[#93000a]">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="coupon-code" className="text-xs font-bold text-[#111c2d]">Código *</label>
                  <input
                    id="coupon-code"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="Ej. BUENFIN20"
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none font-mono uppercase"
                    type="text"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="coupon-discount" className="text-xs font-bold text-[#111c2d]">% de descuento *</label>
                  <input
                    id="coupon-discount"
                    value={form.discount_percent}
                    onChange={e => setForm({ ...form, discount_percent: e.target.value })}
                    min={1}
                    max={100}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="number"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="coupon-valid" className="text-xs font-bold text-[#111c2d]">Vigente hasta</label>
                <input
                  id="coupon-valid"
                  value={form.valid_until}
                  onChange={e => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#111c2d]">Límite de usos</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, unlimited: true })}
                    className={`py-2.5 text-sm font-semibold rounded-xl border transition-all cursor-pointer min-h-[44px] ${
                      form.unlimited
                        ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                        : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#dee8ff]/30'
                    }`}
                  >
                    Ilimitado
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, unlimited: false })}
                    className={`py-2.5 text-sm font-semibold rounded-xl border transition-all cursor-pointer min-h-[44px] ${
                      !form.unlimited
                        ? 'bg-[#dee8ff] border-[#00357f]/40 text-[#00357f] font-bold'
                        : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#dee8ff]/30'
                    }`}
                  >
                    Con límite
                  </button>
                </div>
                {!form.unlimited && (
                  <input
                    id="coupon-max-uses"
                    value={form.max_uses}
                    onChange={e => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Ej. 5"
                    min={1}
                    step={1}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="number"
                  />
                )}
                <p className="text-[11px] text-[#737784] font-semibold">
                  Un uso = una venta guardada con este cupón. Al llegar al límite, el POS ya no lo aplica.
                </p>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl select-none">
                <div>
                  <span className="block text-xs font-bold text-[#111c2d]">Cupón activo</span>
                  <span className="block text-[10px] text-[#737784] mt-0.5">Si está apagado, el POS no lo aplica.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  aria-pressed={form.is_active}
                  className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    form.is_active ? 'bg-[#00357f]' : 'bg-[#cbd5e1]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                      form.is_active ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setFormOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#00357f] hover:bg-[#004aad] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cupón'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
