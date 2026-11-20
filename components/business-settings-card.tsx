'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronDown, Percent, ShieldAlert, Store } from 'lucide-react'
import { isAdminRole } from '@/lib/roles'
import {
  getBusinessSettings,
  updateBusinessSettings,
  getMemberDiscountPercent,
  saveMemberDiscountPercent,
  getBirthdayDiscountExtraPercent,
  saveBirthdayDiscountExtraPercent,
  type BusinessSettings,
} from '@/lib/services'
import { saveCatalogDiscountsAction } from '@/app/dashboard/admin/datos-optica/actions'

const inputClasses =
  'w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-4 py-3 min-h-[44px] text-[13px] text-[#111c2d] placeholder-[#737784]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-all disabled:opacity-50'

const labelClasses = 'block text-xs font-semibold text-[#434653] mb-2'

/**
 * «Datos de la óptica» — the business identity card (name, address,
 * phone, WhatsApp, email; currency fixed; opening hours READ-ONLY,
 * generated from «Configurar horario»).
 *
 * It used to live inside the Profile; the owner ordered it out on
 * 2026-11-19 («eso quítalo de ahí, y mándalo a Configuración»): the
 * card itself is unchanged («ese cuadro está bien») and now renders
 * on its own page, /dashboard/admin/datos-optica. Only owner /
 * super_admin may save — the check runs again in the save handler,
 * hiding the form is not the control.
 */
