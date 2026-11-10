'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarX,
  CheckCircle2,
  Clock,
  Edit,
  Lock,
  Megaphone,
  Plus,
  Power,
  TicketPercent,
  Trash2,
  X,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import {
  createPromotion,
  deletePromotion,
  getAllPromotions,
  isPromotionInForce,
  setPromotionActive,
  updatePromotion,
  type Promotion,
} from '@/lib/services'

// Promotions are created and managed ONLY by the administrator
// (owner / super_admin) — the owner's rule: sellers do NOT create
// promotions, they only sell. RLS enforces the same rule in the
// database (migration 20261109_promotions); this page gate is the
// friendly front door.

type PromoStatus = 'vigente' | 'programada' | 'terminada' | 'inactiva'

const STATUS_META: Record<
  PromoStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  vigente: { label: 'Vigente', classes: 'bg-[#e2f9ee] text-[#00422b]', Icon: CheckCircle2 },
  programada: { label: 'Programada', classes: 'bg-[#fef3c7] text-[#92400e]', Icon: Clock },
  terminada: { label: 'Terminada', classes: 'bg-[#ffdad6] text-[#ba1a1a]', Icon: CalendarX },
  inactiva: { label: 'Inactiva', classes: 'bg-[#dee8ff] text-[#00357f]', Icon: Power },
}

