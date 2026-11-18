'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BellRing,
  Cake,
  CheckCircle2,
  Lock,
  MessagesSquare,
  MessageSquare,
  Save,
  Search,
  TrendingDown,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { normalizeRole } from '@/lib/roles'
import { getMessageTemplates, saveMessageTemplate } from '@/lib/services'
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
// and the payment reminder, and vice versa (the Reminders tray modal
// edits the very same `reminder_template` key).
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
  chip: string
  where: string
  variables: { token: string; meaning: string }[]
  note?: string
  rows: number
}

const MESSAGE_CARDS: MessageCardSpec[] = [
  {
    field: 'reminder',
    settingKey: REMINDER_TEMPLATE_KEY,
    title: 'Recordatorio de examen',
    icon: BellRing,
    chip: 'bg-[#dee8ff] text-[#00357f]',
    where:
      'Se envía desde la bandeja de Recordatorios del panel y con el botón «Enviar Recordatorio de Examen» en la ficha del cliente.',
    variables: [
      { token: '{nombre}', meaning: 'primer nombre del cliente' },
      { token: '{meses}', meaning: 'meses desde su último examen (el periodo configurado)' },
    ],
    note: 'El periodo («recordar cada X meses») se ajusta en la sección Recordatorios del panel; este texto es el mismo que se edita en el modal de esa sección.',
    rows: 6,
  },
  {
    field: 'birthday',
    settingKey: BIRTHDAY_TEMPLATE_KEY,
    title: 'Felicitación de cumpleaños',
    icon: Cake,
    chip: 'bg-[#e6f5fb] text-[#0899c9]',
    where:
      'Se envía con el botón «Felicitar» de cada cumpleaños en la sección «Cumpleaños próximos» del panel. En WhatsApp todavía se puede personalizar antes de enviarlo.',
    variables: [{ token: '{nombre}', meaning: 'primer nombre del cliente' }],
    rows: 4,
  },
  {
    field: 'catalogInquiry',
    settingKey: CATALOG_INQUIRY_TEMPLATE_KEY,
    title: 'Consulta de producto (catálogo)',
    icon: Search,
    chip: 'bg-[#e2f9ee] text-[#00422b]',
    where:
      'Es el mensaje que el cliente manda a la óptica con los botones «Consultar Disponibilidad» y «Comprar Lentes» del catálogo.',
    variables: [
      { token: '{producto}', meaning: 'nombre del producto' },
      { token: '{referencia}', meaning: 'referencia corta del producto' },
      { token: '{detalle}', meaning: 'opciones de graduación y extras que el cliente eligió (puede ir vacío)' },
    ],
    rows: 4,
  },
  {
    field: 'lensRequestReply',
    settingKey: LENS_REQUEST_REPLY_TEMPLATE_KEY,
    title: 'Respuesta a solicitud de lentes',
    icon: MessageSquare,
    chip: 'bg-[#fef3c7] text-[#92400e]',
    where:
      'Se envía con el botón de WhatsApp de cada solicitud en la sección «Solicitudes de lentes armados» del panel.',
    variables: [
      { token: '{nombre}', meaning: 'nombre del cliente' },
      { token: '{armazon}', meaning: 'armazón elegido' },
      { token: '{mica}', meaning: 'material de mica elegido' },
      { token: '{notas}', meaning: 'la línea de notas completa; si la solicitud no trae notas, no aparece nada' },
    ],
    rows: 6,
  },
  {
    field: 'paymentReminder',
    settingKey: PAYMENT_REMINDER_TEMPLATE_KEY,
    title: 'Recordatorio de cobranza',
    icon: TrendingDown,
    chip: 'bg-[#ffdad6] text-[#ba1a1a]',
    where:
      'Se envía con el botón «Recordatorio de Cobranza» en la ficha del cliente, cuando tiene saldo pendiente.',
    variables: [
      { token: '{nombre}', meaning: 'nombre completo del cliente' },
      { token: '{saldo}', meaning: 'saldo pendiente, ya con formato de moneda' },
    ],
    rows: 5,
  },
]

function MessageCard({
  spec,
  initialValue,
}: {
  spec: MessageCardSpec
  initialValue: string
}) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = spec.icon

  // The page loads every template in one pass; if the initial value
  // arrives after mount, adopt it (without clobbering an edit in flight).
  useEffect(() => {
    setValue(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await saveMessageTemplate(spec.settingKey, value)
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
    <section className="bg-white rounded-[20px] or-shadow-card p-4 sm:p-5 text-left">
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${spec.chip}`}>
          <Icon className="w-5 h-5" />
        </span>
        <h2 className="text-base font-semibold text-[#111c2d]">{spec.title}</h2>
      </div>

      <p className="text-xs text-[#434653] font-medium leading-relaxed mt-3">{spec.where}</p>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="text-[11px] font-bold text-[#737784]">Variables:</span>
        {spec.variables.map(v => (
          <span
            key={v.token}
            title={v.meaning}
            className="text-[11px] font-bold bg-[#f0f3ff] text-[#00357f] rounded-md px-1.5 py-0.5"
          >
            {v.token}
          </span>
        ))}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {spec.variables.map(v => (
          <li key={v.token} className="text-[11px] text-[#737784] font-medium">
            <span className="font-bold text-[#434653]">{v.token}</span> — {v.meaning}
          </li>
        ))}
      </ul>

      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={spec.rows}
        aria-label={`Mensaje: ${spec.title}`}
        className="w-full mt-3 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#111c2d] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f]"
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
          const loaded = await getMessageTemplates()
          setTemplates(loaded)
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
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
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
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
        {header}
        <div className="mt-6 bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
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
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      {header}

      {loadError && (
        <div role="alert" className="mt-6 bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
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

      <div className="mt-6 space-y-4 sm:space-y-5">
        {MESSAGE_CARDS.map(spec => (
          <MessageCard key={spec.field} spec={spec} initialValue={templates[spec.field]} />
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
