'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  searchCustomers,
  getCustomerExams,
  getCustomerSales
} from '@/lib/services'
import {
  adminDeleteUserAction
} from '@/app/auth/actions'
import {
  updateCustomerAction,
  registerCustomerAction
} from '@/app/customers/actions'
import {
  Search,
  Plus,
  User,
  Edit2,
  Trash2,
  Calendar,
  Phone,
  Eye,
  ShoppingBag,
  ArrowLeft,
  X,
  PlusCircle,
  FileText,
  AlertCircle,
  ChevronRight,
  Mail,
  MapPin,
  Briefcase,
  Award
} from 'lucide-react'

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Master-Detail State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedCustomerExams, setSelectedCustomerExams] = useState<any[]>([])
  const [selectedCustomerSales, setSelectedCustomerSales] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

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
      if (customersData.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(customersData[0].id)
      }
    } catch (e) {
      showFeedback('error', 'Error al cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomersData()
  }, [])

  // Load selected customer details
  useEffect(() => {
    if (selectedCustomerId) {
      const loadDetails = async () => {
        setLoadingDetails(true)
        try {
          const [exams, sales] = await Promise.all([
            getCustomerExams(selectedCustomerId),
            getCustomerSales(selectedCustomerId)
          ])
          setSelectedCustomerExams(exams)
          setSelectedCustomerSales(sales)
        } catch (e) {
          console.error('Error al recuperar historial del cliente:', e)
        } finally {
          setLoadingDetails(false)
        }
      }
      loadDetails()
    }
  }, [selectedCustomerId])

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
        if (selectedCustomerId === deletingItem.id) {
          setSelectedCustomerId(null)
        }
      } else if (res.error) {
        showFeedback('error', res.error)
      }
      setDeletingItem(null)
      await loadCustomersData()
    } catch (e) {
      showFeedback('error', 'Error al eliminar el cliente.')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  const calculateAge = (dob: string) => {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const latestSaleDateStr = useMemo(() => {
    if (selectedCustomerSales.length === 0) return 'Sin compras'
    const sorted = [...selectedCustomerSales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return new Date(sorted[0].created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [selectedCustomerSales])

  const latestExamDateStr = useMemo(() => {
    if (selectedCustomerExams.length === 0) return 'Sin exámenes'
    const sorted = [...selectedCustomerExams].sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime())
    return new Date(sorted[0].exam_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [selectedCustomerExams])

  const totalPending = useMemo(() => {
    return selectedCustomerSales.reduce((sum, s) => sum + (s.pending_balance || 0), 0)
  }, [selectedCustomerSales])

  // Filter calculation
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
    )
  }, [customers, customerSearch])

  // Get selected customer object
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Get active initials
  const getInitials = (name: string) => {
    if (!name) return 'PT'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Get last exam data
  const latestExam = useMemo(() => {
    if (selectedCustomerExams.length === 0) return null
    return selectedCustomerExams[0]
  }, [selectedCustomerExams])

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Clientes y Exámenes</h1>
          </div>
          <p className="text-sm text-[#434653] mt-1 font-medium pl-8">Visualice expedientes clínicos, recetas y compras.</p>
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

      {/* Main Master-Detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-[calc(100vh-12rem)] md:h-auto">
        
        {/* Left Side: Directory & List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 bg-white p-4 rounded-2xl border border-[#cbd5e1] shadow-sm h-full max-h-[600px]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
            <input 
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg py-2 pl-10 pr-3 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none" 
              placeholder="Buscar cliente por nombre..." 
              type="text"
            />
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border border-[#cbd5e1]/50 divide-y divide-[#cbd5e1]/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#00357f] border-t-transparent" />
                <p className="text-[10px] text-[#737784]">Cargando...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-xs text-[#737784] text-center py-10 font-bold">Sin resultados.</p>
            ) : (
              filteredCustomers.map(c => {
                const isActive = c.id === selectedCustomerId
                return (
                  <div
                    key={c.id}
                    className={`w-full border-b border-[#cbd5e1]/30 last:border-b-0 transition-all duration-300 ${isActive ? 'bg-[#dee8ff]/10' : ''}`}
                  >
                    <button
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`w-full flex items-center justify-between p-3 transition-colors ${
                        isActive 
                          ? 'bg-[#dee8ff]/60 border-l-4 border-[#00357f]' 
                          : 'bg-white hover:bg-[#f0f3ff] border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isActive ? 'bg-[#00357f] text-white' : 'bg-[#dee8ff] text-[#00357f]'
                        }`}>
                          {getInitials(c.full_name)}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold text-[#111c2d] truncate">{c.full_name}</p>
                          <p className="text-[9px] text-[#737784] truncate">@{c.email?.replace('@opticarayo.com', '')}</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#00357f] rotate-90' : 'text-[#cbd5e1]'}`} />
                    </button>

                    {/* Detalle colapsable en móvil */}
                    {isActive && (
                      <div className="block lg:hidden border-t border-[#cbd5e1]/45 bg-[#f9f9ff] px-3 py-4 space-y-4">
                        {loadingDetails ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="w-5 h-5 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-4 text-left">
                            {/* Acciones Rápidas */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <div className="text-[10px] text-[#737784] font-bold">
                                ID: {c.id.slice(0, 8).toUpperCase()}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCustomer(c)}
                                  className="px-3 py-2 border border-[#737784] hover:bg-[#f0f3ff] text-[#00357f] rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Editar Perfil
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingItem({ id: c.id, name: c.full_name })}
                                  className="px-3 py-2 border border-rose-500/20 hover:bg-rose-50 text-[#ba1a1a] rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </button>
                                <Link
                                  href={`/customers/${c.id}/exam/new`}
                                  className="col-span-2 py-2 bg-[#00668a] hover:bg-[#004c69] text-white text-center rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Registrar Examen
                                </Link>
                                <Link
                                  href={`/customers/${c.id}/sale/new`}
                                  className="col-span-2 py-2 bg-[#00357f] hover:bg-[#004aad] text-white text-center rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Registrar Venta
                                </Link>
                              </div>
                            </div>

                            {/* Resumen Operativo */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider border-b border-[#cbd5e1]/30 pb-1">Resumen Operativo</h4>
                              <div className="space-y-1.5 text-[10px] font-medium">
                                <div className="flex justify-between">
                                  <span className="text-[#737784]">Último Examen:</span>
                                  <span className="font-bold text-[#111c2d]">{latestExamDateStr}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#737784]">Última Compra:</span>
                                  <span className="font-bold text-[#111c2d]">{latestSaleDateStr}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-[#cbd5e1]/30 pt-1.5 mt-1.5">
                                  <span className="text-[#737784]">Saldo Pendiente:</span>
                                  <span className={`font-black text-xs ${totalPending > 0 ? 'text-[#ba1a1a]' : 'text-emerald-600'}`}>
                                    {formatPrice(totalPending)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Detalles del Perfil */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider border-b border-[#cbd5e1]/30 pb-1">Detalles del Perfil</h4>
                              <div className="space-y-1.5 text-[10px] font-medium">
                                <div className="flex items-center gap-1.5 text-[#434653]">
                                  <Mail className="w-3.5 h-3.5 text-[#737784] shrink-0" />
                                  <span className="truncate">{c.email}</span>
                                </div>
                                {c.customer_profiles?.phone && (
                                  <div className="flex items-center gap-1.5 text-[#434653]">
                                    <Phone className="w-3.5 h-3.5 text-[#737784] shrink-0" />
                                    <span>Teléfono: {c.customer_profiles.phone}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[#434653]">
                                  <Calendar className="w-3.5 h-3.5 text-[#737784] shrink-0" />
                                  <span>Nacimiento: {c.customer_profiles?.date_of_birth ? formatDate(c.customer_profiles.date_of_birth) : 'No especificado'} {c.customer_profiles?.date_of_birth && `(${calculateAge(c.customer_profiles.date_of_birth)} años)`}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[#434653]">
                                  <Briefcase className="w-3.5 h-3.5 text-[#737784] shrink-0" />
                                  <span>Ocupación: {c.customer_profiles?.occupation || 'No especificada'}</span>
                                </div>
                                {c.customer_profiles?.blood_type && (
                                  <div className="flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-[#737784] shrink-0" />
                                    <span className="bg-[#dee8ff] text-[#00357f] font-bold px-1.5 py-0.5 rounded text-[8px]">
                                      Tipo Sangre: {c.customer_profiles.blood_type}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-start gap-1.5 text-[#434653] pt-1 border-t border-[#cbd5e1]/20">
                                  <MapPin className="w-3.5 h-3.5 text-[#737784] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">Dir: {c.customer_profiles?.address || 'Sin dirección'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Historial Clínico & Emergencia */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <h4 className="font-extrabold text-[#00357f] uppercase text-[9px] tracking-wider border-b border-[#cbd5e1]/30 pb-1">Historial Clínico</h4>
                              <div className="space-y-2 text-[10px] font-medium">
                                <div className="bg-[#ffdad6]/20 border border-[#ffdad6] p-2 rounded-lg">
                                  <span className="block text-[8px] font-black text-[#ba1a1a] uppercase tracking-wider mb-1">Notas Médicas / Alergias</span>
                                  <span className="text-[9px] text-[#434653] leading-tight block">{c.customer_profiles?.medical_notes || 'Sin observaciones.'}</span>
                                </div>
                                <div className="bg-[#f9f9ff] border border-[#cbd5e1]/30 px-2 py-1.5 rounded-lg text-[9px] flex justify-between items-center">
                                  <div>
                                    <span className="block text-[7px] text-[#737784] font-bold uppercase">Contacto de Emergencia</span>
                                    <span className="font-bold text-[#111c2d]">{c.customer_profiles?.emergency_contact_name || 'No registrado'}</span>
                                  </div>
                                  {c.customer_profiles?.emergency_contact_phone && (
                                    <span className="font-mono text-[#00357f] font-bold">{c.customer_profiles.emergency_contact_phone}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Último Examen */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <h4 className="font-bold text-[10px] text-[#00357f] uppercase tracking-wider flex items-center gap-1 border-b border-[#cbd5e1]/30 pb-1">
                                <Eye className="w-3.5 h-3.5" /> Último Examen
                              </h4>
                              {latestExam ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-5 gap-0.5 text-center text-[9px] font-bold">
                                    <div className="col-span-1" />
                                    {['Esf', 'Cil', 'Eje', 'Add'].map(h => <div key={h} className="bg-[#f0f3ff] py-1 rounded text-[#434653]">{h}</div>)}
                                    <div className="col-span-1 py-1 text-[#00357f] font-extrabold bg-[#f9f9ff] border border-[#cbd5e1]/20 rounded-l">OD</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold">{latestExam.od_sphere || '0.00'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold">{latestExam.od_cylinder || '0.00'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold">{latestExam.od_axis ? `${latestExam.od_axis}°` : '-'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-[#f9f9ff] border border-[#cbd5e1]/20 font-bold rounded-r">{latestExam.od_addition || '0.00'}</div>

                                    <div className="col-span-1 py-1 text-[#00357f] font-extrabold bg-[#f9f9ff] border border-[#cbd5e1]/20 rounded-l mt-1">OI</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold mt-1">{latestExam.os_sphere || '0.00'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold mt-1">{latestExam.os_cylinder || '0.00'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-white border border-[#cbd5e1]/20 font-bold mt-1">{latestExam.os_axis ? `${latestExam.os_axis}°` : '-'}</div>
                                    <div className="py-1 text-xs font-mono text-[#00357f] bg-[#f9f9ff] border border-[#cbd5e1]/20 font-bold rounded-r mt-1">{latestExam.os_addition || '0.00'}</div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-[#737784] pt-1">
                                    <div>DIP: <span className="font-bold text-[#00357f]">{latestExam.dip || 'N/A'} mm</span></div>
                                    {latestExam.examiner?.full_name && (
                                      <div className="truncate">Optometrista: <span className="font-bold text-[#00357f]">{latestExam.examiner.full_name}</span></div>
                                    )}
                                    {latestExam.observations && (
                                      <div className="col-span-2 bg-[#f0f3ff] p-2 rounded-lg text-[9px] italic border border-[#cbd5e1]/30 mt-1">
                                        "{latestExam.observations}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[10px] text-[#737784] text-center py-4 font-semibold">Sin recetas registradas.</p>
                              )}
                            </div>

                            {/* Historial de Compras */}
                            <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-2">
                              <h4 className="font-bold text-[10px] text-[#00357f] uppercase tracking-wider flex items-center gap-1 border-b border-[#cbd5e1]/30 pb-1">
                                <ShoppingBag className="w-3.5 h-3.5" /> Historial de Compras
                              </h4>
                              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                {selectedCustomerSales.length === 0 ? (
                                  <p className="text-[10px] text-[#737784] text-center py-4 font-semibold">Sin compras registradas.</p>
                                ) : (
                                  selectedCustomerSales.map(s => (
                                    <div key={s.id} className="p-2 border border-[#cbd5e1]/30 rounded-lg bg-[#f9f9ff] text-[9px] flex flex-col gap-1 shadow-2xs">
                                      <div className="flex justify-between items-center">
                                        <span className="font-black text-[#737784]">Orden #{s.id.slice(0, 5).toUpperCase()}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                          s.pending_balance > 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#49da9f]/20 text-[#00422b]'
                                        }`}>
                                          {s.pending_balance > 0 ? 'Adeudo' : 'Liquidado'}
                                        </span>
                                      </div>
                                      <div className="font-bold text-[#111c2d] truncate">
                                        {s.sale_items?.[0]?.product?.name || 'Venta de Óptica'}
                                      </div>
                                      <div className="flex justify-between items-center text-[#737784] mt-0.5 border-t border-[#cbd5e1]/20 pt-1">
                                        <span>{new Date(s.created_at).toLocaleDateString('es-MX')}</span>
                                        <span className="font-black text-[#00357f]">{formatPrice(s.total)}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="w-full py-2.5 bg-[#00357f] hover:bg-[#004aad] text-white text-center rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Alta de Cliente
          </button>
        </div>

        {/* Right Side: Details Canvas (8 cols) */}
        <div className="hidden lg:flex lg:col-span-8 flex-col gap-6 overflow-y-auto max-h-[600px] pr-1">
          {activeCustomer ? (
            <>
              {/* Patient Header Card */}
              <div className="bg-white rounded-2xl border border-[#cbd5e1] p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#d9e2ff] text-[#00357f] flex items-center justify-center font-black text-lg select-none">
                    {getInitials(activeCustomer.full_name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#111c2d]">{activeCustomer.full_name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1 text-xs text-[#737784] font-medium">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> ID: {activeCustomer.id.slice(0, 8).toUpperCase()}
                      </span>
                      {activeCustomer.customer_profiles?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {activeCustomer.customer_profiles.phone}
                        </span>
                      )}
                      {activeCustomer.customer_profiles?.blood_type && (
                        <span className="bg-[#dee8ff] text-[#00357f] font-bold px-1.5 py-0.5 rounded text-[10px]">
                          Tipo Sangre: {activeCustomer.customer_profiles.blood_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => setEditingCustomer(activeCustomer)}
                    className="flex-1 sm:flex-none px-4 py-2 border border-[#737784] hover:bg-[#f0f3ff] text-[#00357f] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Perfil
                  </button>
                  <button 
                    onClick={() => setDeletingItem({ id: activeCustomer.id, name: activeCustomer.full_name })}
                    className="px-3 py-2 border border-rose-500/20 hover:bg-rose-50 text-[#ba1a1a] rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Información General del Cliente */}
              <div className="bg-white rounded-2xl border border-[#cbd5e1] p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider border-b border-[#cbd5e1]/45 pb-2">
                  Expediente Clínico & Cuenta de Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-left">
                  {/* Resumen Clínico / Financiero */}
                  <div className="space-y-2 bg-[#f0f3ff]/40 p-4 rounded-xl border border-[#cbd5e1]/30">
                    <h4 className="font-extrabold text-[#00357f] uppercase text-[10px] tracking-wider mb-2">Resumen Operativo</h4>
                    <div className="space-y-1.5 font-medium">
                      <div className="flex justify-between">
                        <span className="text-[#737784]">Último Examen:</span>
                        <span className="font-bold text-[#111c2d]">{latestExamDateStr}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737784]">Última Compra:</span>
                        <span className="font-bold text-[#111c2d]">{latestSaleDateStr}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-[#cbd5e1]/40 pt-1.5 mt-1.5">
                        <span className="text-[#737784]">Saldo Pendiente:</span>
                        <span className={`font-black text-sm ${totalPending > 0 ? 'text-[#ba1a1a] animate-pulse' : 'text-emerald-600'}`}>
                          {formatPrice(totalPending)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Datos del Perfil */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[#00357f] uppercase text-[10px] tracking-wider">Detalles del Perfil</h4>
                    <div className="space-y-1.5 font-medium">
                      <div className="flex items-center gap-1.5 text-[#434653]">
                        <Mail className="w-3.5 h-3.5 text-[#737784]" />
                        <span className="truncate" title={activeCustomer.email}>{activeCustomer.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#434653]">
                        <Calendar className="w-3.5 h-3.5 text-[#737784]" />
                        <span>Nacimiento: {activeCustomer.customer_profiles?.date_of_birth ? formatDate(activeCustomer.customer_profiles.date_of_birth) : 'No especificado'} {activeCustomer.customer_profiles?.date_of_birth && `(${calculateAge(activeCustomer.customer_profiles.date_of_birth)} años)`}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#434653]">
                        <Briefcase className="w-3.5 h-3.5 text-[#737784]" />
                        <span>Ocupación: {activeCustomer.customer_profiles?.occupation || 'No especificada'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#434653] pt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#737784]" />
                        <span className="line-clamp-1" title={activeCustomer.customer_profiles?.address || 'Sin dirección registrada'}>Dir: {activeCustomer.customer_profiles?.address || 'Sin dirección registrada'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Historial Médico & Emergencias */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[#00357f] uppercase text-[10px] tracking-wider">Historial Clínico & Emergencia</h4>
                    <div className="space-y-2 font-medium">
                      <div className="bg-[#ffdad6]/20 border border-[#ffdad6] p-2.5 rounded-lg">
                        <span className="block text-[8px] font-black text-[#ba1a1a] uppercase tracking-wider mb-1">Notas Médicas / Alergias</span>
                        <span className="text-[10px] text-[#434653] line-clamp-2 leading-tight">{activeCustomer.customer_profiles?.medical_notes || 'Sin observaciones de relevancia.'}</span>
                      </div>
                      <div className="flex justify-between items-center bg-[#f9f9ff] border border-[#cbd5e1]/40 px-2.5 py-1.5 rounded-lg text-[10px]">
                        <div>
                          <span className="block text-[7px] text-[#737784] font-bold uppercase">Contacto de Emergencia</span>
                          <span className="font-bold text-[#111c2d]">{activeCustomer.customer_profiles?.emergency_contact_name || 'No registrado'}</span>
                        </div>
                        {activeCustomer.customer_profiles?.emergency_contact_phone && (
                          <span className="font-mono text-[#00357f] font-bold">{activeCustomer.customer_profiles.emergency_contact_phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Grid Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Last Exam Card (Left) */}
                <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 shadow-sm flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex justify-between items-center mb-4 border-b border-[#e7eeff] pb-2">
                      <h3 className="font-bold text-sm text-[#00357f] flex items-center gap-1.5">
                        <Eye className="w-4 h-4" /> Último Examen
                      </h3>
                      <span className="text-[10px] text-[#737784] font-bold">
                        {latestExam ? new Date(latestExam.exam_date).toLocaleDateString('es-MX') : 'No registrado'}
                      </span>
                    </div>

                    {latestExam ? (
                      <div className="space-y-4">
                        {/* Prescription Grid */}
                        <div className="grid grid-cols-5 gap-1 text-center">
                          <div className="col-span-1 text-[9px] text-[#737784] font-black uppercase py-1">Ojo</div>
                          <div className="col-span-1 text-[9px] text-[#737784] font-black uppercase py-1 bg-[#f0f3ff] rounded-t-lg">Esf</div>
                          <div className="col-span-1 text-[9px] text-[#737784] font-black uppercase py-1 bg-[#f0f3ff] rounded-t-lg">Cil</div>
                          <div className="col-span-1 text-[9px] text-[#737784] font-black uppercase py-1 bg-[#f0f3ff] rounded-t-lg">Eje</div>
                          <div className="col-span-1 text-[9px] text-[#737784] font-black uppercase py-1 bg-[#f0f3ff] rounded-t-lg">Add</div>
                          
                          {/* Right Eye (OD) */}
                          <div className="col-span-1 text-xs font-bold text-[#111c2d] py-2 flex items-center justify-center bg-[#f9f9ff] border-y border-l border-[#cbd5e1]/40 rounded-l-lg">OD</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-y border-[#cbd5e1]/40 font-bold">{latestExam.od_sphere || '0.00'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-y border-[#cbd5e1]/40 font-bold">{latestExam.od_cylinder || '0.00'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-y border-[#cbd5e1]/40 font-bold">{latestExam.od_axis ? `${latestExam.od_axis}°` : '-'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-[#f9f9ff] border-y border-r border-[#cbd5e1]/40 font-bold rounded-r-lg">{latestExam.od_addition || '0.00'}</div>

                          {/* Left Eye (OI) */}
                          <div className="col-span-1 text-xs font-bold text-[#111c2d] py-2 flex items-center justify-center bg-[#f9f9ff] border-b border-l border-[#cbd5e1]/40 rounded-l-lg mt-1">OI</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-b border-[#cbd5e1]/40 font-bold mt-1">{latestExam.os_sphere || '0.00'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-b border-[#cbd5e1]/40 font-bold mt-1">{latestExam.os_cylinder || '0.00'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-white border-b border-[#cbd5e1]/40 font-bold mt-1">{latestExam.os_axis ? `${latestExam.os_axis}°` : '-'}</div>
                          <div className="col-span-1 py-2 text-xs font-mono text-[#00357f] bg-[#f9f9ff] border-b border-r border-[#cbd5e1]/40 font-bold rounded-r-lg mt-1">{latestExam.os_addition || '0.00'}</div>
                        </div>

                        {/* DIP and Notes */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-medium pt-2 text-[#434653]">
                          <div>DIP: <span className="font-bold text-[#00357f]">{latestExam.dip || 'N/A'} mm</span></div>
                          {latestExam.examiner?.full_name && (
                            <div className="truncate">Optometrista: <span className="font-bold text-[#00357f]">{latestExam.examiner.full_name}</span></div>
                          )}
                          {latestExam.observations && (
                            <div className="col-span-2 mt-2 bg-[#f0f3ff] p-2.5 rounded-lg text-[11px] leading-relaxed italic border border-[#cbd5e1]/30">
                              "{latestExam.observations}"
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#737784] text-center py-12 font-semibold">El cliente no cuenta con recetas registradas.</p>
                    )}
                  </div>

                  <Link 
                    href={`/customers/${activeCustomer.id}/exam/new`}
                    className="w-full py-2 bg-[#00668a] hover:bg-[#004c69] text-white text-center rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-4"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Registrar Examen Clínico
                  </Link>
                </div>

                {/* Shopping History Card (Right) */}
                <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 shadow-sm flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex justify-between items-center mb-4 border-b border-[#e7eeff] pb-2">
                      <h3 className="font-bold text-sm text-[#00357f] flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4" /> Historial de Compras
                      </h3>
                      <span className="text-[10px] text-[#737784] font-bold">{selectedCustomerSales.length} compras</span>
                    </div>

                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                      {selectedCustomerSales.length === 0 ? (
                        <p className="text-xs text-[#737784] text-center py-12 font-semibold">Sin compras registradas.</p>
                      ) : (
                        selectedCustomerSales.map(s => (
                          <div key={s.id} className="p-3 border border-[#cbd5e1]/40 rounded-xl bg-[#f9f9ff] flex flex-col gap-1.5 shadow-sm text-left">
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] font-black text-[#737784] uppercase tracking-wider">Orden #{s.id.slice(0, 5).toUpperCase()}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                s.pending_balance > 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#49da9f]/20 text-[#00422b]'
                              }`}>
                                {s.pending_balance > 0 ? 'Con Adeudo' : 'Liquidado'}
                              </span>
                            </div>
                            <div className="font-bold text-xs text-[#111c2d] truncate">
                              {s.sale_items?.[0]?.product?.name || 'Venta de Óptica'}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-medium text-[#737784] mt-1.5">
                              <span>{new Date(s.created_at).toLocaleDateString('es-MX')}</span>
                              <span className="font-black text-[#00357f] text-xs">{formatPrice(s.total)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Link 
                    href={`/customers/${activeCustomer.id}/sale/new`}
                    className="w-full py-2 bg-[#00357f] hover:bg-[#004aad] text-white text-center rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-4"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Registrar Nueva Venta
                  </Link>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#cbd5e1] p-12 text-center text-[#737784] font-semibold text-xs shadow-sm">
              Seleccione un cliente de la lista para visualizar su expediente.
            </div>
          )}
        </div>

      </div>

      {/* ========================================================
         MODAL: ADD CUSTOMER
         ======================================================== */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-[#cbd5e1] rounded-2xl p-6 space-y-4 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-[#cbd5e1] pb-3">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Nuevo Expediente de Cliente</h2>
              <button 
                onClick={() => setShowAddCustomerModal(false)}
                className="text-[#737784] hover:text-[#111c2d] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={cFullName}
                    onChange={(e) => setCFullName(e.target.value)}
                    placeholder="Ej. María Rodríguez"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Usuario (Acceso) *</label>
                  <input
                    type="text"
                    required
                    value={cUsername}
                    onChange={(e) => setCUsername(e.target.value)}
                    placeholder="ej. mariarodriguez"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="10 dígitos"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={cDOB}
                    onChange={(e) => setCDOB(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none text-[#434653]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] mb-1">Dirección</label>
                  <input
                    type="text"
                    value={cAddress}
                    onChange={(e) => setCAddress(e.target.value)}
                    placeholder="Calle, Número, Colonia"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Ocupación</label>
                  <input
                    type="text"
                    value={cOccupation}
                    onChange={(e) => setCOccupation(e.target.value)}
                    placeholder="Ocupación"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Tipo de Sangre</label>
                  <select
                    value={cBloodType}
                    onChange={(e) => setCBloodType(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
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
                  <label className="block text-xs font-bold text-[#434653] mb-1">Antecedentes Médicos</label>
                  <textarea
                    value={cMedicalNotes}
                    onChange={(e) => setCMedicalNotes(e.target.value)}
                    placeholder="Alergias, diabetes, cirugías previas..."
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[50px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Contacto Emergencia</label>
                  <input
                    type="text"
                    value={cEmergencyName}
                    onChange={(e) => setCEmergencyName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Teléfono Emergencia</label>
                  <input
                    type="text"
                    value={cEmergencyPhone}
                    onChange={(e) => setCEmergencyPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#cbd5e1]">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors cursor-pointer shadow-sm"
                >
                  Crear Cliente
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-[#cbd5e1] rounded-2xl p-6 space-y-4 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-[#cbd5e1] pb-3">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Modificar Expediente</h2>
              <button 
                onClick={() => setEditingCustomer(null)}
                className="text-[#737784] hover:text-[#111c2d] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.full_name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, full_name: e.target.value })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Usuario (Acceso) *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.username || editingCustomer.email?.split('@')[0]}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, username: e.target.value })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.phone || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, phone: e.target.value }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={editingCustomer.customer_profiles?.date_of_birth || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, date_of_birth: e.target.value }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none text-[#434653]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] mb-1">Dirección</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.address || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, address: e.target.value }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Ocupación</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.occupation || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, occupation: e.target.value }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Tipo de Sangre</label>
                  <select
                    value={editingCustomer.customer_profiles?.blood_type || 'NS'}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, blood_type: e.target.value as any }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
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
                  <label className="block text-xs font-bold text-[#434653] mb-1">Antecedentes Médicos</label>
                  <textarea
                    value={editingCustomer.customer_profiles?.medical_notes || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, medical_notes: e.target.value }
                    })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[50px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Contacto de Emergencia</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.emergency_contact_name || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, emergency_contact_name: e.target.value }
                    })}
                    placeholder="Nombre"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] mb-1">Teléfono Emergencia</label>
                  <input
                    type="text"
                    value={editingCustomer.customer_profiles?.emergency_contact_phone || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      customer_profiles: { ...editingCustomer.customer_profiles, emergency_contact_phone: e.target.value }
                    })}
                    placeholder="Teléfono"
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#cbd5e1]">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-[#cbd5e1] rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 bg-rose-100 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#111c2d] uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-[#434653] leading-normal font-medium">
                ¿Estás seguro de que deseas eliminar a <strong>{deletingItem.name}</strong>?
                Esta acción borrará de manera definitiva su expediente clínico y su historial de compras.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 text-xs font-bold text-[#737784] hover:bg-[#dee8ff] py-2.5 rounded-xl border border-[#cbd5e1] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
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
