'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getAllProfiles } from '@/lib/services'
import {
  createUserAction,
  adminUpdateUserAction,
  adminDeleteUserAction
} from '@/app/auth/actions'
import { Database } from '@/types/database.types'
import { 
  User, 
  Settings, 
  Shield, 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ArrowLeft,
  X,
  Clock,
  UserPlus,
  AlertCircle
} from 'lucide-react'

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
    <div className="flex items-center justify-between p-3.5 bg-[#f0f3ff] border border-[#cbd5e1] rounded-xl hover:border-[#cbd5e1] transition-all select-none text-left">
      <div>
        <span className="block text-xs font-bold text-[#111c2d]">{label}</span>
        {description && <span className="block text-[10px] text-[#737784] mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
          checked ? 'bg-[#00357f]' : 'bg-[#cbd5e1]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
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

  // Tabs state
  const [activeTab, setActiveTab] = useState<'staff' | 'config'>('staff')

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
  const [uIsCustomer, setUIsCustomer] = useState(false)
  
  const [submittingUser, setSubmittingUser] = useState(false)

  // Handle mutually exclusive toggle select
  const handleAddToggleChange = (roleType: 'admin' | 'seller' | 'customer', val: boolean) => {
    if (roleType === 'admin') {
      setUIsAdmin(val)
      if (val) {
        setUIsSeller(false)
        setUIsCustomer(false)
      }
    } else if (roleType === 'seller') {
      setUIsSeller(val)
      if (val) {
        setUIsAdmin(false)
        setUIsCustomer(false)
      }
    } else {
      setUIsCustomer(val)
      if (val) {
        setUIsAdmin(false)
        setUIsSeller(false)
      }
    }
  }

  // Edit Toggles state
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editIsSeller, setEditIsSeller] = useState(false)
  const [editIsCustomer, setEditIsCustomer] = useState(false)

  // Start editing user and initialize toggle states explicitly
  const handleStartEdit = (u: Profile) => {
    setEditingUser(u)
    setEditIsAdmin(u.role === 'owner')
    setEditIsSeller(u.role === 'seller')
    setEditIsCustomer(u.role === 'customer')
  }

  const handleEditToggleChange = (roleType: 'admin' | 'seller' | 'customer', val: boolean) => {
    if (roleType === 'admin') {
      setEditIsAdmin(val)
      if (val) {
        setEditIsSeller(false)
        setEditIsCustomer(false)
      }
    } else if (roleType === 'seller') {
      setEditIsSeller(val)
      if (val) {
        setEditIsAdmin(false)
        setEditIsCustomer(false)
      }
    } else {
      setEditIsCustomer(val)
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

    let roleVal: 'owner' | 'seller' | 'customer' | 'dev' = 'customer'
    if (uIsAdmin) roleVal = 'owner'
    else if (uIsSeller) roleVal = 'seller'
    else if (uIsCustomer) roleVal = 'customer'

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
        // Update localStorage mock profiles for offline sync
        if (typeof window !== 'undefined') {
          const formattedEmail = uUsername.includes('@') ? uUsername : `${uUsername}@opticarayo.com`
          const localData = localStorage.getItem('optica_rayo_mock_profiles')
          const mockList = localData ? JSON.parse(localData) : []
          const newProfile = {
            id: 'mock-' + Math.random().toString(36).substr(2, 9),
            email: formattedEmail,
            full_name: uFullName,
            role: roleVal,
            temporal_password_changed: false,
            created_at: new Date().toISOString()
          }
          localStorage.setItem('optica_rayo_mock_profiles', JSON.stringify([...mockList, newProfile]))
        }

        showFeedback('success', res.success || 'Usuario registrado con éxito.')
        setShowAddUserModal(false)
        setUFullName('')
        setUUsername('')
        setUPassword('')
        setUIsAdmin(false)
        setUIsSeller(true)
        setUIsCustomer(false)
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

    let roleVal: 'owner' | 'seller' | 'customer' | 'dev' = 'customer'
    if (editIsAdmin) roleVal = 'owner'
    else if (editIsSeller) roleVal = 'seller'
    else if (editIsCustomer) roleVal = 'customer'

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
        // Update localStorage mock profiles for offline sync
        if (typeof window !== 'undefined') {
          const localData = localStorage.getItem('optica_rayo_mock_profiles')
          if (localData) {
            try {
              const mockList = JSON.parse(localData)
              const updatedList = mockList.map((u: any) => 
                u.id === editingUser.id 
                  ? { ...u, full_name: editingUser.full_name, email: editingUser.email, role: roleVal }
                  : u
              )
              localStorage.setItem('optica_rayo_mock_profiles', JSON.stringify(updatedList))
            } catch (err) {
              // ignore
            }
          }
        }

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
        // Update localStorage mock profiles for offline sync
        if (typeof window !== 'undefined') {
          const localData = localStorage.getItem('optica_rayo_mock_profiles')
          if (localData) {
            try {
              const mockList = JSON.parse(localData)
              const updatedList = mockList.filter((u: any) => u.id !== deletingUser.id)
              localStorage.setItem('optica_rayo_mock_profiles', JSON.stringify(updatedList))
            } catch (err) {
              // ignore
            }
          }
        }

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

  // Filter staff profiles only (role !== 'customer')
  const filteredStaff = useMemo(() => {
    return users
      .filter(u => u.role !== 'customer')
      .filter(u => 
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      )
  }, [users, userSearch])

  // Get active user initials
  const getInitials = (name: string) => {
    if (!name) return 'US'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-8 text-left">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Configuración y Perfil</h1>
          </div>
          <p className="text-sm text-[#434653] mt-1 font-medium pl-8">Gestiona el personal del staff, accesos y opciones de la óptica.</p>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
        }`}>
          {feedbackMsg.text}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Navigation Tabs (3 cols) */}
        <div className="lg:col-span-3 flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-2 lg:pb-0 scrollbar-none">
          <button 
            onClick={() => setActiveTab('staff')}
            className={`flex-shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors text-left cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-[#dee8ff]/80 text-[#00357f]'
                : 'bg-white border border-[#cbd5e1] text-[#434653] hover:bg-[#f0f3ff]'
            }`}
          >
            <Users className="w-4 h-4" />
            Gestión de Personal
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex-shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors text-left cursor-pointer ${
              activeTab === 'config'
                ? 'bg-[#dee8ff]/80 text-[#00357f]'
                : 'bg-white border border-[#cbd5e1] text-[#434653] hover:bg-[#f0f3ff]'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuración de Óptica
          </button>
        </div>

        {/* Right Side: Content Area (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          
          {activeTab === 'staff' && (
            <div className="space-y-6">
              
              {/* Staff Title & Add button */}
              <div className="flex justify-between items-center gap-4">
                <div className="relative max-w-xs flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
                  <input 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg py-2 pl-10 pr-3 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none" 
                    placeholder="Buscar personal..." 
                    type="text"
                  />
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-[#00357f] hover:bg-[#004aad] text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Empleado
                </button>
              </div>

              {/* Staff Grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
                  <p className="text-xs text-[#737784] font-bold">Cargando personal...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  {filteredStaff.map(u => (
                    <div key={u.id} className="bg-white rounded-2xl border border-[#cbd5e1] p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                      <div>
                        {/* Header Role tag */}
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            u.role === 'owner' 
                              ? 'bg-[#dee8ff] text-[#00357f]' 
                              : u.role === 'seller' 
                              ? 'bg-[#dee8ff]/60 text-[#00668a]' 
                              : 'bg-[#49da9f]/20 text-[#00422b]'
                          }`}>
                            {u.role === 'owner' ? 'Administrador' : u.role === 'seller' ? 'Ventas' : 'Optometrista/Dev'}
                          </span>
                        </div>

                        {/* Profile Info */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#00357f] border border-[#cbd5e1] flex items-center justify-center font-bold text-sm shrink-0">
                            {getInitials(u.full_name)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[#111c2d] truncate">{u.full_name}</h4>
                            <p className="text-[10px] text-[#737784] truncate">@{u.email.replace('@opticarayo.com', '')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-[#737784] mb-4 font-medium">
                          <Clock className="w-3.5 h-3.5 text-[#00668a]" /> Turno Completo
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 border-t border-[#f0f3ff] pt-3">
                        <button 
                          onClick={() => handleStartEdit(u)}
                          className="flex-1 bg-[#f0f3ff] hover:bg-[#dee8ff] text-[#111c2d] py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => setDeletingUser(u)}
                          className="flex-1 border border-[#ba1a1a] hover:bg-[#ffdad6] text-[#ba1a1a] py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add New Placeholder Card */}
                  <div 
                    onClick={() => setShowAddUserModal(true)}
                    className="rounded-2xl border-2 border-dashed border-[#cbd5e1] hover:border-[#00357f] hover:bg-[#f0f3ff]/40 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[190px] text-[#737784] group"
                  >
                    <UserPlus className="w-8 h-8 mb-1.5 group-hover:text-[#00357f] transition-colors" />
                    <span className="font-bold text-xs group-hover:text-[#00357f] transition-colors">Invitar Personal</span>
                  </div>

                </div>
              )}

            </div>
          )}

          {activeTab === 'config' && (
            <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-sm overflow-hidden text-left">
              <div className="p-4 border-b border-[#cbd5e1] bg-[#f9f9ff] flex justify-between items-center">
                <h3 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Ajustes Generales de Óptica</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-[#f0f3ff]">
                    <tr className="hover:bg-[#f9f9ff] transition-colors">
                      <td className="py-3.5 px-4 text-[#737784] font-bold w-1/3">Nombre de la Óptica</td>
                      <td className="py-3.5 px-4 text-[#111c2d] font-bold">Óptica Rayo Centro</td>
                    </tr>
                    <tr className="hover:bg-[#f9f9ff] transition-colors">
                      <td className="py-3.5 px-4 text-[#737784] font-bold">Moneda Principal</td>
                      <td className="py-3.5 px-4 text-[#111c2d] font-bold">Peso Mexicano (MXN)</td>
                    </tr>
                    <tr className="hover:bg-[#f9f9ff] transition-colors">
                      <td className="py-3.5 px-4 text-[#737784] font-bold">Horario de Atención</td>
                      <td className="py-3.5 px-4 text-[#111c2d] font-bold">Lun - Sáb, 10:00 - 20:00</td>
                    </tr>
                    <tr className="hover:bg-[#f9f9ff] transition-colors">
                      <td className="py-3.5 px-4 text-[#737784] font-bold">Ciudad / Sede</td>
                      <td className="py-3.5 px-4 text-[#111c2d] font-bold">México D.F.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ========================================================
         MODAL: CREATE STAFF USER
         ======================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-[#cbd5e1] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#cbd5e1] flex justify-between items-center bg-[#f9f9ff]">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Registrar Nuevo Empleado</h2>
              <button 
                onClick={() => setShowAddUserModal(false)}
                className="text-[#737784] hover:text-[#111c2d] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="Ej. Patricia Gómez"
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Nombre de Usuario (Acceso) *</label>
                <input
                  type="text"
                  required
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  placeholder="Ej. patricia_gomez"
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              {/* iOS-style toggle configuration */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-[#434653]">Permisos y Rol</label>
                
                <ToggleSwitch
                  checked={uIsAdmin}
                  onChange={(val) => handleAddToggleChange('admin', val)}
                  label="Administrador / Dueño"
                  description="Acceso total a finanzas, catálogo y empleados."
                />
                <ToggleSwitch
                  checked={uIsSeller}
                  onChange={(val) => handleAddToggleChange('seller', val)}
                  label="Vendedor POS / Cajero"
                  description="Registra ventas, abonos y alta de clientes."
                />
                <ToggleSwitch
                  checked={uIsCustomer}
                  onChange={(val) => handleAddToggleChange('customer', val)}
                  label="Cliente / Paciente"
                  description="Acceso de consulta para recetas, compras y promociones."
                />
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submittingUser ? 'Registrando...' : 'Dar de Alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: EDIT STAFF USER
         ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-[#cbd5e1] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#cbd5e1] flex justify-between items-center bg-[#f9f9ff]">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Modificar Permisos y Datos</h2>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-[#737784] hover:text-[#111c2d] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  value={editingUser.email.replace('@opticarayo.com', '')}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value + '@opticarayo.com' })}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-[#434653]">Modificar Permisos y Rol</label>
                
                <ToggleSwitch
                  checked={editIsAdmin}
                  onChange={(val) => handleEditToggleChange('admin', val)}
                  label="Administrador / Dueño"
                  description="Acceso completo a inventario, finanzas y personal."
                />
                <ToggleSwitch
                  checked={editIsSeller}
                  onChange={(val) => handleEditToggleChange('seller', val)}
                  label="Vendedor POS / Cajero"
                  description="Registra ventas, abonos y alta de clientes."
                />
                <ToggleSwitch
                  checked={editIsCustomer}
                  onChange={(val) => handleEditToggleChange('customer', val)}
                  label="Cliente / Paciente"
                  description="Acceso de consulta para recetas, compras y promociones."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434653] mb-1">Nueva Contraseña (Opcional)</label>
                <input
                  type="password"
                  id="edit-user-pwd"
                  placeholder="Dejar vacío para mantener la actual"
                  minLength={6}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-[#cbd5e1] rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 bg-rose-100 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#111c2d] uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-[#434653] leading-normal font-medium">
                ¿Estás seguro de que deseas eliminar a <strong>{deletingUser.full_name}</strong>?
                Esta acción revocará su acceso del sistema.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 text-xs font-bold text-[#737784] hover:bg-[#dee8ff] py-2.5 rounded-xl border border-[#cbd5e1] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 text-xs font-bold text-white bg-[#ba1a1a] hover:bg-[#93000a] py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
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
