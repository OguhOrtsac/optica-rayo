'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  searchCustomers,
  getAllProfiles
} from '@/lib/services'
import {
  adminDeleteUserAction
} from '@/app/auth/actions'
import {
  updateCustomerAction,
  registerCustomerAction
} from '@/app/customers/actions'

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modals state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null)

  // Add Customer Form state
  const [cFullName, setCFullName] = useState('')
  const [cUsername, setCUsername] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cDOB, setCDOB] = useState('')
  const [cAddress, setCAddress] = useState('')
  const [cOccupation, setCOccupation] = useState('')
  const [cBloodType, setCBloodType] = useState<string>('NS')
  const [cMedicalNotes, setCMedicalNotes] = useState('')
  const [cEmergencyName, setCEmergencyName] = useState('')
  const [cEmergencyPhone, setCEmergencyPhone] = useState('')

  const loadCustomersData = async () => {
    try {
      setLoading(true)
      const customersData = await searchCustomers('')
      setCustomers(customersData)
    } catch (e) {
      showFeedback('error', 'Error al cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomersData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Add Customer Submit
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cFullName.trim() || !cUsername.trim()) {
      showFeedback('error', 'Nombre y nombre de usuario son obligatorios.')
      return
    }

    const formData = new FormData()
    formData.append('fullName', cFullName)
    formData.append('username', cUsername)
    formData.append('phone', cPhone)
    formData.append('dateOfBirth', cDOB)
    formData.append('address', cAddress)
    formData.append('occupation', cOccupation)
    formData.append('bloodType', cBloodType)
    formData.append('medicalNotes', cMedicalNotes)
    formData.append('emergencyContactName', cEmergencyName)
    formData.append('emergencyContactPhone', cEmergencyPhone)

    try {
      const res = await registerCustomerAction({ error: null, success: null, customerId: null }, formData)
      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', res.success || 'Cliente registrado con éxito.')
        setShowAddCustomerModal(false)
        setCFullName('')
        setCUsername('')
        setCPhone('')
        setCDOB('')
        setCAddress('')
        setCOccupation('')
        setCBloodType('NS')
        setCMedicalNotes('')
        setCEmergencyName('')
        setCEmergencyPhone('')
        await loadCustomersData()
      }
    } catch (e) {
      showFeedback('error', 'Fallo al registrar cliente.')
    }
  }

  // Update Customer Submit
  const handleUpdateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return

    try {
      const res = await updateCustomerAction(editingCustomer.id, {
        fullName: editingCustomer.full_name,
        username: editingCustomer.username || editingCustomer.email?.split('@')[0],
        phone: editingCustomer.customer_profiles?.phone || '',
        dateOfBirth: editingCustomer.customer_profiles?.date_of_birth || '',
        address: editingCustomer.customer_profiles?.address || '',
        occupation: editingCustomer.customer_profiles?.occupation || '',
        bloodType: editingCustomer.customer_profiles?.blood_type || 'NS',
        medicalNotes: editingCustomer.customer_profiles?.medical_notes || '',
        emergencyContactName: editingCustomer.customer_profiles?.emergency_contact_name || '',
        emergencyContactPhone: editingCustomer.customer_profiles?.emergency_contact_phone || ''
      })

      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', res.success || 'Expediente de cliente actualizado.')
        setEditingCustomer(null)
        await loadCustomersData()
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error al actualizar expediente.')
    }
  }

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deletingItem) return
    try {
      const res = await adminDeleteUserAction(deletingItem.id)
      if (res.success) {
        showFeedback('success', res.success)
      } else if (res.error) {
        showFeedback('error', res.error)
      }
      setDeletingItem(null)
      await loadCustomersData()
    } catch (e) {
      showFeedback('error', 'Error al eliminar el cliente.')
    }
  }

  // Filter calculation
  const filteredCustomers = customers.filter(c => 
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 space-y-6 relative">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        
        {/* Back and Header */}
        <div className="space-y-4">
          <Link
            href="/dashboard/admin"
            className="text-xs font-bold text-slate-500 hover:text-slate-350 transition-colors flex items-center gap-1.5 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel Principal
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Administración de Pacientes (Clientes)
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Visualiza, crea, edita y gestiona el expediente clínico e historial de compras de tus pacientes.
              </p>
            </div>
            
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Paciente
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Main Loading / List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500">Cargando pacientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
            No se encontraron clientes para tu búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map(c => (
              <div
                key={c.id}
                className="bg-slate-900/30 border border-slate-900/60 hover:border-cyan-500/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-950/5 group"
              >
                <div className="flex gap-4">
                  <div className="w-11 h-11 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-xs shrink-0 select-none">
                    {c.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                      {c.full_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate">@{c.email?.replace('@opticarayo.com', '')}</p>
                    {c.customer_profiles?.phone && (
                      <p className="text-[10px] text-slate-400 mt-1.5">📞 {c.customer_profiles.phone}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-950 pt-3 flex items-center justify-between">
                  <Link
                    href={`/customers/${c.id}`}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Ver Expediente
                  </Link>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Modificar
                    </button>
                    <button
                      onClick={() => setDeletingItem({ id: c.id, name: c.full_name })}
                      className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-50/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ========================================================
         MODAL: ADD CUSTOMER
         ======================================================== */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Nuevo Paciente</h2>
            
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={cFullName}
                    onChange={(e) => setCFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre de Usuario *</label>
                  <input
                    type="text"
                    required
                    value={cUsername}
                    onChange={(e) => setCUsername(e.target.value)}
                    placeholder="ej. juanperez"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="10 dígitos"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={cDOB}
                    onChange={(e) => setCDOB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={cAddress}
                    onChange={(e) => setCAddress(e.target.value)}
                    placeholder="Calle, Número, Colonia"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Ocupación</label>
                  <input
                    type="text"
                    value={cOccupation}
                    onChange={(e) => setCOccupation(e.target.value)}
                    placeholder="Ocupación"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipo de Sangre</label>
                  <select
                    value={cBloodType}
                    onChange={(e) => setCBloodType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                  >
                    <option value="NS">No especificado</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Antecedentes Médicos</label>
                  <textarea
                    value={cMedicalNotes}
                    onChange={(e) => setCMedicalNotes(e.target.value)}
                    placeholder="Alergias, diabetes, cirugías previas..."
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100 min-h-[50px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contacto Emergencia</label>
                  <input
                    type="text"
                    value={cEmergencyName}
                    onChange={(e) => setCEmergencyName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono Emergencia</label>
                  <input
                    type="text"
                    value={cEmergencyPhone}
                    onChange={(e) => setCEmergencyPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer"
                >
                  Crear Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: EDIT CUSTOMER
         ======================================================== */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Modificar Paciente</h2>
            
            <form onSubmit={handleUpdateCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.full_name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, full_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Usuario (Acceso) *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.username || editingCustomer.email?.split('@')[0]}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.phone || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, phone: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nacimiento (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={editingCustomer.customer_profiles?.date_of_birth || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, date_of_birth: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.address || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, address: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Ocupación</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.occupation || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, occupation: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipo de Sangre</label>
                  <select
                    value={editingCustomer.customer_profiles?.blood_type || 'NS'}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, blood_type: e.target.value as any }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                  >
                    <option value="NS">No Especificado</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Antecedentes Médicos</label>
                  <textarea
                    value={editingCustomer.customer_profiles?.medical_notes || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, medical_notes: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100 min-h-[50px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contacto de Emergencia</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.emergency_contact_name || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, emergency_contact_name: e.target.value }
                    })}
                    placeholder="Nombre"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono Emergencia</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.emergency_contact_phone || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, emergency_contact_phone: e.target.value }
                    })}
                    placeholder="Teléfono"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer"
                >
                  Guardar Expediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: CONFIRM DELETE
         ======================================================== */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-slate-400 leading-normal">
                ¿Estás seguro de que deseas eliminar a <strong>{deletingItem.name}</strong>?
                Esta acción borrará de manera definitiva su expediente clínico y su historial de compras.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="flex-1 text-xs font-bold text-slate-955 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 py-2.5 rounded-xl shadow cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
