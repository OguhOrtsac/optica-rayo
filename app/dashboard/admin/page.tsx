'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getSales,
  searchCustomers,
  getAllProfiles,
  uploadProductImage
} from '@/lib/services'
import {
  createUserAction,
  adminUpdateUserAction,
  adminDeleteUserAction
} from '@/app/auth/actions'
import {
  updateCustomerAction,
  registerCustomerAction
} from '@/app/customers/actions'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Sale = Database['public']['Tables']['sales']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export default function AdminDashboard() {
  // Navigation tabs: 'summary' | 'customers' | 'products' | 'users'
  const [activeTab, setActiveTab] = useState<'summary' | 'customers' | 'products' | 'users'>('summary')
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Data states
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string })[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [users, setUsers] = useState<Profile[]>([])

  // Search states
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all')
  const [customerSearch, setCustomerSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // Notifications
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Product Form states
  const [pName, setPName] = useState('')
  const [pDescription, setPDescription] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pStock, setPStock] = useState('')
  const [pCategory, setPCategory] = useState<'frames' | 'lenses' | 'contact_lenses' | 'accessories'>('frames')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [pImagePreview, setPImagePreview] = useState<string>('')
  const [submittingProduct, setSubmittingProduct] = useState(false)

  // Edit / Delete Modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string; type: 'product' | 'customer' | 'user' } | null>(null)

  // Quick modals for adding customer / user inline
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)

  // Add User Form state
  const [uFullName, setUFullName] = useState('')
  const [uUsername, setUUsername] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uRole, setURole] = useState<'owner' | 'seller' | 'customer'>('seller')

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

  // Load dashboard data
  const loadAllData = async () => {
    try {
      setLoading(true)
      const [productsData, salesData, customersData, usersData] = await Promise.all([
        getProducts(),
        getSales(),
        searchCustomers(''),
        getAllProfiles()
      ])
      setProducts(productsData)
      setSales(salesData)
      setCustomers(customersData)
      setUsers(usersData)
    } catch (e) {
      showFeedback('error', 'Error al cargar los datos del servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Handle Product image select
  const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Create Product Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pName.trim() || !pPrice || !pStock) {
      showFeedback('error', 'Por favor, llena los campos obligatorios del producto.')
      return
    }

    setSubmittingProduct(true)
    try {
      let imageUrl = null
      if (pImageFile) {
        imageUrl = await uploadProductImage(pImageFile)
      }

      await createProduct({
        name: pName,
        description: pDescription || null,
        price: parseFloat(pPrice),
        stock: parseInt(pStock),
        category: pCategory,
        image_url: imageUrl
      })

      showFeedback('success', '¡Producto añadido exitosamente al catálogo!')
      setPName('')
      setPDescription('')
      setPPrice('')
      setPStock('')
      setPCategory('frames')
      setPImageFile(null)
      setPImagePreview('')
      await loadAllData()
    } catch (e) {
      showFeedback('error', 'Error al registrar el producto.')
    } finally {
      setSubmittingProduct(false)
    }
  }

  // Update Product Submit
  const handleUpdateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    try {
      let finalImageUrl = editingProduct.image_url
      // If there's a new file selected in the edit form
      const fileInput = document.getElementById('edit-product-file') as HTMLInputElement
      if (fileInput && fileInput.files && fileInput.files[0]) {
        finalImageUrl = await uploadProductImage(fileInput.files[0])
      }

      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        stock: editingProduct.stock,
        category: editingProduct.category,
        image_url: finalImageUrl
      })

      showFeedback('success', 'Producto actualizado correctamente.')
      setEditingProduct(null)
      await loadAllData()
    } catch (e) {
      showFeedback('error', 'Fallo al actualizar el producto.')
    }
  }

  // Delete Confirm Action
  const handleDeleteItem = async () => {
    if (!deletingItem) return
    try {
      if (deletingItem.type === 'product') {
        const ok = await deleteProduct(deletingItem.id)
        if (ok) showFeedback('success', 'Producto eliminado con éxito.')
        else throw new Error()
      } else if (deletingItem.type === 'customer' || deletingItem.type === 'user') {
        const res = await adminDeleteUserAction(deletingItem.id)
        if (res.success) showFeedback('success', res.success)
        else if (res.error) showFeedback('error', res.error)
      }
      setDeletingItem(null)
      await loadAllData()
    } catch (e) {
      showFeedback('error', 'Error al eliminar el elemento.')
    }
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
        await loadAllData()
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
        await loadAllData()
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error al actualizar expediente.')
    }
  }

  // Add User Submit
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uFullName.trim() || !uUsername.trim() || !uPassword) {
      showFeedback('error', 'Todos los campos son obligatorios.')
      return
    }

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
        showFeedback('success', res.success || 'Usuario de personal registrado.')
        setShowAddUserModal(false)
        setUFullName('')
        setUUsername('')
        setUPassword('')
        setURole('seller')
        await loadAllData()
      }
    } catch (e) {
      showFeedback('error', 'Error del servidor al registrar personal.')
    }
  }

  // Update User Submit
  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const editPasswordInput = document.getElementById('edit-user-pwd') as HTMLInputElement
      const pwd = editPasswordInput?.value || undefined

      const res = await adminUpdateUserAction(editingUser.id, {
        fullName: editingUser.full_name,
        username: editingUser.email.replace('@opticarayo.com', ''),
        role: editingUser.role,
        password: pwd || undefined
      })

      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', res.success || 'Usuario actualizado correctamente.')
        setEditingUser(null)
        await loadAllData()
      }
    } catch (e) {
      showFeedback('error', 'Fallo al actualizar usuario.')
    }
  }

  // Helpers
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Business calculations
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const lowStockCount = products.filter(p => p.stock < 5).length

  // Filter calculations
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.description || '').toLowerCase().includes(productSearch.toLowerCase())
    const matchesCat = productCategoryFilter === 'all' || p.category === productCategoryFilter
    return matchesSearch && matchesCat
  })

  const filteredCustomers = customers.filter(c => 
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 relative">
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Panel del Dueño
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Gestión integral de clientes, catálogo de inventario, finanzas y personal.
            </p>
          </div>
          
          {/* Quick Stats banner */}
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-400 bg-slate-900/30 border border-slate-900 rounded-xl px-4 py-2">
            <div>
              Ventas: <span className="text-cyan-400 font-bold">{sales.length}</span>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              Ingresos: <span className="text-emerald-400 font-bold">{formatPrice(totalRevenue)}</span>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              Alerta Stock: <span className={`${lowStockCount > 0 ? 'text-rose-450' : 'text-slate-400'} font-bold`}>{lowStockCount}</span>
            </div>
          </div>
        </div>

        {/* Global Feedback message */}
        {feedbackMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* Premium Animated Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'summary', label: 'Resumen', color: 'cyan', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0v-8a2 2 0 00-2-2h-2a2 2 0 00-2 2v8a2 2 0 002 2h2a2 2 0 002-2z' },
            { id: 'customers', label: 'Clientes (Pacientes)', color: 'cyan', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { id: 'products', label: 'Catálogo (Productos)', color: 'cyan', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { id: 'users', label: 'Personal (Usuarios)', color: 'cyan', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-300 transform cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-tr from-cyan-500/15 to-indigo-500/15 border-cyan-500 text-cyan-400 scale-[1.03] shadow-lg shadow-cyan-550/10'
                  : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:scale-[1.02] hover:-translate-y-0.5 text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-6 h-6 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="text-xs font-bold tracking-wide">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500">Recuperando información...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* VIEW: SUMMARY */}
            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
                {/* Inventory stock status card */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Stock del Inventario</h2>
                    <span className="text-[10px] text-slate-500 font-bold">{products.length} SKU</span>
                  </div>
                  <div className="overflow-y-auto max-h-[350px] pr-2 space-y-2.5">
                    {products.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-slate-950/40 border border-slate-900 px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-300 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{p.category === 'frames' ? 'Armazón' : p.category}</p>
                        </div>
                        <div className="text-right pl-3 shrink-0">
                          <p className="font-semibold text-slate-200">{formatPrice(p.price)}</p>
                          <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            p.stock < 5 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-900 text-slate-400'
                          }`}>
                            {p.stock} pz
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales Ledger Card */}
                <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Historial de Transacciones</h2>
                    <span className="text-[10px] text-slate-500 font-bold">{sales.length} Ventas</span>
                  </div>
                  <div className="overflow-y-auto max-h-[350px] pr-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 uppercase font-bold tracking-wider">
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Vendedor</th>
                          <th className="py-2.5 px-3 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-950">
                        {sales.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="py-2.5 px-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-350">{s.customer_name || 'Anónimo'}</td>
                            <td className="py-2.5 px-3 text-slate-400">{s.seller_name || 'Staff'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-cyan-400">{formatPrice(s.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: CUSTOMERS */}
            {activeTab === 'customers' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  {/* Search box */}
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar clientes por nombre o correo..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transform active:scale-98 transition-all"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Registrar Paciente
                  </button>
                </div>

                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
                    No se encontraron pacientes para tu búsqueda.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg transition-all"
                            >
                              Modificar
                            </button>
                            <button
                              onClick={() => setDeletingItem({ id: c.id, name: c.full_name, type: 'customer' })}
                              className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-500/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all"
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
            )}

            {/* VIEW: PRODUCTS */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
                {/* Left: Add Product Form */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 h-fit space-y-5">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Nuevo Producto</h2>
                  
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Nombre del Artículo *
                      </label>
                      <input
                        type="text"
                        required
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="Ej. Armazón Ray-Ban Black"
                        className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={pDescription}
                        onChange={(e) => setPDescription(e.target.value)}
                        placeholder="Materiales, dimensiones..."
                        className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[60px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Precio ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={pPrice}
                          onChange={(e) => setPPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Stock Inicial *
                        </label>
                        <input
                          type="number"
                          required
                          value={pStock}
                          onChange={(e) => setPStock(e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Categoría *
                      </label>
                      <select
                        value={pCategory}
                        onChange={(e) => setPCategory(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="frames">Armazones</option>
                        <option value="lenses">Micas</option>
                        <option value="contact_lenses">Lentes de Contacto</option>
                        <option value="accessories">Accesorios</option>
                      </select>
                    </div>

                    {/* Image selector */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Imagen del Producto
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-all">
                          Seleccionar Archivo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProductImageSelect}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                          {pImageFile ? pImageFile.name : 'Ningún archivo'}
                        </span>
                      </div>
                      
                      {/* Preview */}
                      {pImagePreview && (
                        <div className="mt-3 relative w-16 h-16 rounded-lg overflow-hidden border border-slate-900 bg-slate-950">
                          <img
                            src={pImagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => { setPImageFile(null); setPImagePreview('') }}
                            className="absolute top-0.5 right-0.5 bg-slate-900/80 hover:bg-slate-950 text-rose-450 p-0.5 rounded-full"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submittingProduct}
                      className="w-full bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-cyan-500/10 cursor-pointer transform active:scale-98 transition-all disabled:opacity-50"
                    >
                      {submittingProduct ? 'Añadiendo...' : 'Añadir al Inventario'}
                    </button>
                  </form>
                </div>

                {/* Right: Products List with search */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500 flex-1"
                    />
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-250 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="all">Todas las Categorías</option>
                      <option value="frames">Armazones</option>
                      <option value="lenses">Micas</option>
                      <option value="contact_lenses">Lentes de Contacto</option>
                      <option value="accessories">Accesorios</option>
                    </select>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
                      No se encontraron productos en el inventario.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          className="bg-slate-900/30 border border-slate-900/60 rounded-2xl p-4 flex flex-col justify-between gap-4"
                        >
                          <div className="flex gap-4">
                            {p.image_url ? (
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-900 shrink-0">
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-900 shrink-0 flex items-center justify-center text-slate-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider">
                                {p.category === 'frames' && 'Armazón'}
                                {p.category === 'lenses' && 'Mica'}
                                {p.category === 'contact_lenses' && 'Lente de Contacto'}
                                {p.category === 'accessories' && 'Accesorio'}
                              </span>
                              <h3 className="font-bold text-sm text-slate-200 truncate mt-0.5">{p.name}</h3>
                              <p className="font-black text-cyan-400 text-xs mt-1">{formatPrice(p.price)}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-950 pt-3 flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.stock < 5 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-950 text-slate-500'
                            }`}>
                              Stock: {p.stock} pz
                            </span>

                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingProduct(p)}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg transition-all"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setDeletingItem({ id: p.id, name: p.name, type: 'product' })}
                                className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-500/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all"
                              >
                                Borrar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW: USERS */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  {/* Search box */}
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar personal por nombre..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-955 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transform active:scale-98 transition-all"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Alta de Personal
                  </button>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/15 border border-slate-900 rounded-2xl text-slate-500 text-xs">
                    No se encontraron usuarios de personal.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredUsers.map(u => (
                      <div
                        key={u.id}
                        className="bg-slate-900/30 border border-slate-900/60 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group"
                      >
                        <div className="flex gap-4">
                          <div className="w-11 h-11 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center font-bold text-slate-350 text-xs shrink-0 select-none">
                            {u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm text-slate-200 truncate">
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
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Modificar
                          </button>
                          <button
                            onClick={() => setDeletingItem({ id: u.id, name: u.full_name, type: 'user' })}
                            className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-500/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================
         MODAL: EDIT PRODUCT
         ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Modificar Producto</h2>
            
            <form onSubmit={handleUpdateProductSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nombre</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descripción</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value || null })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-100 min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Stock</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                >
                  <option value="frames">Armazones</option>
                  <option value="lenses">Micas</option>
                  <option value="contact_lenses">Lentes de Contacto</option>
                  <option value="accessories">Accesorios</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Actualizar Imagen</label>
                <input
                  type="file"
                  id="edit-product-file"
                  accept="image/*"
                  className="w-full text-xs text-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow"
                >
                  Guardar Cambios
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow animate-pulse-subtle"
                >
                  Guardar Expediente
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow"
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
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
                Esta acción no se puede deshacer y borrará permanentemente sus relaciones.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="flex-1 text-xs font-bold text-slate-955 bg-gradient-to-r from-rose-500 to-red-650 hover:from-rose-400 hover:to-red-500 py-2.5 rounded-xl shadow"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: ADD CUSTOMER INLINE
         ======================================================== */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Nuevo Paciente</h2>
            
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Nombre Completo *</label>
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
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Nombre de Usuario *</label>
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
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="10 dígitos"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-455 mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={cDOB}
                    onChange={(e) => setCDOB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={cAddress}
                    onChange={(e) => setCAddress(e.target.value)}
                    placeholder="Calle, Número, Colonia"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Ocupación</label>
                  <input
                    type="text"
                    value={cOccupation}
                    onChange={(e) => setCOccupation(e.target.value)}
                    placeholder="Ocupación"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Tipo de Sangre</label>
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
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Antecedentes Médicos</label>
                  <textarea
                    value={cMedicalNotes}
                    onChange={(e) => setCMedicalNotes(e.target.value)}
                    placeholder="Alergias, diabetes, cirugías previas..."
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100 min-h-[50px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Contacto Emergencia</label>
                  <input
                    type="text"
                    value={cEmergencyName}
                    onChange={(e) => setCEmergencyName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 mb-1">Teléfono Emergencia</label>
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
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow"
                >
                  Crear Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: ADD USER INLINE
         ======================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow"
                >
                  Registrar Personal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}
