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
  const [uRole, setURole] = useState<'owner' | 'seller' | 'customer'>('seller')
  const [submittingUser, setSubmittingUser] = useState(false)

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

    setSubmittingUser(true)
    const formData = new FormData()
    formData.append('fullName', uFullName)
    formData.append('username', uUsername)
    formData.append('password', uPassword)
    formData.append('role', uRole)

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
        setURole('seller')
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

    try {
      const editPasswordInput = document.getElementById('edit-user-pwd') as HTMLInputElement
      const pwd = editPasswordInput?.value || undefined

      const usernameVal = editingUser.email.replace('@opticarayo.com', '')

      const res = await adminUpdateUserAction(editingUser.id, {
        fullName: editingUser.full_name,
        username: usernameVal,
        role: editingUser.role,
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
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 space-y-6 relative">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        
        {/* Back and Header */}
        <div className="space-y-4">
          <Link
            href="/dashboard/admin"
            className="text-xs font-bold text-slate-500 hover:text-slate-355 transition-colors flex items-center gap-1.5 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel Principal
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Control de Usuarios y Personal
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Registra personal, asigna roles de Dueño/Vendedor y gestiona los accesos del sistema.
              </p>
            </div>
            
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
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
            placeholder="Buscar personal por nombre o correo..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-655 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Main Loading / List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500">Cargando personal...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
            No se encontraron usuarios para tu búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(u => (
              <div
                key={u.id}
                className="bg-slate-900/30 border border-slate-900/60 hover:border-cyan-500/20 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-950/5 group"
              >
                <div className="flex gap-4">
                  <div className="w-11 h-11 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center font-bold text-slate-350 text-xs shrink-0 select-none">
                    {u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                      {u.full_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate">@{u.email.replace('@opticarayo.com', '')}</p>
                    
                    {/* Role Badge */}
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                      u.role === 'owner' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                      u.role === 'seller' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      u.role === 'dev' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {u.role === 'owner' ? 'Dueño' : u.role === 'seller' ? 'Vendedor' : u.role === 'dev' ? 'Desarrollador' : 'Cliente'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-950 pt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingUser(u)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    Modificar
                  </button>
                  <button
                    onClick={() => setDeletingUser(u)}
                    className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-50/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
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
         MODAL: ADD USER (ALTA DE PERSONAL)
         ======================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Alta de Personal</h2>
            
            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="Ej. Hugo Ortsac"
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Nombre de Usuario (Acceso) *</label>
                <input
                  type="text"
                  required
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  placeholder="ej. hugo"
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Contraseña Inicial *</label>
                  <input
                    type="password"
                    required
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Rol *</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
                  >
                    <option value="owner">Dueño</option>
                    <option value="seller">Vendedor</option>
                    <option value="customer">Cliente</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Registrando...' : 'Registrar Personal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: EDIT USER
         ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Modificar Personal</h2>
            
            <form onSubmit={handleUpdateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Usuario (Acceso) *</label>
                <input
                  type="text"
                  required
                  value={editingUser.email.replace('@opticarayo.com', '')}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value + '@opticarayo.com' })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rol</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
                >
                  <option value="owner">Dueño</option>
                  <option value="seller">Vendedor</option>
                  <option value="dev">Desarrollador</option>
                  <option value="customer">Cliente</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cambiar Contraseña (Opcional)</label>
                <input
                  type="password"
                  id="edit-user-pwd"
                  placeholder="Dejar vacío para mantener actual"
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer"
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
                Esta acción no se puede deshacer y borrará permanentemente sus relaciones.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 text-xs font-bold text-slate-955 bg-gradient-to-r from-rose-500 to-red-650 hover:from-rose-400 hover:to-red-500 py-2.5 rounded-xl shadow cursor-pointer"
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
