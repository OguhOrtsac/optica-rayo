'use client'

import { useEffect, useState } from 'react'
import {
  getReminderConfig,
  saveReminderConfig,
  getDueReminders,
  markReminderContacted,
  type DueReminder,
} from '@/lib/services'
import { buildReminderMessage, toWhatsAppNumber } from '@/lib/reminder-config'
import { BellRing, CheckCheck, MessageSquare, Save } from 'lucide-react'

/**
 * Exam Review Reminders tray for the administrator.
 * Lists customers whose next eye exam is due (today or within 7 days),
 * with a one-tap WhatsApp link using the editable message template,
 * and a "Ya le escribí" action that rolls the reminder one period
 * forward so nobody is reminded twice in the same cycle or lost.
 */
export default function ReminderTray() {
  const [months, setMonths] = useState(6)
  const [template, setTemplate] = useState('')
  const [due, setDue] = useState<DueReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cfg, reminders] = await Promise.all([getReminderConfig(), getDueReminders()])
      setMonths(cfg.months)
      setTemplate(cfg.template)
      setDue(reminders)
    } catch (e) {
      console.error('Error loading reminder tray:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const flash = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await saveReminderConfig(months, template)
      flash('Configuración de recordatorios guardada.')
    } finally {
      setSaving(false)
    }
  }

  const handleContacted = async (reminder: DueReminder) => {
    const ok = await markReminderContacted(reminder.id, months)
    if (ok) {
      flash(`Listo: ${reminder.customer_name} vuelve a la lista en ${months} meses.`)
      const reminders = await getDueReminders()
      setDue(reminders)
    }
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#cbd5e1] shadow-sm text-left">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
          <BellRing className="w-4 h-4" />
          Recordatorios de Revisión
        </h3>
        <span className="px-2.5 py-0.5 rounded-full bg-[#dee8ff] text-[#00357f] font-bold text-[10px]">
          {due.length} por atender
        </span>
      </div>

      {/* Editable configuration: period + WhatsApp message template */}
      <div className="bg-[#f9f9ff] border border-[#cbd5e1]/50 rounded-xl p-4 space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[10px] font-black uppercase tracking-wider text-[#434653]">
            Recordar cada
          </label>
          <input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={e => setMonths(Math.max(1, parseInt(e.target.value || '6', 10) || 6))}
            className="w-20 bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-bold text-[#111c2d] focus:border-[#00357f] outline-none"
          />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#434653]">meses desde el último examen</span>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="ml-auto flex items-center gap-1.5 bg-[#00357f] hover:bg-[#004aad] text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        <textarea
          value={template}
          onChange={e => setTemplate(e.target.value)}
          rows={3}
          className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#111c2d] focus:border-[#00357f] outline-none resize-y"
          placeholder="Mensaje de WhatsApp para el recordatorio…"
        />
        <p className="text-[10px] text-[#737784] font-medium">
          Puede usar <strong className="text-[#00357f]">{'{nombre}'}</strong> y{' '}
          <strong className="text-[#00357f]">{'{meses}'}</strong>: se llenan solos con el nombre del cliente y el plazo configurado.
        </p>
        {feedback && <p className="text-[11px] font-bold text-emerald-700">{feedback}</p>}
      </div>

      {/* Due list */}
      {loading ? (
        <p className="text-xs text-[#737784] font-semibold py-6 text-center">Cargando recordatorios…</p>
      ) : due.length === 0 ? (
        <p className="text-xs text-[#737784] font-semibold py-6 text-center">
          Nadie cumple su revisión hoy ni en los próximos 7 días. 🎉
        </p>
      ) : (
        <div className="space-y-2.5">
          {due.map(r => {
            const waNumber = r.phone ? toWhatsAppNumber(r.phone) : null
            const message = buildReminderMessage(template, {
              nombre: r.customer_name.split(' ')[0] || r.customer_name,
              meses: months,
            })
            const waUrl = waNumber
              ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
              : '#'
            return (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-[#cbd5e1]/60 bg-[#f0f3ff]/60"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-[#111c2d]">{r.customer_name}</p>
                  <p className="text-[10px] text-[#737784] font-medium">
                    Tel: {r.phone || 'Sin teléfono'} · Último examen: {formatDate(r.last_visit_date)} ·{' '}
                    <span className="text-[#ba1a1a] font-bold">Vence: {formatDate(r.next_suggested_visit)}</span>
                    {r.last_reminded_at && <> · Último aviso: {formatDate(r.last_reminded_at)}</>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-[10px] font-bold text-white transition-all ${
                      waNumber ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer' : 'bg-emerald-600/50 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                  <button
                    onClick={() => handleContacted(r)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] hover:bg-[#dee8ff]/40 text-[#00357f] text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Ya le escribí
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