function todayStr(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function promoStatus(promo: Promotion): PromoStatus {
  if (!promo.is_active) return 'inactiva'
  const today = todayStr()
  if (promo.starts_at && promo.starts_at > today) return 'programada'
  if (promo.ends_at && promo.ends_at < today) return 'terminada'
  return 'vigente'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  // DATE columns arrive as YYYY-MM-DD; parse as local date to avoid
  // the UTC-midnight shift showing the previous day.
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface PromoForm {
  title: string
  description: string
  discount_percent: string
  code: string
  image_url: string
  starts_at: string
  ends_at: string
  is_active: boolean
}

const EMPTY_FORM: PromoForm = {
  title: '',
  description: '',
  discount_percent: '',
  code: '',
  image_url: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
}

export default function AdminPromotionsPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const [canManage, setCanManage] = useState(false)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form modal (create / edit) and delete confirmation
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Promotion | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCanManage(false)
          return
        }
        setUserId(user.id)

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
          setPromotions(await getAllPromotions())
        }
      } catch (err) {
        console.error('Error loading promotions admin:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const refresh = async () => {
    setPromotions(await getAllPromotions())
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (promo: Promotion) => {
    setEditing(promo)
    setForm({
      title: promo.title,
      description: promo.description || '',
      discount_percent: promo.discount_percent !== null ? String(promo.discount_percent) : '',
      code: promo.code || '',
      image_url: promo.image_url || '',
      starts_at: promo.starts_at || '',
      ends_at: promo.ends_at || '',
      is_active: promo.is_active,
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSave = async () => {
    const title = form.title.trim()
    if (!title) {
      setFormError('El título es obligatorio.')
      return
    }
    const discountRaw = form.discount_percent.trim()
    const discount = discountRaw === '' ? null : Number(discountRaw)
    if (discount !== null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
      setFormError('El descuento debe ser un número entre 0 y 100.')
      return
    }
    if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }

    const payload = {
      title,
      description: form.description.trim() || null,
      discount_percent: discount,
      code: form.code.trim() || null,
      image_url: form.image_url.trim() || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active,
    }

    try {
      setSaving(true)
      setFormError(null)
      if (editing) {
        await updatePromotion(editing.id, payload)
        setFeedbackMsg({ type: 'success', text: 'Promoción actualizada.' })
      } else {
        await createPromotion({ ...payload, created_by: userId || null })
        setFeedbackMsg({ type: 'success', text: 'Promoción creada.' })
      }
      setFormOpen(false)
      await refresh()
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la promoción.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (promo: Promotion) => {
    try {
      setBusyId(promo.id)
      const ok = await setPromotionActive(promo.id, !promo.is_active)
      if (ok) {
        setFeedbackMsg({
          type: 'success',
          text: promo.is_active ? 'Promoción desactivada.' : 'Promoción activada.',
        })
        await refresh()
      } else {
        setFeedbackMsg({ type: 'error', text: 'No se pudo cambiar el estado de la promoción.' })
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      setBusyId(deleting.id)
      const ok = await deletePromotion(deleting.id)
      if (ok) {
        setFeedbackMsg({ type: 'success', text: 'Promoción eliminada.' })
        setDeleting(null)
        await refresh()
      } else {
        setFeedbackMsg({ type: 'error', text: 'No se pudo eliminar la promoción.' })
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#111c2d]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando promociones…</p>
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
            <Megaphone className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Promociones</h1>
          </div>
        </div>
        <div className="mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Las promociones las crea y administra <strong>solo el administrador</strong> (dueño).
              El vendedor no crea promociones: solo vende. Si necesitas una promoción, pídela al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const inForceCount = promotions.filter(p => isPromotionInForce(p)).length

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1100px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">

      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <Megaphone className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Promociones</h1>
            <p className="text-sm text-[#434653] mt-1 font-medium">
              Solo el administrador crea promociones. El cliente ve las vigentes ({inForceCount}) en su panel al iniciar sesión.
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#00357f] hover:bg-[#004aad] text-white px-5 py-2.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva Promoción
        </button>
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

      {/* Promotions List */}
      {promotions.length === 0 ? (
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-8 shadow-sm text-center space-y-2">
          <TicketPercent className="w-8 h-8 text-[#0899c9] mx-auto" />
          <p className="text-sm font-bold text-[#111c2d]">Todavía no hay promociones</p>
          <p className="text-xs text-[#434653] font-medium">
            Crea la primera con el botón «Nueva Promoción»: el cliente la verá en su panel mientras esté vigente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promotions.map(promo => {
            const status = promoStatus(promo)
            const meta = STATUS_META[status]
            const StatusIcon = meta.Icon
            return (
              <article key={promo.id} className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {promo.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={promo.image_url} alt="" className="w-full h-32 object-cover" />
                )}
                <div className="p-5 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-bold text-[#111c2d] leading-snug">{promo.title}</h2>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${meta.classes}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </div>
                  {promo.description && (
                    <p className="text-sm text-[#434653] leading-relaxed">{promo.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {promo.discount_percent !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#dee8ff] text-[#00357f] text-xs font-black">
                        <TicketPercent className="w-3.5 h-3.5" />
                        {promo.discount_percent}% de descuento
                      </span>
                    )}
                    {promo.code && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-dashed border-[#00357f]/40 text-[#00357f] text-xs font-black tracking-wider">
                        {promo.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#737784] font-semibold">
                    {promo.starts_at || promo.ends_at
                      ? `${promo.starts_at ? `Del ${formatDate(promo.starts_at)}` : 'Desde ya'} · ${promo.ends_at ? `hasta el ${formatDate(promo.ends_at)}` : 'sin fecha de término'}`
                      : 'Sin ventana de fechas: vigente mientras esté activa'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2 mt-auto border-t border-[#f0f3ff]">
                    <button
                      onClick={() => openEdit(promo)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-bold text-[#00357f] hover:bg-[#dee8ff]/40 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(promo)}
                      disabled={busyId === promo.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        promo.is_active
                          ? 'border-[#92400e]/30 text-[#92400e] hover:bg-[#fef3c7]'
                          : 'border-[#00422b]/25 text-[#00422b] hover:bg-[#e2f9ee]'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {promo.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setDeleting(promo)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#ba1a1a]/30 text-xs font-bold text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f3ff] sticky top-0 bg-white z-10">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">
                {editing ? 'Modificar Promoción' : 'Nueva Promoción'}
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
              <div className="space-y-1.5">
                <label htmlFor="promo-title" className="text-xs font-bold text-[#111c2d]">Título *</label>
                <input
                  id="promo-title"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej. Buen Fin: 20% en armazones seleccionados"
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="text"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="promo-desc" className="text-xs font-bold text-[#111c2d]">Descripción</label>
                <textarea
                  id="promo-desc"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Qué incluye, condiciones, en qué productos aplica…"
                  rows={3}
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="promo-discount" className="text-xs font-bold text-[#111c2d]">% de descuento</label>
                  <input
                    id="promo-discount"
                    value={form.discount_percent}
                    onChange={e => setForm({ ...form, discount_percent: e.target.value })}
                    placeholder="Opcional"
                    min={0}
                    max={100}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="promo-code" className="text-xs font-bold text-[#111c2d]">Código</label>
                  <input
                    id="promo-code"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="Opcional"
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="text"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="promo-image" className="text-xs font-bold text-[#111c2d]">URL de imagen</label>
                <input
                  id="promo-image"
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  placeholder="Opcional"
                  className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  type="url"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="promo-starts" className="text-xs font-bold text-[#111c2d]">Fecha de inicio</label>
                  <input
                    id="promo-starts"
                    value={form.starts_at}
                    onChange={e => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="promo-ends" className="text-xs font-bold text-[#111c2d]">Fecha de fin</label>
                  <input
                    id="promo-ends"
                    value={form.ends_at}
                    onChange={e => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full bg-[#f9f9ff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                    type="date"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#737784] font-semibold -mt-1">
                Sin fechas = vigente desde ya y sin término. La fecha de fin es el último día de la promoción.
              </p>
              <div className="flex items-center justify-between p-3.5 bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl select-none">
                <div>
                  <span className="block text-xs font-bold text-[#111c2d]">Promoción activa</span>
                  <span className="block text-[10px] text-[#737784] mt-0.5">Si está apagada, el cliente no la ve aunque esté en fechas.</span>
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
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear promoción'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111c2d]/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#111c2d]">¿Borrar esta promoción?</h2>
                <p className="text-sm text-[#434653] mt-1 leading-relaxed">
                  «{deleting.title}» se eliminará para siempre. Si solo quieres ocultarla del cliente, mejor desactívala.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={busyId === deleting.id}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {busyId === deleting.id ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
