'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Eye, Search, Trash2, User, UserPlus } from 'lucide-react'
import { registerCustomerAction } from '@/app/customers/actions'
import { getCustomerById, searchCustomers } from '@/lib/services'
import ClinicalExamForm from '@/components/clinical-exam-form'
import PageHeader from '@/components/page-header'

// «Realizar examen» — acceso rápido de la barra inferior (orden del
// dueño, 2026-11-18): paso 1, elegir al cliente con el MISMO selector
// de la Agenda (resultados que se cierran al tocar fuera, «Agregar
// cliente nuevo» básico por la misma registerCustomerAction del POS y
// de la Agenda, y con cliente elegido su nombre con «Cambiar» y el
// botecito de basura); paso 2, EL formulario de examen de siempre
// (components/clinical-exam-form.tsx, el de la ficha del cliente) que
// guarda en clinical_exams con createClinicalExamAction. Al guardar no
// se redirige: la pantalla confirma y enlaza a la ficha del cliente.
export default function QuickExamPage() {
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  // Customer dropdown visibility: it closes when the staff taps/clicks
  // OUTSIDE the picker without choosing anyone (same as Agenda).
  const [resultsOpen, setResultsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  // Quick-add customer (same mini form and same creation path as the POS)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickError, setQuickError] = useState('')
  const [quickCreating, setQuickCreating] = useState(false)
  // Customer whose exam was just saved (confirmation panel state)
  const [savedFor, setSavedFor] = useState<any | null>(null)
  // Same rule the owner dictated for the Agenda picker: removing the
  // selected customer with the trash must NOT reopen the results list;
  // «Cambiar» (or typing/tapping the field again) re-arms the auto-open.
  const suppressAutoOpenRef = useRef(false)
  // The results list must NOT be open on page load either: it only
  // auto-opens after the user taps or types in the field.
  const pickerInteractedRef = useRef(false)

  // Customer search (debounced lightly, same as the Agenda picker).
  useEffect(() => {
    if (selectedCustomer) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const results = await searchCustomers(customerQuery)
        if (!cancelled) {
          setCustomerResults(results)
          if (!suppressAutoOpenRef.current && pickerInteractedRef.current) setResultsOpen(true)
        }
      } catch {
        if (!cancelled) setCustomerResults([])
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [customerQuery, selectedCustomer])

  // Preselección desde la Agenda (orden del dueño, 2026-11-19): el
  // botón «Realizar examen» de la tarjeta de una cita llega aquí con
  // ?customer=<id> y el examen se abre con ese cliente YA elegido
  // («ya con el nombre del cliente que había agendado»). Sin el
  // parámetro (entrada normal desde la barra inferior) el selector
  // queda libre, como siempre, y la lista NO se abre sola. Si el id
  // no existe, se ignora y el selector queda libre.
  const preselectTriedRef = useRef(false)
  useEffect(() => {
    if (preselectTriedRef.current) return
    preselectTriedRef.current = true
    const id = new URLSearchParams(window.location.search).get('customer')
    if (!id) return
    let cancelled = false
    getCustomerById(id)
      .then(customer => {
        if (!cancelled && customer) setSelectedCustomer(customer)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Click/tap OUTSIDE closes the customer dropdown without selecting.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setResultsOpen(false)
        setShowQuickAdd(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null)
    setCustomerQuery('')
    setShowQuickAdd(false)
  }

  // Trash: clear and keep the list CLOSED until the user types or taps.
  const removeSelectedCustomer = () => {
    suppressAutoOpenRef.current = true
    clearSelectedCustomer()
    setResultsOpen(false)
  }

  // «Cambiar»: clear and DO open the list right away.
  const changeSelectedCustomer = () => {
    suppressAutoOpenRef.current = false
    clearSelectedCustomer()
    setResultsOpen(true)
  }

  // Username suggestion with the EXACT convention of /customers/new and
  // the POS (lowercase, accents stripped, first two words joined '_').
  const suggestUsername = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .split('_')
      .filter(Boolean)
      .slice(0, 2)
      .join('_')

  // Creates a customer through the SAME path as /customers/new and the
  // POS quick-add (registerCustomerAction: Auth account + profile role
  // 'customer' + customer_profile). No duplicated creation logic.
  const createCustomerViaOfficialPath = async (fullName: string, phone?: string, email?: string) => {
    const formData = new FormData()
    formData.set('fullName', fullName)
    formData.set('username', email?.trim() ? email.trim() : suggestUsername(fullName))
    if (phone?.trim()) formData.set('phone', phone.trim())
    return registerCustomerAction({ error: null, success: null, customerId: null }, formData)
  }

  const openQuickAdd = () => {
    setQuickName(customerQuery.trim())
    setQuickPhone('')
    setQuickEmail('')
    setQuickError('')
    setShowQuickAdd(true)
    setResultsOpen(true)
  }

  // Quick-add from the picker: create, select the new customer for the
  // exam and close the panel. Errors stay inside the panel.
  const handleQuickCreateCustomer = async () => {
    const name = quickName.trim()
    if (!name) {
      setQuickError('Escribe el nombre del cliente.')
      return
    }
    setQuickCreating(true)
    setQuickError('')
    try {
      const result = await createCustomerViaOfficialPath(name, quickPhone, quickEmail)
      if (result.error || !result.customerId) {
        setQuickError(result.error || 'No se pudo crear el cliente.')
        return
      }
      const fresh = await searchCustomers(name)
      const created = fresh.find((c: any) => c.id === result.customerId)
      setSelectedCustomer(
        created ?? {
          id: result.customerId,
          full_name: name,
          email: quickEmail.trim() || `${suggestUsername(name)}@opticarayo.com`,
          role: 'customer',
          customer_profiles: { phone: quickPhone.trim() || null },
        }
      )
      setCustomerQuery('')
      setShowQuickAdd(false)
      setResultsOpen(false)
    } catch {
      setQuickError('No se pudo crear el cliente. Inténtalo de nuevo.')
    } finally {
      setQuickCreating(false)
    }
  }

  const startAnotherExam = () => {
    setSavedFor(null)
    clearSelectedCustomer()
  }

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-2 md:p-8 max-w-2xl mx-auto pb-24 md:pb-8 text-left space-y-4 md:space-y-5">
      {/* Header: en móvil solo la etiqueta chiquita (PageHeader) */}
      <PageHeader title="Realizar examen">
        <header className="anim-fade-up">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight flex items-center gap-2.5">
            <Eye className="w-7 h-7" /> Realizar examen
          </h1>
          <p className="text-sm text-[#434653] mt-1 font-medium">
            Elige al cliente (o agrégalo nuevo) y captura su examen: queda guardado en su expediente, como siempre.
          </p>
        </header>
      </PageHeader>

      {savedFor ? (
        /* Confirmation: the exam is already in the customer's file */
        <section className="anim-fade-up bg-[#e2f9ee] rounded-[20px] or-shadow-card p-6 space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#00422b] mx-auto" />
          <div>
            <h2 className="text-lg font-extrabold text-[#00422b]">¡Examen guardado exitosamente!</h2>
            <p className="text-sm text-[#00422b]/80 font-medium mt-1">
              Quedó registrado en el expediente de <strong className="font-bold">{savedFor.full_name}</strong>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href={`/customers/${savedFor.id}`}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-[#00357f] hover:bg-[#00509e] text-white text-sm font-bold transition-colors"
            >
              Ver ficha del cliente
            </Link>
            <button
              type="button"
              onClick={startAnotherExam}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-white border border-[#00422b]/25 text-[#00422b] text-sm font-bold hover:bg-white/70 transition-colors cursor-pointer"
            >
              Realizar otro examen
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Step 1 — customer picker (same pattern as the Agenda) */}
          <section className="anim-fade-up bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <User className="w-4 h-4" /> 1 · Cliente
            </h2>
            <div>
              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-2 bg-[#f0f3ff] border border-[#cbd5e1]/60 rounded-xl px-3.5 py-2.5">
                  <span className="text-sm font-bold text-[#111c2d] flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-[#00357f] shrink-0" />
                    <span className="truncate">{selectedCustomer.full_name}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={changeSelectedCustomer}
                      className="text-xs font-black text-[#00357f] underline underline-offset-2 cursor-pointer"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={removeSelectedCustomer}
                      aria-label="Quitar cliente"
                      title="Quitar cliente (si lo seleccionaste mal)"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/70 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                </div>
              ) : (
                <div className="relative" ref={pickerRef}>
                  <Search className="w-4 h-4 text-[#737784] absolute left-3.5 top-[13px]" />
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={e => { suppressAutoOpenRef.current = false; pickerInteractedRef.current = true; setCustomerQuery(e.target.value) }}
                    onFocus={() => { suppressAutoOpenRef.current = false; pickerInteractedRef.current = true; setResultsOpen(true) }}
                    placeholder="Busca por nombre…"
                    className="w-full border border-[#cbd5e1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00357f]/40 focus:border-[#00357f] bg-white"
                  />
                  {/* Quick-add entry: visible before any customer shows up */}
                  <button
                    type="button"
                    onClick={openQuickAdd}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-[#00357f] hover:bg-[#dee8ff]/60 px-1.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Agregar cliente nuevo
                  </button>

                  {resultsOpen && (showQuickAdd || customerResults.length > 0) && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1.5 bg-white border border-[#cbd5e1] rounded-xl shadow-lg max-h-80 overflow-y-auto">
                      {showQuickAdd ? (
                        <div className="p-4 space-y-3 text-left">
                          <p className="text-sm font-bold text-[#00357f]">Agregar cliente nuevo</p>
                          <p className="text-[11px] text-[#737784] font-medium -mt-1.5">
                            Perfil básico, como en el punto de venta; lo demás se completa después en Clientes.
                          </p>
                          <div>
                            <label className="block text-[13px] font-semibold text-[#434653] mb-1">Nombre *</label>
                            <input
                              type="text"
                              value={quickName}
                              onChange={e => setQuickName(e.target.value)}
                              placeholder="Nombre completo del cliente"
                              className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[13px] font-semibold text-[#434653] mb-1">Teléfono (opcional)</label>
                            <input
                              type="tel"
                              value={quickPhone}
                              onChange={e => setQuickPhone(e.target.value)}
                              placeholder="Ej. (555) 123-4567"
                              className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[13px] font-semibold text-[#434653] mb-1">Correo (opcional)</label>
                            <input
                              type="email"
                              value={quickEmail}
                              onChange={e => setQuickEmail(e.target.value)}
                              placeholder="cliente@correo.com"
                              className="w-full bg-[#f9f9ff] border border-[#dee8ff] rounded-xl px-3 py-2.5 text-sm text-[#111c2d] placeholder-[#737784] focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none min-h-[44px] transition-colors"
                            />
                          </div>
                          {quickError && (
                            <p className="bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/25 rounded-xl px-3 py-2 text-[13px] font-semibold">
                              {quickError}
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleQuickCreateCustomer}
                              disabled={quickCreating}
                              className="flex-1 min-h-[44px] bg-[#00357f] hover:bg-[#00509e] text-white text-sm font-bold rounded-xl px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {quickCreating ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Creando...
                                </>
                              ) : (
                                'Crear y seleccionar'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowQuickAdd(false); setQuickError('') }}
                              disabled={quickCreating}
                              className="min-h-[44px] bg-white border border-[#dee8ff] text-[#737784] text-sm font-bold rounded-xl px-4 hover:bg-[#dee8ff]/30 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ul>
                          <li>
                            <button
                              type="button"
                              onClick={openQuickAdd}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-[#f0f3ff] text-sm font-bold text-[#00357f] flex items-center gap-2 cursor-pointer border-b border-[#f0f3ff]"
                            >
                              <UserPlus className="w-4 h-4" /> Agregar cliente nuevo
                            </button>
                          </li>
                          {customerResults.map((c: any) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => { setSelectedCustomer(c); setResultsOpen(false); setShowQuickAdd(false) }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-[#f0f3ff] text-sm font-semibold text-[#111c2d] cursor-pointer"
                              >
                                {c.full_name}
                                <span className="block text-[11px] text-[#737784] font-medium">
                                  {c.customer_profiles?.phone || c.email}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Step 2 — the exam form itself, or the hint to pick a customer */}
          {selectedCustomer ? (
            <div className="anim-fade-up space-y-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#00357f] flex items-center gap-2 px-1">
                <Eye className="w-4 h-4" /> 2 · Examen clínico
              </h2>
              <ClinicalExamForm
                key={selectedCustomer.id}
                customerId={selectedCustomer.id}
                onSuccess={() => setSavedFor(selectedCustomer)}
              />
            </div>
          ) : (
            <section className="anim-fade-up bg-white border border-dashed border-[#cbd5e1] rounded-2xl p-5 flex items-start gap-3">
              <Eye className="w-5 h-5 text-[#0899c9] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#111c2d]">Primero elige un cliente</p>
                <p className="text-xs text-[#737784] font-medium mt-0.5">
                  Búscalo en el paso 1 (o agrégalo nuevo) y aquí aparecerá su formulario de examen.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
