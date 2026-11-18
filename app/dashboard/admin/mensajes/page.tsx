'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BellRing,
  Cake,
  CheckCircle2,
  ChevronDown,
  Lock,
  MessagesSquare,
  MessageSquare,
  Save,
  Search,
  TrendingDown,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import {
  getMessageTemplates,
  saveMessageTemplate,
  getReminderConfig,
  saveReminderConfig,
} from '@/lib/services'
import PageHeader from '@/components/page-header'
import {
  REMINDER_TEMPLATE_KEY,
  BIRTHDAY_TEMPLATE_KEY,
  CATALOG_INQUIRY_TEMPLATE_KEY,
  LENS_REQUEST_REPLY_TEMPLATE_KEY,
  PAYMENT_REMINDER_TEMPLATE_KEY,
  type MessageTemplateKey,
} from '@/lib/message-templates'

// «Mensajes»: every pre-filled WhatsApp text of the app, edited in ONE
// place (the owner's order, 2026-11-18). Each template lives in
// app_settings under its own key and every usage point reads from there —
// what is saved here shows up in the Reminders tray, the birthday
// «Felicitar» button, the catalog inquiry link, the lens-request reply
// and the payment reminder.
//
// Since the owner's follow-up order (2026-11-18), this page is the ONLY
// door for the reminder configuration too: the reminder card below also
// owns the PERIOD («recordar cada X meses», saved together with the
// template through saveReminderConfig). The Reminders tray in the panel
// no longer edits anything — it only SENDS, with a read-only preview.
//
// Administrator-only page (owner / super_admin), same gate as Expenses
// and Promotions: the seller sells; the owner words the messages. RLS on
// app_settings enforces the same rule in the database.

type TemplateField = 'reminder' | 'birthday' | 'catalogInquiry' | 'lensRequestReply' | 'paymentReminder'

interface MessageCardSpec {
  field: TemplateField
  settingKey: MessageTemplateKey
  title: string
  icon: typeof BellRing
  /** Color propio de la tarjeta (paleta del menú/actividad): chip del
   *  icono, tinte de la barra de encabezado, fondo y borde del cuadro
   *  de texto y tono de las variables. Tintes suaves, tema claro. */
  chip: string
  bar: string
  soft: string
  border: string
  toneText: string
  focus: string
  where: string
  variables: { token: string; meaning: string }[]
  note?: string
}

const MESSAGE_CARDS: MessageCardSpec[] = [
  {
    field: 'reminder',
    settingKey: REMINDER_TEMPLATE_KEY,
    title: 'Recordatorio de examen',
    icon: BellRing,
    chip: 'bg-[#dee8ff] text-[#00357f]',
    bar: 'bg-[#dee8ff]/60',
    soft: 'bg-[#f0f3ff]',
    border: 'border-[#00357f]/25',
    toneText: 'text-[#00357f]',
    focus: 'focus:ring-[#00357f]/40 focus:border-[#00357f]',
    where:
      'Se envía desde la bandeja de Recordatorios del panel y con el botón «Enviar Recordatorio de Examen» en la ficha del cliente.',
    variables: [
      { token: '{nombre}', meaning: 'primer nombre del cliente' },
      { token: '{meses}', meaning: 'meses desde su último examen (el periodo configurado)' },
    ],
    note: 'El periodo y este mensaje se configuran solo aquí, en Mensajes. En el panel, la bandeja de Recordatorios solo sirve para enviar el mensaje; ahí ya no se edita.',
  },
  {
    field: 'birthday',
    settingKey: BIRTHDAY_TEMPLATE_KEY,
    title: 'Felicitación de cumpleaños',
    icon: Cake,
    chip: 'bg-[#fce7f3] text-[#be185d]',
    bar: 'bg-[#fce7f3]/70',
    soft: 'bg-[#fdf2f8]',
    border: 'border-[#be185d]/25',
    toneText: 'text-[#be185d]',
    focus: 'focus:ring-[#be185d]/30 focus:border-[#be185d]',
    where:
      'Se envía con el botón «Felicitar» de cada cumpleaños en la sección «Cumpleaños próximos» del panel. En WhatsApp todavía se puede personalizar antes de enviarlo.',
    variables: [{ token: '{nombre}', meaning: 'primer nombre del cliente' }],
  },
  {
    field: 'catalogInquiry',
    settingKey: CATALOG_INQUIRY_TEMPLATE_KEY,
    title: 'Consulta de producto (catálogo)',
    icon: Search,
    chip: 'bg-[#d1fae5] text-[#047857]',
    bar: 'bg-[#d1fae5]/60',
    soft: 'bg-[#ecfdf5]',
    border: 'border-[#047857]/25',
    toneText: 'text-[#047857]',
    focus: 'focus:ring-[#047857]/30 focus:border-[#047857]',
    where:
      'Es el mensaje que el cliente manda a la óptica con los botones «Consultar Disponibilidad» y «Comprar Lentes» del catálogo.',
    variables: [
      { token: '{producto}', meaning: 'nombre del producto' },
      { token: '{referencia}', meaning: 'referencia corta del producto' },
      { token: '{detalle}', meaning: 'opciones de graduación y extras que el cliente eligió (puede ir vacío)' },
    ],
  },
  {
    field: 'lensRequestReply',
    settingKey: LENS_REQUEST_REPLY_TEMPLATE_KEY,
    title: 'Respuesta a solicitud de lentes',
    icon: MessageSquare,
    chip: 'bg-[#fef3c7] text-[#b45309]',
    bar: 'bg-[#fef3c7]/70',
    soft: 'bg-[#fffbeb]',
    border: 'border-[#b45309]/25',
    toneText: 'text-[#b45309]',
    focus: 'focus:ring-[#b45309]/30 focus:border-[#b45309]',
    where:
      'Se envía con el botón de WhatsApp de cada solicitud en la sección «Solicitudes de lentes armados» del panel.',
    variables: [
      { token: '{nombre}', meaning: 'nombre del cliente' },
      { token: '{armazon}', meaning: 'armazón elegido' },
      { token: '{mica}', meaning: 'material de mica elegido' },
      { token: '{notas}', meaning: 'la línea de notas completa; si la solicitud no trae notas, no aparece nada' },
    ],
  },
  {
    field: 'paymentReminder',
    settingKey: PAYMENT_REMINDER_TEMPLATE_KEY,
    title: 'Recordatorio de cobranza',
    icon: TrendingDown,
    chip: 'bg-[#ede9fe] text-[#6d28d9]',
    bar: 'bg-[#ede9fe]/70',
    soft: 'bg-[#f5f3ff]',
    border: 'border-[#6d28d9]/25',
    toneText: 'text-[#6d28d9]',
    focus: 'focus:ring-[#6d28d9]/30 focus:border-[#6d28d9]',
    where:
      'Se envía con el botón «Recordatorio de Cobranza» en la ficha del cliente, cuando tiene saldo pendiente.',
    variables: [
      { token: '{nombre}', meaning: 'nombre completo del cliente' },
      { token: '{saldo}', meaning: 'saldo pendiente, ya con formato de moneda' },
    ],
  },
]

