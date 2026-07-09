'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerCustomerAction, RegisterCustomerState } from '@/app/customers/actions'
import { checkPhoneDuplicate } from '@/lib/services'
import { ArrowLeft, User, FileText, CheckCircle, ShieldAlert, PlusCircle, Sparkles } from 'lucide-react'

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
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Header and Back navigation */}
      <div className="flex items-center gap-4">
        <Link href="/customers" className="w-10 h-10 bg-white hover:bg-[#dee8ff]/30 border border-[#cbd5e1] rounded-xl flex items-center justify-center transition-colors min-h-[40px] min-w-[40px]">
          <ArrowLeft className="w-5 h-5 text-[#737784]" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-[#00357f] tracking-tight">Nuevo Cliente</h1>
          <p className="text-xs text-[#737784] mt-0.5 font-medium">Ingresa los datos personales y la receta del cliente.</p>
        </div>
      </div>

      {/* Stepper Steps UI */}
      <div className="grid grid-cols-2 gap-2 bg-[#f0f3ff] p-1 rounded-xl border border-[#cbd5e1] shadow-sm">
        <button
          onClick={() => setStep(1)}
          type="button"
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            step === 1 
              ? 'bg-white text-[#00357f] shadow-sm font-black' 
              : 'text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          1. Datos Personales
        </button>
        <button
          onClick={() => setStep(2)}
          type="button"
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            step === 2 
              ? 'bg-white text-[#00357f] shadow-sm font-black' 
              : 'text-[#737784] hover:text-[#111c2d]'
          }`}
        >
          2. Receta Optométrica (Rx)
        </button>
      </div>

      {/* Feedback Messages */}
      {state?.success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-sm font-bold text-emerald-600">¡Cliente registrado con éxito!</p>
            <p className="text-xs text-emerald-500 mt-1">{state.success}</p>
            <p className="text-xs text-emerald-700 mt-1 font-semibold">Redirigiendo al expediente...</p>
          </div>
        </div>
      )}
      
      {state?.error && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[#ba1a1a] shrink-0" />
          <p className="text-xs font-semibold text-[#ba1a1a]">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        
        {/* STEP 1: PERSONAL & CONTACT DATA */}
        <div className={step === 1 ? 'space-y-6 text-left' : 'hidden'}>
          
          {/* DATOS DE ACCESO */}
          <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#f0f3ff] pb-3">
              <User className="w-4 h-4 text-[#00357f]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Datos del Perfil</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
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
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">
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
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
                <p className="text-[10px] text-[#737784] mt-1.5 font-semibold">
                  Contraseña por defecto: <span className="text-[#00357f] font-bold">Rayo_[PrimerNombre]</span>
                </p>
              </div>
            </div>
          </section>

          {/* DATOS PERSONALES */}
          <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#f0f3ff] pb-3">
              <FileText className="w-4 h-4 text-[#00357f]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Contacto y Antecedentes</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider">Teléfono *</label>
                  {checkingPhone && <span className="text-[10px] text-[#737784]">Verificando...</span>}
                  {phoneError && <span className="text-[10px] text-[#ba1a1a] font-bold">Ya registrado</span>}
                </div>
                <input 
                  name="phone" 
                  type="tel" 
                  required
                  disabled={isPending}
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="Ej. (555) 123-4567"
                  className={`w-full bg-[#f0f3ff] border rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none focus:ring-1 transition-colors min-h-[44px] ${
                    phoneError 
                      ? 'border-[#ba1a1a] focus:ring-[#ba1a1a]' 
                      : 'border-[#cbd5e1] focus:border-[#00357f] focus:ring-[#00357f]'
                  }`} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Fecha de Nacimiento</label>
                <input 
                  name="dateOfBirth" 
                  type="date" 
                  disabled={isPending}
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Ocupación</label>
                <input 
                  name="occupation" 
                  type="text" 
                  disabled={isPending}
                  placeholder="Ej. Estudiante, Oficinista"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Tipo de Sangre</label>
                <select 
                  name="bloodType" 
                  disabled={isPending}
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] cursor-pointer"
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
              <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Dirección</label>
              <input 
                name="address" 
                type="text" 
                disabled={isPending}
                placeholder="Calle, número, colonia, ciudad..."
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Antecedentes Médicos relevantes</label>
              <textarea 
                name="medicalNotes" 
                disabled={isPending} 
                rows={2}
                placeholder="Ej. Alergias, diabetes, cirugías oculares previas..."
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none resize-none" 
              />
            </div>
          </section>

          {/* CONTACTO DE EMERGENCIA */}
          <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#f0f3ff] pb-3">
              <Sparkles className="w-4 h-4 text-[#00357f]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Contacto de Emergencia</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Nombre del Familiar</label>
                <input 
                  name="emergencyContactName" 
                  type="text" 
                  disabled={isPending}
                  placeholder="Ej. Madre, Padre, Cónyuge"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Teléfono de Emergencia</label>
                <input 
                  name="emergencyContactPhone" 
                  type="tel" 
                  disabled={isPending}
                  placeholder="Ej. (555) 987-6543"
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" 
                />
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs uppercase shadow-sm min-h-[44px]"
          >
            Continuar a Receta Visual
          </button>
        </div>

        {/* STEP 2: REFRACTION PRESCRIPTION */}
        <div className={step === 2 ? 'space-y-6 text-left' : 'hidden'}>
          
          {/* OD & OI GRID CONFIG */}
          <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-6 shadow-sm">
            
            {/* OJO DERECHO (OD) */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full bg-[#00357f]" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#111c2d]">Ojo Derecho (OD)</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* ESFERA */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Esfera (SPH)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOdSphere, odSphere, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="od_sphere" type="text" value={odSphere} onChange={(e) => setOdSphere(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOdSphere, odSphere, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* CILINDRO */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Cilindro (CYL)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOdCylinder, odCylinder, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="od_cylinder" type="text" value={odCylinder} onChange={(e) => setOdCylinder(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOdCylinder, odCylinder, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* EJE */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Eje (AXIS) °</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustAxis(setOdAxis, odAxis, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="od_axis" type="number" min="0" max="180" value={odAxis} onChange={(e) => setOdAxis(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustAxis(setOdAxis, odAxis, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* ADICION */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Adición (ADD)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOdAdd, odAdd, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="od_add" type="text" value={odAdd} onChange={(e) => setOdAdd(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOdAdd, odAdd, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-[#f0f3ff]" />

            {/* OJO IZQUIERDO (OI) */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full bg-[#00668a]" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#111c2d]">Ojo Izquierdo (OI)</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* ESFERA */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Esfera (SPH)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOiSphere, oiSphere, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="oi_sphere" type="text" value={oiSphere} onChange={(e) => setOiSphere(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOiSphere, oiSphere, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* CILINDRO */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Cilindro (CYL)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOiCylinder, oiCylinder, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="oi_cylinder" type="text" value={oiCylinder} onChange={(e) => setOiCylinder(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOiCylinder, oiCylinder, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* EJE */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Eje (AXIS) °</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustAxis(setOiAxis, oiAxis, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="oi_axis" type="number" min="0" max="180" value={oiAxis} onChange={(e) => setOiAxis(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustAxis(setOiAxis, oiAxis, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>

                {/* ADICION */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#737784]">Adición (ADD)</label>
                  <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                    <button type="button" onClick={() => adjustDecimal(setOiAdd, oiAdd, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input name="oi_add" type="text" value={oiAdd} onChange={(e) => setOiAdd(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                    <button type="button" onClick={() => adjustDecimal(setOiAdd, oiAdd, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                  </div>
                </div>
              </div>
            </div>

          </section>

          {/* ADICIONALES CLÍNICOS */}
          <section className="bg-white border border-[#cbd5e1] rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#f0f3ff] pb-3">
              <FileText className="w-4 h-4 text-[#00357f]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#00357f]">Parámetros Especiales</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Distancia Pupilar (DP) mm</label>
                <div className="flex items-center bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl overflow-hidden p-1">
                  <button type="button" onClick={() => adjustPd(setPdDistance, pdDistance, false)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">-</button>
                  <input name="pd_distance" type="text" value={pdDistance} onChange={(e) => setPdDistance(e.target.value)} className="w-full text-center bg-transparent border-0 text-xs font-bold focus:ring-0 outline-none text-[#111c2d] font-mono" />
                  <button type="button" onClick={() => adjustPd(setPdDistance, pdDistance, true)} className="w-8 h-8 text-xs font-black text-[#00357f] bg-white hover:bg-[#dee8ff] rounded-lg flex items-center justify-center cursor-pointer shadow-sm">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Tipo de Mica Recomendado</label>
                <select name="lens_type" className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] cursor-pointer">
                  <option value="">Ninguno</option>
                  <option value="monofocal">Monofocal</option>
                  <option value="bifocal">Bifocal</option>
                  <option value="progresivo">Progresivo</option>
                  <option value="contacto">Lente de Contacto</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Recomendación de Armazón</label>
              <input name="frame_recommendation" type="text" placeholder="Ej. Armazón de acetato redondo, pasta ancha..." className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none min-h-[44px]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Tratamiento de Mica Recomendado</label>
              <input name="treatment" type="text" placeholder="Ej. Antirreflejante Crizal, Filtro luz azul celular..." className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none min-h-[44px]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Observaciones Clínicas</label>
              <textarea name="clinical_notes" rows={2} placeholder="Notas sobre la agudeza visual del cliente..." className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:outline-none resize-none" />
            </div>
          </section>

          {/* BUTTONS */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-1/3 bg-white border border-[#cbd5e1] text-[#737784] hover:bg-[#dee8ff]/30 font-bold py-3.5 px-4 rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
            
            <button 
              type="submit" 
              disabled={isPending || !!state?.customerId || phoneError}
              className="w-2/3 bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase min-h-[44px]"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4.5 h-4.5" />
                  <span>Registrar Cliente Completo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}
