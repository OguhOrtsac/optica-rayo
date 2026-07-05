'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllProfiles } from '@/lib/services'
import {
  createUserAction,
  adminUpdateUserAction,
  adminDeleteUserAction
} from '@/app/auth/actions'
import { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// iOS-style animated Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
  description?: string
}

function ToggleSwitch({ checked, onChange, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl hover:border-slate-850 transition-all select-none">
      <div>
        <span className="block text-xs font-bold text-slate-200">{label}</span>
        {description && <span className="block text-[10px] text-slate-500 mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
          checked ? 'bg-cyan-500' : 'bg-slate-850'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-slate-100 dark:bg-slate-950 shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default function RegisterUsersPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<Profile[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modals state
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null)

  // Add User Form state
  const [uFullName, setUFullName] = useState('')
  const [uUsername, setUUsername] = useState('')
  const [uPassword, setUPassword] = useState('')
  
  // Toggles for roles (iOS-style switch state)
  const [uIsAdmin, setUIsAdmin] = useState(false)
  const [uIsSeller, setUIsSeller] = useState(true)
  const [uIsOptometrist, setUIsOptometrist] = useState(false)
  
  const [submittingUser, setSubmittingUser] = useState(false)

  // Handle mutually exclusive toggle select
  const handleAddToggleChange = (roleType: 'admin' | 'seller' | 'optometrist', val: boolean) => {
    if (roleType === 'admin') {
      setUIsAdmin(val)
      if (val) {
        setUIsSeller(false)
        setUIsOptometrist(false)
      }
    } else if (roleType === 'seller') {
      setUIsSeller(val)
      if (val) {
        setUIsAdmin(false)
        setUIsOptometrist(false)
      }
    } else {
      setUIsOptometrist(val)
      if (val) {
        setUIsAdmin(false)
        setUIsSeller(false)
      }
    }
  }

  // Edit Toggles state
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editIsSeller, setEditIsSeller] = useState(false)
  const [editIsOptometrist, setEditIsOptometrist] = useState(false)

  // Set edit toggles when editingUser changes
  useEffect(() => {
    if (editingUser) {
      setEditIsAdmin(editingUser.role === 'owner')
      setEditIsSeller(editingUser.role === 'seller')
      setEditIsOptometrist(editingUser.role === 'dev') // mapping dev as Optometrist/Dev control
    }
  }, [editingUser])

  const handleEditToggleChange = (roleType: 'admin' | 'seller' | 'optometrist', val: boolean) => {
    if (roleType === 'admin') {
      setEditIsAdmin(val)
      if (val) {
        setEditIsSeller(false)
        setEditIsOptometrist(false)
      }
    } else if (roleType === 'seller') {
      setEditIsSeller(val)
      if (val) {
        setEditIsAdmin(false)
        setEditIsOptometrist(false)
      }
    } else {
      setEditIsOptometrist(val)
      if (val) {
        setEditIsAdmin(false)
        setEditIsSeller(false)
      }
    }
  }

  const loadUsersData = async () => {
    try {
      setLoading(true)
      const data = await getAllProfiles()
      setUsers(data)
    } catch (e) {
      showFeedback('error', 'Error al cargar los usuarios del sistema.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsersData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Add User Submit
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uFullName.trim() || !uUsername.trim() || !uPassword) {
      showFeedback('error', 'Todos los campos son obligatorios.')
      return
    }

    // Determine role based on toggles
    let roleVal: 'owner' | 'seller' | 'customer' | 'dev' = 'customer'
    if (uIsAdmin) roleVal = 'owner'
    else if (uIsSeller) roleVal = 'seller'
    else if (uIsOptometrist) roleVal = 'dev' // mapping optometrist to dev in current schema

    setSubmittingUser(true)
    const formData = new FormData()
    formData.append('fullName', uFullName)
    formData.append('username', uUsername)
    formData.append('password', uPassword)
    formData.append('role', roleVal)

    try {
      const res = await createUserAction({ error: null, success: null }, formData)
      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', res.success || 'Usuario registrado con éxito.')
        setShowAddUserModal(false)
        setUFullName('')
        setUUsername('')
        setUPassword('')
        setUIsAdmin(false)
        setUIsSeller(true)
        setUIsOptometrist(false)
        await loadUsersData()
      }
    } catch (e) {
      showFeedback('error', 'Error al registrar el usuario.')
    } finally {
      setSubmittingUser(false)
    }
  }

  // Update User Submit
  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    // Determine role based on toggles
    let roleVal: 'owner' | 'seller' | 'customer' | 'dev' = 'customer'
    if (editIsAdmin) roleVal = 'owner'
    else if (editIsSeller) roleVal = 'seller'
    else if (editIsOptometrist) roleVal = 'dev'

    try {
      const editPasswordInput = document.getElementById('edit-user-pwd') as HTMLInputElement
      const pwd = editPasswordInput?.value || undefined
      const usernameVal = editingUser.email.replace('@opticarayo.com', '')

      const res = await adminUpdateUserAction(editingUser.id, {
        fullName: editingUser.full_name,
        username: usernameVal,
        role: roleVal,
        password: pwd || undefined
      })

      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', res.success || 'Usuario actualizado correctamente.')
        setEditingUser(null)
        await loadUsersData()
      }
    } catch (e) {
      showFeedback('error', 'Fallo al actualizar usuario.')
    }
  }

  // Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return
    try {
      const res = await adminDeleteUserAction(deletingUser.id)
      if (res.success) {
        showFeedback('success', res.success)
      } else if (res.error) {
        showFeedback('error', res.error)
      }
      setDeletingUser(null)
      await loadUsersData()
    } catch (e) {
      showFeedback('error', 'Error al eliminar el usuario.')
    }
  }

  // Filter calculation
  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 pb-24 relative">
      <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        
        {/* Back and Header */}
        <div className="space-y-4">
          <Link
            href="/dashboard/admin"
            className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 w-fit min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel Principal
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Control de Personal y Accesos
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Registra tu staff, asigna roles de administración o ventas, y gestiona sus permisos con interruptores interactivos.
              </p>
            </div>
            
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold text-xs px-5 py-3 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 min-h-[44px]"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Alta de Personal
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
            placeholder="Buscar por nombre o usuario de acceso..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-full bg-slate-900/40 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all min-h-[44px]"
          />
        </div>

        {/* Main List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500 font-bold">Recuperando listado del personal...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
            No se encontraron usuarios para tu búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(u => (
              <div
                key={u.id}
                className="bg-slate-900/30 border border-slate-900/60 hover:border-cyan-500/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-950/5 group"
              >
                <div className="flex gap-4">
                  <div className="w-11 h-11 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center font-black text-cyan-400 text-xs shrink-0 select-none">
                    {u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                      {u.full_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate">@{u.email.replace('@opticarayo.com', '')}</p>
                    
                    {/* Role Badge */}
                    <div className="pt-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                        u.role === 'owner' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                        u.role === 'seller' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        u.role === 'dev' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {u.role === 'owner' ? 'Administrador' : u.role === 'seller' ? 'Vendedor POS' : u.role === 'dev' ? 'Optometrista/Dev' : 'Paciente/Cliente'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-950 pt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingUser(u)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-3.5 py-2 rounded-lg transition-all cursor-pointer min-h-[34px]"
                  >
                    Modificar
                  </button>
                  <button
                    onClick={() => setDeletingUser(u)}
                    className="text-[10px] font-bold text-rose-455 hover:text-rose-400 bg-rose-50/5 border border-rose-500/10 px-3.5 py-2 rounded-lg transition-all cursor-pointer min-h-[34px]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ========================================================
         MODAL: ALTA DE PERSONAL CON TOGGLES
         ======================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Registrar Nuevo Empleado</h2>
            
            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="Ej. Patricia Gómez"
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de Usuario (Login) *</label>
                <input
                  type="text"
                  required
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  placeholder="Ej. patricia_pos"
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                />
              </div>

              {/* IOS TOGGLES FOR PERMISSIONS & ROLES */}
              <div className="space-y-2.5 pt-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Permisos y Asignación de Roles
                </label>
                
                <ToggleSwitch
                  checked={uIsAdmin}
                  onChange={(val) => handleAddToggleChange('admin', val)}
                  label="Administrador / Dueño"
                  description="Acceso completo a inventario, finanzas y personal."
                />
                
                <ToggleSwitch
                  checked={uIsSeller}
                  onChange={(val) => handleAddToggleChange('seller', val)}
                  label="Ventas / Punto de Venta"
                  description="Acceso para cotizar, cobrar y registrar pacientes."
                />

                <ToggleSwitch
                  checked={uIsOptometrist}
                  onChange={(val) => handleAddToggleChange('optometrist', val)}
                  label="Optometrista / Clínico"
                  description="Acceso para diagnosticar y guardar recetas ópticas."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-950">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2.5 rounded-xl cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {submittingUser ? 'Registrando...' : 'Dar de Alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: MODIFICAR PERSONAL CON TOGGLES
         ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Modificar Información y Permisos</h2>
            
            <form onSubmit={handleUpdateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Usuario (Acceso) *</label>
                <input
                  type="text"
                  required
                  value={editingUser.email.replace('@opticarayo.com', '')}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value + '@opticarayo.com' })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* IOS TOGGLES FOR PERMISSIONS & ROLES IN EDIT MODE */}
              <div className="space-y-2.5 pt-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Modificar Permisos y Roles
                </label>
                
                <ToggleSwitch
                  checked={editIsAdmin}
                  onChange={(val) => handleEditToggleChange('admin', val)}
                  label="Administrador / Dueño"
                  description="Acceso completo a inventario, finanzas y personal."
                />
                
                <ToggleSwitch
                  checked={editIsSeller}
                  onChange={(val) => handleEditToggleChange('seller', val)}
                  label="Ventas / Punto de Venta"
                  description="Acceso para cotizar, cobrar y registrar pacientes."
                />

                <ToggleSwitch
                  checked={editIsOptometrist}
                  onChange={(val) => handleEditToggleChange('optometrist', val)}
                  label="Optometrista / Clínico"
                  description="Acceso para diagnosticar y guardar recetas ópticas."
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cambiar Contraseña (Opcional)</label>
                <input
                  type="password"
                  id="edit-user-pwd"
                  placeholder="Dejar vacío para mantener la actual"
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-950">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2.5 rounded-xl cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer min-h-[44px]"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: CONFIRM DELETE
         ======================================================== */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-455 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-slate-400 leading-normal">
                ¿Estás seguro de que deseas eliminar a <strong>{deletingUser.full_name}</strong>?
                Esta acción borrará permanentemente sus credenciales de acceso del sistema.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-2.5 rounded-xl cursor-pointer min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 text-xs font-bold text-slate-955 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-450 hover:to-red-500 py-2.5 rounded-xl shadow cursor-pointer min-h-[44px]"
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