/**
 * Cuadro de texto que se adapta a su contenido (orden del dueño,
 * 2026-11-18): el mensaje se ve SIEMPRE completo, sin corte ni scroll
 * interno — el cuadro crece al montar y con cada tecleo. El +2 compensa
 * el borde de 1px arriba/abajo con box-sizing: border-box.
 */
function AutoResizeTextarea({
  value,
  onChange,
  className = '',
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
  ariaLabel: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={1}
      aria-label={ariaLabel}
      className={`resize-none overflow-hidden ${className}`}
    />
  )
}

function MessageCard({
  spec,
  initialValue,
  initialMonths,
}: {
  spec: MessageCardSpec
  initialValue: string
  /** Solo la tarjeta de recordatorio: el periodo cargado de la
   *  configuración; se guarda junto con la plantilla. */
  initialMonths?: number
}) {
  // Todas las tarjetas nacen MINIMIZADAS (orden del dueño, 2026-11-18):
  // la barra de encabezado — mismo patrón que las secciones del panel —
  // es lo único visible hasta que se toca para expandir.
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [months, setMonths] = useState(initialMonths ?? 6)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = spec.icon
  const isReminder = spec.field === 'reminder'

  // The page loads every template in one pass; if the initial value
  // arrives after mount, adopt it (without clobbering an edit in flight).
  useEffect(() => {
    setValue(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue])

  useEffect(() => {
    if (initialMonths !== undefined) setMonths(initialMonths)
  }, [initialMonths])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      if (isReminder) {
        // Periodo y plantilla se guardan JUNTOS con el mismo servicio
        // de siempre (lib/reminder-config vía lib/services): las dos
        // llaves de app_settings quedan consistentes en una sola acción.
        await saveReminderConfig(months, value)
      } else {
        await saveMessageTemplate(spec.settingKey, value)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3500)
    } catch (err: any) {
      // setAppSetting throws the real database error: show it as-is.
      setError(err?.message || 'No se pudo guardar el mensaje.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-[20px] or-shadow-card p-4 text-left">
      {/* Barra de encabezado con tinte propio: mismo patrón visual que
          las secciones minimizables del panel (chip, título, chevrones). */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`w-full h-[44px] flex items-center gap-2.5 cursor-pointer text-left rounded-xl px-2.5 ${spec.bar}`}
      >
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${spec.chip}`}>
          <Icon className="w-4 h-4" />
        </span>
        <h2 className="flex-1 min-w-0 truncate whitespace-nowrap text-sm font-semibold text-[#111c2d]">{spec.title}</h2>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-[#434653] font-medium leading-relaxed">{spec.where}</p>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-[11px] font-bold text-[#737784]">Variables:</span>
            {spec.variables.map(v => (
              <span
                key={v.token}
                title={v.meaning}
                className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${spec.soft} ${spec.toneText}`}
              >
                {v.token}
              </span>
            ))}
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {spec.variables.map(v => (
              <li key={v.token} className="text-[11px] text-[#737784] font-medium">
                <span className={`font-bold ${spec.toneText}`}>{v.token}</span> — {v.meaning}
              </li>
            ))}
          </ul>

          {isReminder && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <label htmlFor="reminder-months" className="text-xs font-semibold text-[#434653]">
                Recordar cada
              </label>
              <input
                id="reminder-months"
                type="number"
                min={1}
                max={36}
                value={months}
                onChange={e => setMonths(Math.max(1, parseInt(e.target.value || '6', 10) || 6))}
                className="w-16 h-9 bg-white border border-[#cbd5e1] rounded-lg px-2.5 text-sm font-bold text-center text-[#111c2d] focus:border-[#00357f] outline-none"
              />
              <span className="text-xs text-[#737784] font-medium">meses desde el último examen</span>
            </div>
          )}

          <AutoResizeTextarea
            value={value}
            onChange={setValue}
            ariaLabel={`Mensaje: ${spec.title}`}
            className={`w-full mt-3 rounded-xl border px-3 py-2.5 text-sm text-[#111c2d] leading-relaxed focus:outline-none focus:ring-2 ${spec.soft} ${spec.border} ${spec.focus}`}
          />

          {spec.note && (
            <p className="text-[11px] text-[#737784] font-medium leading-relaxed mt-2">{spec.note}</p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[11px] font-bold bg-[#ffdad6] text-[#93000a]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#00357f] hover:bg-[#004aad] disabled:opacity-60 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {saved && (
              <span role="status" className="flex items-center gap-1.5 text-xs font-bold text-[#00422b]">
                <CheckCircle2 className="w-4 h-4" />
                Guardado
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default function MensajesPage() {
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Record<TemplateField, string>>({
    reminder: '',
    birthday: '',
    catalogInquiry: '',
    lensRequestReply: '',
    paymentReminder: '',
  })
  const [reminderMonths, setReminderMonths] = useState(6)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadError(null)
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
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
          const [loaded, reminderCfg] = await Promise.all([
            getMessageTemplates(),
            getReminderConfig(),
          ])
          setTemplates(loaded)
          setReminderMonths(reminderCfg.months)
        }
      } catch (err: any) {
        console.error('Error loading message templates:', err)
        setLoadError(err?.message || 'No se pudieron cargar los mensajes.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const header = (
    <PageHeader
      title="Mensajes"
      mobileActions={
        <Link
          href="/dashboard/admin"
          aria-label="Volver al panel"
          className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
      }
    >
      <div className="flex items-center gap-2.5 border-b border-[#e7eeff] pb-3">
        <Link
          href="/dashboard/admin"
          aria-label="Volver al panel"
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
          <MessagesSquare className="w-4.5 h-4.5" />
        </span>
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-[#00357f] tracking-tight">Mensajes</h1>
          <p className="text-xs text-[#434653] font-medium">
            Todos los mensajes de WhatsApp de la app, en un solo lugar.
          </p>
        </div>
      </div>
    </PageHeader>
  )

  if (loading) {
    return (
      <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
        {header}
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs font-bold text-[#737784] uppercase tracking-wider">Cargando mensajes…</p>
        </div>
      </main>
    )
  }

  if (!canManage) {
    return (
      <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
        {header}
        <div className="mt-4 md:mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Los mensajes los edita <strong>solo el administrador</strong> (dueño).
              El vendedor vende; si necesitas cambiar un mensaje, pídelo al administrador.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {loadError && (
        <div role="alert" className="mt-4 md:mt-6 bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-bold text-[#93000a]">No se pudieron cargar los mensajes</h2>
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

      <div className="mt-4 md:mt-6 space-y-4 sm:space-y-5">
        {MESSAGE_CARDS.map(spec => (
          <MessageCard
            key={spec.field}
            spec={spec}
            initialValue={templates[spec.field]}
            initialMonths={spec.field === 'reminder' ? reminderMonths : undefined}
          />
        ))}
      </div>

      <p className="text-[11px] text-[#737784] font-medium leading-relaxed mt-5">
        Lo que guardes aquí se aplica en cuanto se usa cada mensaje: no hay que guardar nada más en
        ningún otro lugar. En WhatsApp, ya con el chat abierto, el texto todavía se puede ajustar
        antes de enviarlo.
      </p>
    </main>
  )
}
