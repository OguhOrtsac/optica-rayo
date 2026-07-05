'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerCustomerAction, RegisterCustomerState } from '@/app/customers/actions'
import { checkPhoneDuplicate } from '@/lib/services'

const initialState: RegisterCustomerState = { error: null, success: null, customerId: null }

export default function NewCustomerPage() {
  const [state, formAction, isPending] = useActionState<RegisterCustomerState, FormData>(registerCustomerAction, initialState)
  const router = useRouter()
  
  // Stepper state
  const [step, setStep] = useState(1)

  // Form local states for interactive features
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState(false)
  const [checkingPhone, setCheckingPhone] = useState(false)

  // Rx Prescription states
  const [odSphere, setOdSphere] = useState('0.00')
  const [odCylinder, setOdCylinder] = useState('0.00')
  const [odAxis, setOdAxis] = useState('0')
  const [odAdd, setOdAdd] = useState('0.00')

  const [oiSphere, setOiSphere] = useState('0.00')
  const [oiCylinder, setOiCylinder] = useState('0.00')
  const [oiAxis, setOiAxis] = useState('0')
  const [oiAdd, setOiAdd] = useState('0.00')

  const [pdDistance, setPdDistance] = useState('60.0')

  // Auto-generate username from full name
  useEffect(() => {
    if (fullName && !username) {
      const suggested = fullName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, '_')
        .split('_')
        .filter(Boolean)
        .slice(0, 2)
        .join('_')
      setUsername(suggested)
    }
  }, [fullName, username])

  // Redirect on success
  useEffect(() => {
    if (state?.customerId) {
      const timer = setTimeout(() => router.push(`/customers/${state.customerId}`), 2500)
      return () => clearTimeout(timer)
    }
  }, [state?.customerId, router])

  // Phone input formatting
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatPhoneNumber(rawVal);
    setPhone(formatted);

    // Clean phone for duplicate check
    const digits = formatted.replace(/[^\d]/g, '');
    if (digits.length >= 10) {
      setCheckingPhone(true)
      const isDuplicate = await checkPhoneDuplicate(formatted)
      setPhoneError(isDuplicate)
      setCheckingPhone(false)
    } else {
      setPhoneError(false)
    }
  }

  const formatPhoneNumber = (value: string) => {
    if (!value) return value
    const phoneNumber = value.replace(/[^\d]/g, '')
    const phoneNumberLength = phoneNumber.length
    if (phoneNumberLength < 4) return phoneNumber
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
  }

  // Adjust numeric optometric fields
  const adjustDecimal = (setter: React.Dispatch<React.SetStateAction<string>>, current: string, increment: boolean) => {
    const val = parseFloat(current) || 0
    const delta = 0.25
    const newVal = increment ? val + delta : val - delta
    // format to 2 decimal places with sign
    const sign = newVal > 0 ? '+' : ''
    setter(newVal === 0 ? '0.00' : `${sign}${newVal.toFixed(2)}`)
  }

  const adjustAxis = (setter: React.Dispatch<React.SetStateAction<string>>, current: string, increment: boolean) => {
    const val = parseInt(current) || 0
    let newVal = increment ? val + 5 : val - 5
    if (newVal < 0) newVal = 180
    if (newVal > 180) newVal = 0
    setter(newVal.toString())
  }

  const adjustPd = (setter: React.Dispatch<React.SetStateAction<string>>, current: string, increment: boolean) => {
    const val = parseFloat(current) || 60
    const delta = 0.5
    const newVal = increment ? val + delta : val - delta
    setter(newVal.toFixed(1))
  }

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 pb-24 relative">
      <div className="fixed top-20 left-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-6 relative">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/customers" className="w-10 h-10 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center transition-all min-h-[44px] min-w-[44px]">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Nuevo Paciente</h1>
            <p className="text-xs text-slate-500 mt-0.5">Ingresa los datos personales y receta optométrica del cliente.</p>
          </div>
        </div>

        {/* Stepper Steps UI */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800/40">
          <button
            onClick={() => setStep(1)}
            type="button"
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              step === 1 
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Datos Personales
          </button>
          <button
            onClick={() => setStep(2)}
            type="button"
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              step === 2 
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Receta Optométrica (Rx)
          </button>
        </div>

        {/* Feedback Messages */}
        {state?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-400">¡Cliente registrado!</p>
              <p className="text-xs text-emerald-500 mt-1">{state.success}</p>
              <p className="text-xs text-emerald-600 mt-1">Redirigiendo al expediente del paciente...</p>
            </div>
          </div>
        )}
        
        {state?.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-rose-400">{state.error}</p>
          </div>
        )}

        <form action={formAction} className="space-y-6">
          {/* STEP 1: PERSONAL & CONTACT DATA */}
          <div className={step === 1 ? 'space-y-6 animate-in fade-in duration-200' : 'hidden'}>
            
            {/* DATOS DE ACCESO */}
            <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos del Perfil</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Nombre Completo *
                  </label>
                  <input 
                    name="fullName" 
                    type="text" 
                    required 
                    disabled={isPending}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Ana Sofía Gómez"
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Nombre de Usuario *
                  </label>
                  <input 
                    name="username" 
                    type="text" 
                    required 
                    disabled={isPending}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. ana_gomez"
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Contraseña por defecto: <span className="text-cyan-400 font-bold">Rayo_[PrimerNombre]</span>
                  </p>
                </div>
              </div>
            </section>

            {/* DATOS PERSONALES */}
            <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos de Contacto e Historial</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Teléfono *</label>
                    {checkingPhone && <span className="text-[10px] text-slate-500">Buscando...</span>}
                    {phoneError && <span className="text-[10px] text-rose-400 font-bold">⚠️ Ya registrado</span>}
                  </div>
                  <input 
                    name="phone" 
                    type="tel" 
                    required
                    disabled={isPending}
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="Ej. (555) 123-4567"
                    className={`w-full bg-slate-950/85 border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 transition-all min-h-[44px] ${
                      phoneError 
                        ? 'border-rose-500/50 focus:ring-rose-500/30' 
                        : phone.length >= 14 
                          ? 'border-emerald-500/50 focus:ring-emerald-500/30' 
                          : 'border-slate-850 focus:ring-indigo-500/40'
                    }`} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de Nacimiento</label>
                  <input 
                    name="dateOfBirth" 
                    type="date" 
                    disabled={isPending}
                    className="w-full bg-slate-950/85 border border-slate-855 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ocupación</label>
                  <input 
                    name="occupation" 
                    type="text" 
                    disabled={isPending}
                    placeholder="Ej. Estudiante, Programador"
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de Sangre</label>
                  <select 
                    name="bloodType" 
                    disabled={isPending}
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 min-h-[44px]"
                  >
                    <option value="">No especificado</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="NS">No sabe (NS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dirección</label>
                <input 
                  name="address" 
                  type="text" 
                  disabled={isPending}
                  placeholder="Calle, número, colonia, ciudad..."
                  className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Antecedentes Médicos relevantes</label>
                <textarea 
                  name="medicalNotes" 
                  disabled={isPending} 
                  rows={2}
                  placeholder="Ej. Alergia a medicamentos, diabetes, hipertensión..."
                  className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all disabled:opacity-50 resize-none" 
                />
              </div>
            </section>

            {/* CONTACTO DE EMERGENCIA */}
            <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Contacto de Emergencia</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                  <input 
                    name="emergencyContactName" 
                    type="text" 
                    disabled={isPending}
                    placeholder="Ej. Familiar o Tutor"
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Teléfono de Emergencia</label>
                  <input 
                    name="emergencyContactPhone" 
                    type="tel" 
                    disabled={isPending}
                    placeholder="Ej. 555-987-6543"
                    className="w-full bg-slate-950/85 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all disabled:opacity-50 min-h-[44px]" 
                  />
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-slate-800 text-sm min-h-[44px]"
            >
              Continuar a Receta Optométrica
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* STEP 2: REFRACTION PRESCRIPTION */}
          <div className={step === 2 ? 'space-y-6 animate-in fade-in duration-200' : 'hidden'}>
            
            {/* OD & OI GRID CONFIG */}
            <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-6">
              
              {/* OJO DERECHO (OD) */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-200">Ojo Derecho (OD)</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* ESFERA */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Esfera (SPH)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOdSphere, odSphere, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="od_sphere" type="text" value={odSphere} onChange={(e) => setOdSphere(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOdSphere, odSphere, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* CILINDRO */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Cilindro (CYL)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOdCylinder, odCylinder, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="od_cylinder" type="text" value={odCylinder} onChange={(e) => setOdCylinder(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOdCylinder, odCylinder, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* EJE */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Eje (AXIS) °</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustAxis(setOdAxis, odAxis, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="od_axis" type="number" min="0" max="180" value={odAxis} onChange={(e) => setOdAxis(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustAxis(setOdAxis, odAxis, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* ADICION */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Adición (ADD)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOdAdd, odAdd, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="od_add" type="text" value={odAdd} onChange={(e) => setOdAdd(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOdAdd, odAdd, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-800/50" />

              {/* OJO IZQUIERDO (OI) */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-200">Ojo Izquierdo (OI)</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* ESFERA */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Esfera (SPH)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOiSphere, oiSphere, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="oi_sphere" type="text" value={oiSphere} onChange={(e) => setOiSphere(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOiSphere, oiSphere, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* CILINDRO */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Cilindro (CYL)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOiCylinder, oiCylinder, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="oi_cylinder" type="text" value={oiCylinder} onChange={(e) => setOiCylinder(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOiCylinder, oiCylinder, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* EJE */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Eje (AXIS) °</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustAxis(setOiAxis, oiAxis, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="oi_axis" type="number" min="0" max="180" value={oiAxis} onChange={(e) => setOiAxis(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustAxis(setOiAxis, oiAxis, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>

                  {/* ADICION */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Adición (ADD)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                      <button type="button" onClick={() => adjustDecimal(setOiAdd, oiAdd, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                      <input name="oi_add" type="text" value={oiAdd} onChange={(e) => setOiAdd(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                      <button type="button" onClick={() => adjustDecimal(setOiAdd, oiAdd, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>
              </div>

            </section>

            {/* ADICIONALES CLÍNICOS */}
            <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Parámetros Adicionales</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Distancia Pupilar (DP) mm</label>
                  <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustPd(setPdDistance, pdDistance, false)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">-</button>
                    <input name="pd_distance" type="text" value={pdDistance} onChange={(e) => setPdDistance(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-slate-100" />
                    <button type="button" onClick={() => adjustPd(setPdDistance, pdDistance, true)} className="w-8 h-8 text-xs font-black text-slate-400 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center">+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de Lente recomendado</label>
                  <select name="lens_type" className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-300 focus:ring-cyan-550 focus:outline-none min-h-[44px]">
                    <option value="">Ninguno</option>
                    <option value="monofocal">Monofocal</option>
                    <option value="bifocal">Bifocal</option>
                    <option value="progresivo">Progresivo</option>
                    <option value="contacto">Lente de Contacto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recomendación de Armazón</label>
                <input name="frame_recommendation" type="text" placeholder="Ej. Armazón de acetato cerrado, ovalado..." className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none min-h-[44px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tratamiento sugerido</label>
                <input name="treatment" type="text" placeholder="Ej. Filtro de luz azul, anti-reflejante premium..." className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none min-h-[44px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notas Clínicas adicionales</label>
                <textarea name="clinical_notes" rows={2} placeholder="Observaciones sobre la visión del paciente..." className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none resize-none" />
              </div>
            </section>

            {/* BUTTONS WRAPPER */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-slate-900 border border-slate-800 text-slate-300 font-bold py-4 px-4 rounded-xl cursor-pointer hover:bg-slate-800 transition-all text-xs flex items-center justify-center gap-2 min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Atrás
              </button>
              
              <button 
                type="submit" 
                disabled={isPending || !!state?.customerId || phoneError}
                className="w-2/3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black py-4 px-4 rounded-xl shadow-lg shadow-cyan-500/10 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-xs min-h-[44px]"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Registrar Paciente Completo
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
