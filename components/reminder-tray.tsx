'use client'

import { useEffect, useState } from 'react'
import {
  getReminderConfig,
  getDueReminders,
  markReminderContacted,
  logActivityEvent,
  type DueReminder,
} from '@/lib/services'
import { buildReminderMessage, toWhatsAppNumber } from '@/lib/reminder-config'
import { CheckCheck, MessageSquare } from 'lucide-react'

/**
 * Exam Review Reminders tray for the administrator.
 * Lists customers whose next eye exam is due (today or within 7 days),
 * with a one-tap WhatsApp link using the message template,
 * and a "Ya le escribí" action that rolls the reminder one period
 * forward so nobody is reminded twice in the same cycle or lost.
 *
 * SEND-ONLY (owner's order, 2026-11-18): the message template and the
 * period («recordar cada X meses») are configured ONLY in «Mensajes»
 * (/dashboard/admin/mensajes). This tray reads both values from the
 * shared configuration to build each WhatsApp link. The template is
 * NOT previewed here (owner's order, 2026-11-18 evening): only a short
 * note says a predefined message exists and can be changed in
 * «Mensajes».
 */
export default function ReminderTray() {
  const [months, setMonths] = useState(6)
  const [template, setTemplate] = useState('')
  const [due, setDue] = useState<DueReminder[]>([])
  const [loading, setLoading] = useState(true)
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
    // Sin tarjeta propia ni encabezado propio: en el panel la sección ya
    // vive dentro de una tarjeta blanca del sistema y su barra de sección
    // (un solo renglón) lleva el título y los conteos — vencidos en rojo
    // y por atender en naranja —; repetirlos aquí se veía doble y gordo.
    <div className="text-left">
      {/* Sin vista previa del mensaje (orden del dueño, 2026-11-18):
          solo una notita de que ya existe un mensaje predefinido y
          dónde se modifica. El mensaje y el periodo se configuran en
          «Mensajes»; aquí solo se envía. */}
      <div className="mb-5">
        <p className="text-[11px] text-[#737784] font-medium">
          Nota: ya existe un mensaje predefinido y se puede modificar en{' '}
          <strong className="text-[#00357f]">Mensajes</strong>.
        </p>
        {feedback && <p className="text-[11px] font-bold text-emerald-700 mt-2">{feedback}</p>}
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
                  {/* Sin tres puntos (regla del dueño): el nombre fluye
                      completo y los datos del aviso van en dos renglones
                      ordenados — contacto/examen y vencimiento/aviso —
                      para que todo se alcance a leer. */}
                  <p className="font-bold text-xs leading-snug text-[#111c2d]">{r.customer_name}</p>
                  <p className="text-[10px] leading-relaxed text-[#737784] font-medium mt-0.5">
                    Tel: {r.phone || 'Sin teléfono'} · Último examen: {formatDate(r.last_visit_date)}
                  </p>
                  <p className="text-[10px] leading-relaxed text-[#737784] font-medium">
                    <span className="text-[#ba1a1a] font-bold">Vence: {formatDate(r.next_suggested_visit)}</span>
                    {r.last_reminded_at && <> · Último aviso: {formatDate(r.last_reminded_at)}</>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      // El envío queda asentado en «Actividad reciente»
                      // (activity_events) al tocar el botón; el registro
                      // es en segundo plano y NUNCA bloquea la apertura
                      // de WhatsApp, ni siquiera si falla.
                      if (waNumber) {
                        void logActivityEvent('reminder_sent', {
                          customerId: r.customer_id,
                          description: `Recordatorio enviado a ${r.customer_name}`,
                        })
                      }
                    }}
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
