'use client'

import { useEffect, useRef, useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createClinicalExamAction, CreateExamState } from '@/app/customers/actions'
import { getCustomerById } from '@/lib/services'
import { createClient } from '@/utils/supabase/client'
import {
  CLINICAL_LEAD_NAME,
  CLINICAL_LEAD_FOLIO,
  calculateAge,
  type HypertensionDiabetes,
} from '@/lib/clinical-history'

const initialState: CreateExamState = { error: null, success: null, examId: null }

const inputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm text-[#111c2d] placeholder-[#737784]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const smallInputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-lg px-2 py-2 min-h-[40px] text-sm text-center text-[#111c2d] placeholder-[#737784]/60 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const labelClasses = 'block text-[13px] font-semibold text-[#434653] mb-2'
const questionClasses = 'block text-[13px] font-semibold text-[#434653] mb-2'

function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Pastillas de respuesta (Sí/No y opciones cortas): el valor viaja al
 * FormData en un input oculto; tocar la opción activa la desmarca,
 * para poder dejar la pregunta sin responder como en la hoja.
 */
function PillGroup({
  name,
  value,
  onChange,
  options,
  disabled,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? '' : o.value)}
            className={`min-h-[40px] px-4 rounded-full border text-[13px] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
              active
                ? 'bg-[#00357f] border-[#00357f] text-white'
                : 'bg-[#f9f9ff] border-[#dee8ff] text-[#434653] hover:border-[#00357f]/50'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const YES_NO = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
]

/** Esfera / Cilindro / Eje / Adición de un ojo, con el prefijo dado. */
function GraduationFields({
  nameBase,
  disabled,
}: {
  nameBase: string
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <label className={labelClasses}>Esfera</label>
        <input name={`${nameBase}_sphere`} type="number" step="0.25" disabled={disabled} placeholder="Ej. -1.25" className={inputClasses} />
      </div>
      <div>
        <label className={labelClasses}>Cilindro</label>
        <input name={`${nameBase}_cylinder`} type="number" step="0.25" disabled={disabled} placeholder="Ej. -0.50" className={inputClasses} />
      </div>
      <div>
        <label className={labelClasses}>Eje (°)</label>
        <input name={`${nameBase}_axis`} type="number" min="0" max="180" disabled={disabled} placeholder="Ej. 90" className={inputClasses} />
      </div>
      <div>
        <label className={labelClasses}>Adición</label>
        <input name={`${nameBase}_add`} type="number" step="0.25" min="0" disabled={disabled} placeholder="Ej. 2.00" className={inputClasses} />
      </div>
    </div>
  )
}

function SectionHeader({ color, title, hint }: { color: string; title: string; hint?: string }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="text-base font-bold text-[#111c2d]">{title}</h2>
      </div>
      {hint && <p className="text-xs text-[#737784] font-medium mt-1 ml-[18px]">{hint}</p>}
    </div>
  )
}

interface ClinicalExamFormProps {
  customerId: string
  /**
   * Optional success hook. Without it the form keeps the original
   * ficha flow: success banner + redirect back to the customer file
   * after 2s. The quick-access page (/dashboard/exams/new) passes it
   * to show its own confirmation panel instead of redirecting.
   */
  onSuccess?: () => void
}

/**
 * THE clinical exam form — since 2026-11-19 it IS the business's real
 * paper form («Historia clínica», in the sheet's own order) posting to
 * createClinicalExamAction: the single implementation shared by the
 * customer file flow (/customers/[id]/exam/new) and the bottom-bar
 * quick access (/dashboard/exams/new). Do not fork it.
 *
 * Sheet order: encabezado (responsable/folio) · Paciente (fecha,
 * nombre, nacimiento/edad) · Antecedentes · Agudeza visual ·
 * Retinoscopía · DIP por ojo · RX · RX Final · Observaciones ·
 * Adicional (lo que la app ya tenía) · Firma de optometrista.
 *
 * RX FINAL is the vigente graduation and keeps the legacy field names
 * (od_sphere, oi_sphere, ...) so it lands in the columns that feed
 * sales and history; RX (initial) and everything else from the sheet
 * travels with hc_/rx_ names into clinical_exams.clinical_history.
 */
export default function ClinicalExamForm({ customerId, onSuccess }: ClinicalExamFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<CreateExamState, FormData>(createClinicalExamAction, initialState)
  const notifiedRef = useRef(false)

  // Datos del paciente para la sección «Paciente» (nombre, nacimiento
  // y ocupación vienen de su expediente, no se vuelven a pedir).
  const [customerInfo, setCustomerInfo] = useState<any>(null)
  const [customerLoaded, setCustomerLoaded] = useState(false)
  // Quién realiza el examen (usuario de la sesión), para el pie de firma.
  const [examinerName, setExaminerName] = useState('')

  // Respuestas en pastillas y DIP (el resto del formulario es libre).
  const [bothersLights, setBothersLights] = useState('')
  const [usedGlasses, setUsedGlasses] = useState('')
  const [eyeSurgery, setEyeSurgery] = useState('')
  const [hypertensionDiabetes, setHypertensionDiabetes] = useState('')
  const [medications, setMedications] = useState('')
  const [familyGlasses, setFamilyGlasses] = useState('')
  const [dipOd, setDipOd] = useState('')
  const [dipOi, setDipOi] = useState('')

  useEffect(() => {
    if (!state?.success) return
    if (onSuccess) {
      if (!notifiedRef.current) {
        notifiedRef.current = true
        onSuccess()
      }
      return
    }
    const timer = setTimeout(() => {
      router.push(`/customers/${customerId}`)
    }, 2000)
    return () => clearTimeout(timer)
  }, [state?.success, customerId, router, onSuccess])

  useEffect(() => {
    let cancelled = false
    getCustomerById(customerId)
      .then(c => {
        if (!cancelled) {
          setCustomerInfo(c)
          setCustomerLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerLoaded(true)
      })
    return () => { cancelled = true }
  }, [customerId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!cancelled && user) {
          setExaminerName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
        }
      } catch {
        // Sin sesión legible (modo demo): el pie muestra el genérico.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const customerProfile = customerInfo?.customer_profiles || null
  const dateOfBirth: string | null = customerProfile?.date_of_birth
    ? String(customerProfile.date_of_birth).slice(0, 10)
    : null
  const age = dateOfBirth ? calculateAge(dateOfBirth) : null

  // DIP total (lejana): suma de los monoculares capturados; es el
  // valor que se guarda en pd_distance, como siempre.
  const dipOdNum = dipOd.trim() === '' ? null : parseFloat(dipOd)
  const dipOiNum = dipOi.trim() === '' ? null : parseFloat(dipOi)
  const dipTotal =
    dipOdNum !== null && Number.isFinite(dipOdNum) || dipOiNum !== null && Number.isFinite(dipOiNum)
      ? Math.round(((dipOdNum || 0) + (dipOiNum || 0)) * 10) / 10
      : null

  const vaRows: { label: string; prefix: string }[] = [
    { label: 'AV S/C Lejos', prefix: 'hc_va_sc_far' },
    { label: 'AV S/C Cerca', prefix: 'hc_va_sc_near' },
    { label: 'AV C/C Lejos', prefix: 'hc_va_cc_far' },
    { label: 'AV C/C Cerca', prefix: 'hc_va_cc_near' },
  ]

  return (
    <>
      {/* Feedback Messages */}
      {state?.success && (
        <div className="bg-[#e2f9ee] rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#00422b] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-[#00422b]">¡Examen guardado exitosamente!</p>
            <p className="text-xs text-[#00422b] opacity-80 mt-0.5">Redirigiendo de vuelta al expediente clínico...</p>
          </div>
        </div>
      )}
      {state?.error && (
        <div className="bg-[#ffdad6] rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-[#ba1a1a] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-[#ba1a1a]">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="customerId" value={customerId} />

        {/* ENCABEZADO DE LA HOJA */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6">
          <h2 className="text-lg font-extrabold text-[#00357f] tracking-tight">Historia clínica</h2>
          <div className="mt-3 space-y-1 text-[13px] font-medium text-[#434653]">
            <p>
              Responsable clínico:{' '}
              <strong className="text-[#111c2d] font-bold">{CLINICAL_LEAD_NAME}</strong>
            </p>
            <p>
              Folio SEP CONOCER:{' '}
              <strong className="text-[#111c2d] font-bold">{CLINICAL_LEAD_FOLIO}</strong>
            </p>
          </div>
        </section>

        {/* PACIENTE (hoja 1–3) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
          <SectionHeader color="#00357f" title="Paciente" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Fecha</label>
              <input name="exam_date" type="date" defaultValue={todayLocal()} disabled={isPending} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Nombre de paciente</label>
              <div className="w-full bg-[#f0f3ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm font-semibold text-[#111c2d] flex items-center">
                {customerInfo?.full_name || (customerLoaded ? '—' : 'Cargando…')}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClasses}>Fecha de nacimiento</label>
            {dateOfBirth ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-[#f0f3ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm font-semibold text-[#111c2d] flex items-center">
                  {new Date(`${dateOfBirth}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                {age !== null && (
                  <span className="bg-[#dee8ff] text-[#00357f] px-3 py-1.5 rounded-full text-xs font-bold">
                    Edad: {age} años
                  </span>
                )}
              </div>
            ) : customerLoaded ? (
              <>
                <input name="patient_dob" type="date" disabled={isPending} className={inputClasses} />
                <p className="text-[11px] text-[#737784] font-medium mt-1.5">
                  No estaba registrada en su expediente; si la capturas, queda guardada.
                </p>
              </>
            ) : (
              <div className="bg-[#f0f3ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-sm text-[#737784] flex items-center">
                Cargando…
              </div>
            )}
          </div>
        </section>

        {/* ANTECEDENTES (hoja 4–13, en orden) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
          <SectionHeader color="#00509e" title="Antecedentes" />
          <div>
            <span className={questionClasses}>¿Le molestan las luces?</span>
            <PillGroup name="hc_bothers_lights" value={bothersLights} onChange={setBothersLights} options={YES_NO} disabled={isPending} />
          </div>
          <div>
            <span className={questionClasses}>¿Ha usado lentes antes?</span>
            <PillGroup name="hc_used_glasses" value={usedGlasses} onChange={setUsedGlasses} options={YES_NO} disabled={isPending} />
          </div>
          {usedGlasses === 'si' && (
            <div>
              <label className={labelClasses}>¿Cuánto tiempo tiene con ellos?</label>
              <input name="hc_glasses_time" type="text" disabled={isPending} placeholder="Ej. 3 años" className={inputClasses} />
            </div>
          )}
          <div>
            <label className={labelClasses}>Fecha del último examen</label>
            <input name="hc_last_exam_date" type="date" disabled={isPending} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>¿A qué se dedica?</label>
            <input
              name="hc_occupation"
              type="text"
              disabled={isPending}
              placeholder="Ej. Chofer, estudiante, oficina…"
              defaultValue={customerProfile?.occupation || ''}
              key={customerLoaded ? 'occupation-loaded' : 'occupation-loading'}
              className={inputClasses}
            />
          </div>
          <div>
            <span className={questionClasses}>¿Tiene cirugías en sus ojos?</span>
            <PillGroup name="hc_eye_surgery" value={eyeSurgery} onChange={setEyeSurgery} options={YES_NO} disabled={isPending} />
          </div>
          {eyeSurgery === 'si' && (
            <div>
              <label className={labelClasses}>¿Cuál cirugía?</label>
              <input name="hc_eye_surgery_detail" type="text" disabled={isPending} placeholder="Ej. Cataratas, LASIK…" className={inputClasses} />
            </div>
          )}
          <div>
            <span className={questionClasses}>Hipertensión o diabetes</span>
            <PillGroup
              name="hc_hypertension_diabetes"
              value={hypertensionDiabetes}
              onChange={v => setHypertensionDiabetes(v as HypertensionDiabetes | '')}
              options={[
                { value: 'ninguna', label: 'Ninguna' },
                { value: 'hipertension', label: 'Hipertensión' },
                { value: 'diabetes', label: 'Diabetes' },
                { value: 'ambas', label: 'Ambas' },
              ]}
              disabled={isPending}
            />
          </div>
          <div>
            <span className={questionClasses}>¿Toma medicamentos?</span>
            <PillGroup name="hc_medications" value={medications} onChange={setMedications} options={YES_NO} disabled={isPending} />
          </div>
          {medications === 'si' && (
            <div>
              <label className={labelClasses}>¿Cuáles medicamentos?</label>
              <input name="hc_medications_detail" type="text" disabled={isPending} placeholder="Ej. Metformina, Losartán…" className={inputClasses} />
            </div>
          )}
          <div>
            <span className={questionClasses}>¿Algún familiar usa lentes?</span>
            <PillGroup name="hc_family_glasses" value={familyGlasses} onChange={setFamilyGlasses} options={YES_NO} disabled={isPending} />
          </div>
          <div>
            <label className={labelClasses}>Tiempo de uso de aparatos electrónicos</label>
            <input name="hc_screen_time" type="text" disabled={isPending} placeholder="Ej. 8 horas al día" className={inputClasses} />
          </div>
        </section>

        {/* AGUDEZA VISUAL (hoja 14–17) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
          <SectionHeader color="#0899c9" title="Agudeza visual" hint="Sin corrección (S/C) y con corrección (C/C), de lejos y de cerca." />
          <div className="grid grid-cols-[minmax(86px,1.1fr)_1fr_1fr_1fr] gap-2 items-center">
            <div />
            {['OD', 'OI', 'AO'].map(h => (
              <div key={h} className="text-center text-[10px] font-black uppercase tracking-wider text-[#00357f] bg-[#eef4ff] rounded-lg py-1.5">
                {h}
              </div>
            ))}
            {vaRows.map(row => (
              <div key={row.prefix} className="contents">
                <span className="text-xs font-bold text-[#434653] leading-tight">{row.label}</span>
                {(['od', 'oi', 'ao'] as const).map(col => (
                  <input
                    key={col}
                    name={`${row.prefix}_${col}`}
                    type="text"
                    disabled={isPending}
                    placeholder="20/20"
                    aria-label={`${row.label} ${col.toUpperCase()}`}
                    className={smallInputClasses}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* RETINOSCOPÍA (hoja 18) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
          <SectionHeader color="#0899c9" title="Retinoscopía" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>OD</label>
              <input name="hc_retinoscopy_od" type="text" disabled={isPending} placeholder="Ej. -1.50" className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>OI</label>
              <input name="hc_retinoscopy_oi" type="text" disabled={isPending} placeholder="Ej. -1.75" className={inputClasses} />
            </div>
          </div>
        </section>

        {/* DIP (hoja 19) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
          <SectionHeader color="#0899c9" title="DIP" hint="Distancia interpupilar por ojo, en milímetros. El total se guarda como la DIP lejana de siempre." />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>DIP OD (mm)</label>
              <input
                name="hc_dip_od"
                type="number"
                step="0.5"
                min="0"
                value={dipOd}
                onChange={e => setDipOd(e.target.value)}
                disabled={isPending}
                placeholder="Ej. 31.5"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>DIP OI (mm)</label>
              <input
                name="hc_dip_oi"
                type="number"
                step="0.5"
                min="0"
                value={dipOi}
                onChange={e => setDipOi(e.target.value)}
                disabled={isPending}
                placeholder="Ej. 31.5"
                className={inputClasses}
              />
            </div>
          </div>
          <input type="hidden" name="pd_distance" value={dipTotal !== null ? String(dipTotal) : ''} />
          <p className="text-[13px] font-semibold text-[#434653]">
            DIP total (lejana):{' '}
            <strong className="text-[#00357f] font-mono">{dipTotal !== null ? `${dipTotal} mm` : '—'}</strong>
          </p>
        </section>

        {/* RX (hoja 20) — medición inicial */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
          <SectionHeader color="#00509e" title="RX" hint="Medición inicial del examen." />
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-[#00357f]">Ojo Derecho (OD)</p>
            <GraduationFields nameBase="rx_od" disabled={isPending} />
          </div>
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-[#00668a]">Ojo Izquierdo (OI)</p>
            <GraduationFields nameBase="rx_oi" disabled={isPending} />
          </div>
        </section>

        {/* RX FINAL (hoja 21) — la graduación vigente */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
          <SectionHeader
            color="#00357f"
            title="RX Final"
            hint="La graduación vigente: con esta se elaboran los lentes y queda en el historial del cliente."
          />
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-[#00357f]">Ojo Derecho (OD)</p>
            <GraduationFields nameBase="od" disabled={isPending} />
          </div>
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-[#00668a]">Ojo Izquierdo (OI)</p>
            <GraduationFields nameBase="oi" disabled={isPending} />
          </div>
        </section>

        {/* OBSERVACIONES (hoja 22) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-4">
          <SectionHeader color="#737784" title="Observaciones" />
          <textarea
            name="hc_observations"
            rows={3}
            disabled={isPending}
            placeholder="Observaciones del examen…"
            className={`${inputClasses} resize-none`}
          />
        </section>

        {/* ADICIONAL — lo que la app ya tenía (orden del dueño:
            el formato de papel manda y esto va después, como adicional) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-5">
          <SectionHeader color="#0899c9" title="Adicional" hint="Datos ópticos y recomendaciones que la app ya capturaba." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Distancia Pupilar (Cercana - mm)</label>
              <input name="pd_near" type="number" step="0.1" disabled={isPending} placeholder="Ej. 59" className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Tipo de Lente Sugerido</label>
              <select name="lens_type" disabled={isPending} className={inputClasses}>
                <option value="ninguno">Ninguno</option>
                <option value="monofocal">Monofocal</option>
                <option value="bifocal">Bifocal</option>
                <option value="progresivo">Progresivo</option>
                <option value="contacto">Lentes de Contacto</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Presión Intraocular OD (mmHg)</label>
              <input name="intraocular_pressure_od" type="number" step="0.1" disabled={isPending} placeholder="Ej. 14.5" className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Presión Intraocular OI (mmHg)</label>
              <input name="intraocular_pressure_oi" type="number" step="0.1" disabled={isPending} placeholder="Ej. 15.0" className={inputClasses} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClasses}>Tratamiento Sugerido</label>
              <input name="treatment" type="text" disabled={isPending} placeholder="Ej. Antireflejante, Fotocromático" className={inputClasses} />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Armazón Recomendado</label>
            <input name="frame_recommendation" type="text" disabled={isPending} placeholder="Ej. Armazón metálico de pasta rectangular negro" className={inputClasses} />
          </div>

          <div>
            <label className={labelClasses}>Próxima Cita Sugerida</label>
            <input name="next_exam_date" type="date" disabled={isPending} className={inputClasses} />
          </div>

          <div>
            <label className={labelClasses}>Observaciones Clínicas</label>
            <textarea name="clinical_notes" rows={3} disabled={isPending} placeholder="Detalles de salud ocular, patologías o sugerencias especiales..." className={`${inputClasses} resize-none`} />
          </div>
        </section>

        {/* FIRMA DE OPTOMETRISTA (cierre de la hoja) */}
        <section className="bg-white rounded-[20px] or-shadow-card p-6 space-y-3">
          <SectionHeader color="#434653" title="Firma de optometrista" />
          <div className="text-[13px] font-medium text-[#434653] space-y-1">
            <p>
              Responsable clínico: <strong className="text-[#111c2d] font-bold">{CLINICAL_LEAD_NAME}</strong>
            </p>
            <p>
              Folio SEP CONOCER: <strong className="text-[#111c2d] font-bold">{CLINICAL_LEAD_FOLIO}</strong>
            </p>
            <p>
              Realiza el examen: <strong className="text-[#111c2d] font-bold">{examinerName || 'Optometrista en turno'}</strong>
            </p>
          </div>
          <div className="pt-6">
            <div className="border-b border-[#434653]/50 max-w-xs" />
            <p className="text-[10px] text-[#737784] font-bold uppercase tracking-wider mt-1.5">Firma</p>
          </div>
        </section>

        {/* GUARDAR BUTTON */}
        <button type="submit" disabled={isPending || !!state?.success}
          className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[48px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm">
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando Examen...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Guardar Examen Clínico
            </>
          )}
        </button>
      </form>
    </>
  )
}