export default function BusinessSettingsCard({ role }: { role: string }) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [businessFeedback, setBusinessFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [open, setOpen] = useState(true)

  // «Descuento de cliente en el catálogo» (dictado del dueño,
  // 2026-11-19): el % general que el cliente conectado ve en SU
  // catálogo y el extra de su mes de cumpleaños, editables AQUÍ — en
  // Configuración, no en Promociones. Es solo la vista del cliente:
  // en la venta (POS) ningún descuento se aplica automáticamente.
  const [memberPct, setMemberPct] = useState('')
  const [birthdayExtraPct, setBirthdayExtraPct] = useState('')
  const [discountsLoaded, setDiscountsLoaded] = useState(false)
  const [savingDiscounts, setSavingDiscounts] = useState(false)
  const [discountFeedback, setDiscountFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadBusiness() {
      try {
        const data = await getBusinessSettings()
        if (!cancelled) setBusiness(data)
      } catch {
        if (!cancelled) {
          setBusinessFeedback({
            type: 'error',
            text: 'No se pudieron cargar los datos de la óptica.',
          })
        }
      }
    }
    loadBusiness()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadDiscounts() {
      try {
        const [general, extra] = await Promise.all([
          getMemberDiscountPercent(),
          getBirthdayDiscountExtraPercent(),
        ])
        if (!cancelled) {
          setMemberPct(String(general))
          setBirthdayExtraPct(String(extra))
          setDiscountsLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setDiscountFeedback({
            type: 'error',
            text: 'No se pudieron cargar los descuentos del catálogo.',
          })
        }
      }
    }
    loadDiscounts()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveDiscounts = async (e: React.FormEvent) => {
    e.preventDefault()
    // Misma puerta de rol de la página: solo owner / super_admin, y se
    // vuelve a verificar en el servidor al guardar (acción de servidor).
    if (!isAdminRole(role)) {
      setDiscountFeedback({
        type: 'error',
        text: 'Solo un administrador puede modificar los descuentos del catálogo.',
      })
      return
    }
    const general = Number(memberPct)
    const extra = Number(birthdayExtraPct)
    const isValidPercent = (n: number) => Number.isInteger(n) && n >= 0 && n <= 90
    if (!isValidPercent(general) || !isValidPercent(extra)) {
      setDiscountFeedback({
        type: 'error',
        text: 'Los porcentajes deben ser números enteros entre 0 y 90.',
      })
      return
    }
    setSavingDiscounts(true)
    setDiscountFeedback(null)
    try {
      const isDemo =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (isDemo) {
        // Modo demo: no hay base ni sesión que verificar; el almacén
        // local de configuración es la única fuente (mismo criterio
        // que el resto de la tarjeta).
        await saveMemberDiscountPercent(general)
        await saveBirthdayDiscountExtraPercent(extra)
      } else {
        const result = await saveCatalogDiscountsAction(general, extra)
        if (!result.success) throw new Error(result.error)
      }
      setDiscountFeedback({
        type: 'success',
        text: 'Descuentos del catálogo guardados correctamente.',
      })
    } catch (err) {
      setDiscountFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudieron guardar los descuentos del catálogo.',
      })
    } finally {
      setSavingDiscounts(false)
    }
  }

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    // Hard permission check: only owner / super_admin may save, verified
    // again here in the handler — hiding the form is not the control.
    if (!isAdminRole(role) || !business) {
      setBusinessFeedback({
        type: 'error',
        text: 'Solo un administrador puede modificar los datos de la óptica.',
      })
      return
    }
    setSavingBusiness(true)
    setBusinessFeedback(null)
    try {
      await updateBusinessSettings(business)
      setBusinessFeedback({
        type: 'success',
        text: 'Datos de la óptica guardados correctamente.',
      })
    } catch (err) {
      setBusinessFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudieron guardar los datos de la óptica.',
      })
    } finally {
      setSavingBusiness(false)
    }
  }

  const businessFields: {
    key: keyof BusinessSettings
    label: string
    type: 'text' | 'tel' | 'email'
    placeholder: string
    fullWidth?: boolean
  }[] = [
    { key: 'name', label: 'Nombre de la óptica', type: 'text', placeholder: 'Óptica Rayo' },
    { key: 'address', label: 'Dirección', type: 'text', placeholder: 'Calle, número y colonia', fullWidth: true },
    { key: 'city', label: 'Ciudad', type: 'text', placeholder: 'Ciudad' },
    { key: 'state', label: 'Estado', type: 'text', placeholder: 'Estado' },
    { key: 'country', label: 'País', type: 'text', placeholder: 'País' },
    { key: 'phone', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de la óptica' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: 'Número de WhatsApp' },
    { key: 'email', label: 'Correo', type: 'email', placeholder: 'correo@optica.com' },
  ]

  return (
    <div className="bg-white rounded-[20px] or-shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-4 min-h-[52px] text-left cursor-pointer"
      >
        <Store className="w-[18px] h-[18px] text-[#00357f] shrink-0" />
        <h2 className="flex-1 text-[15px] font-bold text-[#111c2d]">
          Datos de la óptica
        </h2>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[#737784] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-4 border-t border-[#e7eeff] space-y-4 animate-in fade-in duration-150">

          <p className="text-[13px] text-[#434653] font-medium">
            Estos datos identifican a la óptica en el sistema. Solo los administradores pueden modificarlos.
          </p>

          {businessFeedback && (
            <div
              className={`rounded-xl p-3 flex items-center gap-3 ${
                businessFeedback.type === 'success' ? 'bg-[#e2f9ee]' : 'bg-[#ffdad6]'
              }`}
            >
              {businessFeedback.type === 'success' ? (
                <CheckCircle className="w-[18px] h-[18px] text-[#00422b] shrink-0" />
              ) : (
                <ShieldAlert className="w-[18px] h-[18px] text-[#ba1a1a] shrink-0" />
              )}
              <p
                className={`text-[13px] font-semibold leading-normal ${
                  businessFeedback.type === 'success' ? 'text-[#00422b]' : 'text-[#ba1a1a]'
                }`}
              >
                {businessFeedback.text}
              </p>
            </div>
          )}

          {business ? (
            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {businessFields.map((field) => (
                  <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : undefined}>
                    <label htmlFor={`business-${field.key}`} className={labelClasses}>
                      {field.label}
                    </label>
                    <input
                      id={`business-${field.key}`}
                      type={field.type}
                      value={business[field.key]}
                      onChange={(e) =>
                        setBusiness({ ...business, [field.key]: e.target.value })
                      }
                      disabled={savingBusiness}
                      placeholder={field.placeholder}
                      className={inputClasses}
                    />
                  </div>
                ))}

                {/* Currency is fixed for now (not editable in this pass) */}
                <div>
                  <span className={labelClasses}>Moneda</span>
                  <div className="w-full bg-[#f0f3ff] rounded-xl px-4 py-3 min-h-[44px] flex items-center text-[13px] font-semibold text-[#434653]">
                    Peso Mexicano (MXN)
                  </div>
                </div>

                {/* Opening hours are READ-ONLY here: the summary is
                    generated from «Configurar horario» (per-day
                    schedule), never typed by hand. */}
                <div className="sm:col-span-2">
                  <span className={labelClasses}>Horario de atención</span>
                  <div className="w-full bg-[#f0f3ff] rounded-xl px-4 py-3 min-h-[44px] flex items-center text-[13px] font-semibold text-[#434653]">
                    {business.schedule || '—'}
                  </div>
                  <p className="text-[11px] text-[#737784] font-medium mt-1.5">
                    Este horario se genera desde la configuración de días y horas.{' '}
                    <Link href="/dashboard/admin/horario" className="font-bold text-[#00357f] underline underline-offset-2">
                      Se configura en Configurar horario
                    </Link>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingBusiness}
                className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[44px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-[13px]"
              >
                {savingBusiness ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Guardar datos de la óptica</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            !businessFeedback && (
              <div className="flex items-center gap-3 py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00357f] border-t-transparent" />
                <p className="text-[13px] text-[#737784] font-medium">Cargando datos de la óptica...</p>
              </div>
            )
          )}

          {/* Descuento de cliente en el catálogo: sección propia, con
              su propio guardado (acción de servidor con puerta de
              rol). Solo manda en lo que el cliente conectado VE en su
              catálogo y su panel; la venta nunca lo aplica sola. */}
          <div className="border-t border-[#e7eeff] pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Percent className="w-[18px] h-[18px] text-[#00357f] shrink-0" />
              <h3 className="text-[15px] font-bold text-[#111c2d]">
                Descuento de cliente en el catálogo
              </h3>
            </div>

            <p className="text-[13px] text-[#434653] font-medium">
              Es el descuento que el cliente ve en SU catálogo cuando inicia sesión.
              En su mes de cumpleaños se suma el extra (tope total: 95%). En la venta
              ningún descuento se aplica automáticamente: ahí lo pone el vendedor.
            </p>

            {discountFeedback && (
              <div
                className={`rounded-xl p-3 flex items-center gap-3 ${
                  discountFeedback.type === 'success' ? 'bg-[#e2f9ee]' : 'bg-[#ffdad6]'
                }`}
              >
                {discountFeedback.type === 'success' ? (
                  <CheckCircle className="w-[18px] h-[18px] text-[#00422b] shrink-0" />
                ) : (
                  <ShieldAlert className="w-[18px] h-[18px] text-[#ba1a1a] shrink-0" />
                )}
                <p
                  className={`text-[13px] font-semibold leading-normal ${
                    discountFeedback.type === 'success' ? 'text-[#00422b]' : 'text-[#ba1a1a]'
                  }`}
                >
                  {discountFeedback.text}
                </p>
              </div>
            )}

            {discountsLoaded ? (
              <form onSubmit={handleSaveDiscounts} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="member-discount-percent" className={labelClasses}>
                      Descuento por ser cliente (%)
                    </label>
                    <input
                      id="member-discount-percent"
                      type="number"
                      min={0}
                      max={90}
                      step={1}
                      inputMode="numeric"
                      value={memberPct}
                      onChange={(e) => setMemberPct(e.target.value)}
                      disabled={savingDiscounts}
                      placeholder="20"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="birthday-discount-extra-percent" className={labelClasses}>
                      Descuento extra en su mes de cumpleaños (%)
                    </label>
                    <input
                      id="birthday-discount-extra-percent"
                      type="number"
                      min={0}
                      max={90}
                      step={1}
                      inputMode="numeric"
                      value={birthdayExtraPct}
                      onChange={(e) => setBirthdayExtraPct(e.target.value)}
                      disabled={savingDiscounts}
                      placeholder="5"
                      className={inputClasses}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingDiscounts}
                  className="w-full bg-[#00357f] hover:bg-[#00509e] text-white font-bold px-4 min-h-[44px] rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-[13px]"
                >
                  {savingDiscounts ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Guardar descuentos</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              !discountFeedback && (
                <div className="flex items-center gap-3 py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00357f] border-t-transparent" />
                  <p className="text-[13px] text-[#737784] font-medium">Cargando descuentos...</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
