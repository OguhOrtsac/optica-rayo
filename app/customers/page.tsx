'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchCustomers, getCustomerExams, getCustomerSales } from '@/lib/services'
import {
  Search,
  PlusCircle,
  ChevronRight,
  Users,
  Eye,
  ShoppingBag,
  BadgeCheck,
  Clock,
  AlertTriangle,
  CalendarDays,
  Phone,
  Cake,
} from 'lucide-react'

type Customer = {
  id: string
  full_name: string
  email: string
  created_at: string
  customer_profiles: {
    phone?: string
    date_of_birth?: string
  } | null
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [exams, setExams] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const loadCustomers = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const data = await searchCustomers(q)
      setCustomers(data)
      // Auto-select first customer if none selected
      if (data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[0])
      }
    } catch (err) {
      console.error('Error loading customers:', err)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCustomers('') }, [loadCustomers])

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(query), 350)
    return () => clearTimeout(timer)
  }, [query, loadCustomers])

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setDetailLoading(true)
    try {
      const [examsData, salesData] = await Promise.all([
        getCustomerExams(customer.id),
        getCustomerSales(customer.id),
      ])
      setExams(examsData)
      setSales(salesData)
    } catch (err) {
      console.error('Error loading customer details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const getInitials = (name: string) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'P'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  const getAge = (dob?: string) => {
    if (!dob) return null
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const latestExam = exams[0] || null

  const getSaleStatusBadge = (status: string) => {
    switch (status) {
      case 'Entregado':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"><BadgeCheck className="w-3 h-3" /> Entregado</span>
      case 'Listo_Entrega':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold"><BadgeCheck className="w-3 h-3" /> Listo</span>
      case 'En_Taller':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold"><Clock className="w-3 h-3" /> En taller</span>
      case 'Anticipo_Pagado':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold"><AlertTriangle className="w-3 h-3" /> Anticipo</span>
      default:
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#737784] text-[10px] font-bold"><Clock className="w-3 h-3" /> {status || 'Pendiente'}</span>
    }
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] pt-4 pb-24 md:pb-0">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-[calc(100vh-2rem)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e7eeff]">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Clientes</h1>
            <p className="text-sm text-[#434653] mt-1 font-medium">Directorio clínico y expedientes de clientes.</p>
          </div>
          <Link href="/customers/new"
            className="flex items-center gap-2 bg-[#00357f] hover:bg-[#004aad] text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm transition-colors w-fit cursor-pointer">
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </div>

        {/* Two-column master-detail layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">

          {/* ===== LEFT: Patient directory ===== */}
          <div className="md:col-span-4 flex flex-col bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-10rem)]">

            {/* Search bar */}
            <div className="p-4 border-b border-[#cbd5e1]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-10 pr-4 py-2 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none"
                />
                {loading && (
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-3.5 h-3.5 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                  </span>
                )}
              </div>
            </div>

            {/* Patient list */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#cbd5e1]/40">
              {!loading && customers.length === 0 ? (
                <div className="py-16 text-center space-y-3 px-4">
                  <div className="w-12 h-12 bg-[#f0f3ff] rounded-full flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6 text-[#00357f]" />
                  </div>
                  <p className="text-xs text-[#737784] font-semibold">
                    {query ? `Sin resultados para "${query}"` : 'No hay clientes registrados.'}
                  </p>
                  <Link href="/customers/new" className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                    Registrar primer cliente →
                  </Link>
                </div>
              ) : (
                customers.map(c => {
                  const isActive = selectedCustomer?.id === c.id
                  return (
                    <div
                      key={c.id}
                      className={`w-full border-b border-[#cbd5e1]/40 last:border-b-0 transition-all duration-300 ${isActive ? 'bg-[#dee8ff]/10' : ''}`}
                    >
                      <button
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isActive ? 'bg-[#dee8ff]/60 border-l-4 border-l-[#00357f]' : 'hover:bg-[#f0f3ff] border-l-4 border-l-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm select-none ${isActive ? 'bg-[#00357f] text-white' : 'bg-[#dee8ff] text-[#00357f]'}`}>
                            {getInitials(c.full_name)}
                          </div>
                          <div>
                            <p className={`font-bold text-xs leading-tight ${isActive ? 'text-[#00357f]' : 'text-[#111c2d]'}`}>{c.full_name}</p>
                            <p className="text-[10px] text-[#737784] mt-0.5">
                              @{c.email?.replace('@opticarayo.com', '')}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#00357f] rotate-90' : 'text-[#cbd5e1]'}`} />
                      </button>

                      {/* Detalle colapsable en móvil */}
                      {isActive && (
                        <div className="block md:hidden border-t border-[#cbd5e1]/40 bg-[#f9f9ff] px-3 py-4 space-y-4">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="w-5 h-5 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className="space-y-4 text-left">
                              {/* Información básica & Acciones */}
                              <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs space-y-3">
                                <div className="flex flex-wrap gap-2 text-[10px] text-[#737784] font-medium">
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Desde {formatDate(c.created_at)}
                                  </span>
                                  {getAge(c.customer_profiles?.date_of_birth) && (
                                    <span className="flex items-center gap-1">
                                      <Cake className="w-3.5 h-3.5" />
                                      {getAge(c.customer_profiles?.date_of_birth)} años
                                    </span>
                                  )}
                                  {c.customer_profiles?.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5" />
                                      {c.customer_profiles.phone}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-[#cbd5e1]/40">
                                  <Link href={`/customers/${c.id}`}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#cbd5e1] rounded-lg text-[10px] font-bold text-[#434653] hover:bg-[#dee8ff]">
                                    <Eye className="w-3.5 h-3.5" />
                                    Expediente
                                  </Link>
                                  <Link href={`/customers/${c.id}/sale/new`}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#00357f] text-white rounded-lg text-[10px] font-bold">
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    Venta
                                  </Link>
                                  <Link href={`/customers/${c.id}/exam/new`}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#cbd5e1] text-[#00357f] bg-white rounded-lg text-[10px] font-bold">
                                    <Eye className="w-3.5 h-3.5" />
                                    Examen
                                  </Link>
                                </div>
                              </div>

                              {/* Último examen */}
                              <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs">
                                <h4 className="font-bold text-[10px] text-[#00357f] uppercase tracking-wider flex items-center gap-1 mb-2 pb-1 border-b border-[#cbd5e1]/30">
                                  <Eye className="w-3.5 h-3.5" /> Último Examen
                                </h4>
                                {!latestExam ? (
                                  <div className="text-center py-3">
                                    <p className="text-[10px] text-[#737784] font-medium">Sin examen registrado</p>
                                    <Link href={`/customers/${c.id}/exam/new`}
                                      className="text-[10px] font-bold text-[#00357f] hover:underline mt-1 block">
                                      Registrar examen →
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-5 gap-0.5 text-center text-[9px] font-bold">
                                      <div className="col-span-1" />
                                      {['ESF', 'CIL', 'EJE', 'ADD'].map(h => <div key={h} className="bg-[#f0f3ff] py-1 rounded text-[#434653]">{h}</div>)}
                                      <div className="col-span-1 py-1 text-[#00357f] font-extrabold">OD</div>
                                      {[latestExam.od_sphere, latestExam.od_cylinder, latestExam.od_axis, latestExam.od_add].map((v, i) => (
                                        <div key={i} className="bg-[#f9f9ff] py-1 border border-[#cbd5e1]/20 font-mono">{v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}</div>
                                      ))}
                                      <div className="col-span-1 py-1 text-[#00357f] font-extrabold">OI</div>
                                      {[latestExam.oi_sphere, latestExam.oi_cylinder, latestExam.oi_axis, latestExam.oi_add].map((v, i) => (
                                        <div key={i} className="bg-[#f9f9ff] py-1 border border-[#cbd5e1]/20 font-mono">{v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}</div>
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1 text-[9px] font-semibold text-[#737784]">
                                      {latestExam.pd_distance && <span className="bg-[#f0f3ff] px-2 py-0.5 rounded-full">DIP: {latestExam.pd_distance}mm</span>}
                                      {latestExam.lens_type && <span className="bg-[#f0f3ff] px-2 py-0.5 rounded-full">{latestExam.lens_type}</span>}
                                      {latestExam.treatment && <span className="bg-[#f0f3ff] px-2 py-0.5 rounded-full">{latestExam.treatment}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Historial de compras */}
                              <div className="bg-white border border-[#cbd5e1] rounded-xl p-3 shadow-xs">
                                <h4 className="font-bold text-[10px] text-[#00357f] uppercase tracking-wider flex items-center gap-1 mb-2 pb-1 border-b border-[#cbd5e1]/30">
                                  <ShoppingBag className="w-3.5 h-3.5" /> Historial de Compras
                                </h4>
                                {sales.length === 0 ? (
                                  <div className="text-center py-3">
                                    <p className="text-[10px] text-[#737784] font-medium">Sin compras registradas</p>
                                    <Link href={`/customers/${c.id}/sale/new`}
                                      className="text-[10px] font-bold text-[#00357f] hover:underline mt-1 block">
                                      Registrar venta →
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {sales.map((sale: any) => {
                                      const pending = (sale.pending_balance ?? 0) > 0
                                      return (
                                        <div key={sale.id} className={`p-2 border rounded-lg text-[10px] ${pending ? 'border-orange-200 bg-orange-50/30' : 'border-[#cbd5e1]/40 bg-[#f9f9ff]'}`}>
                                          <div className="flex justify-between items-center">
                                            <span className="font-black text-[#737784]">Orden #{sale.id.slice(0, 6).toUpperCase()}</span>
                                            {getSaleStatusBadge(sale.status)}
                                          </div>
                                          <p className="font-bold text-[#111c2d] mt-1 text-left">{sale.sale_items?.map((si: any) => si.product?.name).join(', ') || 'Sin detalle'}</p>
                                          <div className="flex justify-between items-center mt-1 border-t border-[#cbd5e1]/20 pt-1">
                                            <span className="text-[#737784]">{formatDate(sale.created_at)}</span>
                                            <div className="text-right">
                                              <span className="font-bold text-[#00357f]">{formatPrice(sale.total ?? 0)}</span>
                                              {pending && <span className="block text-[8px] text-orange-600 font-bold">Adeudo: {formatPrice(sale.pending_balance)}</span>}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
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

            {/* Footer count */}
            <div className="p-3 border-t border-[#cbd5e1] bg-[#f9f9ff]">
              <p className="text-[10px] text-[#737784] font-bold text-center">
                {customers.length} cliente{customers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* ===== RIGHT: Patient detail panel ===== */}
          <div className="hidden md:flex md:col-span-8 flex-col gap-4 overflow-y-auto pb-8 h-[calc(100vh-10rem)]">
            {!selectedCustomer ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <div className="w-16 h-16 bg-[#f0f3ff] rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-[#00357f]/40" />
                </div>
                <p className="text-sm text-[#737784] font-semibold">Selecciona un cliente del directorio.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Patient header card */}
                <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#dee8ff] text-[#00357f] flex items-center justify-center font-black text-xl select-none">
                      {getInitials(selectedCustomer.full_name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-[#111c2d]">{selectedCustomer.full_name}</h2>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-[#737784] font-medium">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Desde {formatDate(selectedCustomer.created_at)}
                        </span>
                        {getAge(selectedCustomer.customer_profiles?.date_of_birth) && (
                          <span className="flex items-center gap-1 text-xs text-[#737784] font-medium">
                            <Cake className="w-3.5 h-3.5" />
                            {getAge(selectedCustomer.customer_profiles?.date_of_birth)} años
                          </span>
                        )}
                        {selectedCustomer.customer_profiles?.phone && (
                          <span className="flex items-center gap-1 text-xs text-[#737784] font-medium">
                            <Phone className="w-3.5 h-3.5" />
                            {selectedCustomer.customer_profiles.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Link href={`/customers/${selectedCustomer.id}`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-[#cbd5e1] rounded-xl text-xs font-bold text-[#434653] hover:bg-[#dee8ff] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                      Expediente
                    </Link>
                    <Link href={`/customers/${selectedCustomer.id}/sale/new`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[#00357f] hover:bg-[#004aad] text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Nueva Venta
                    </Link>
                    <Link href={`/customers/${selectedCustomer.id}/exam/new`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-[#cbd5e1] hover:bg-[#dee8ff] text-[#00357f] rounded-xl text-xs font-bold transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                      Examen
                    </Link>
                  </div>
                </div>

                {/* Bento grid: Latest exam + Purchase history */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Latest Exam Card */}
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#cbd5e1]/40">
                      <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-4 h-4" />
                        Último Examen
                      </h3>
                      {latestExam && (
                        <span className="text-[10px] text-[#737784] font-bold">
                          {new Date(latestExam.exam_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {!latestExam ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                        <Eye className="w-8 h-8 text-[#cbd5e1]" />
                        <p className="text-xs text-[#737784] font-semibold">Sin examen registrado</p>
                        <Link href={`/customers/${selectedCustomer.id}/exam/new`}
                          className="text-xs font-bold text-[#00357f] hover:underline">
                          Registrar primer examen →
                        </Link>
                      </div>
                    ) : (
                      <>
                        {/* Prescription grid */}
                        <div className="grid grid-cols-5 gap-1 text-center mb-4 text-xs">
                          {/* Headers */}
                          <div className="col-span-1" />
                          {['ESF', 'CIL', 'EJE', 'ADD'].map(h => (
                            <div key={h} className="col-span-1 py-1.5 bg-[#f0f3ff] rounded text-[10px] font-black text-[#434653]">{h}</div>
                          ))}
                          {/* OD row */}
                          <div className="col-span-1 py-2 flex items-center justify-center font-black text-[#00357f] bg-[#f9f9ff] rounded-l text-xs border border-r-0 border-[#cbd5e1]/40">OD</div>
                          {[latestExam.od_sphere, latestExam.od_cylinder, latestExam.od_axis, latestExam.od_add].map((v, i) => (
                            <div key={i} className={`col-span-1 py-2 font-mono font-bold text-[#111c2d] bg-white border border-[#cbd5e1]/40 ${i === 3 ? 'rounded-r border-l-0' : 'border-x-0'}`}>
                              {v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}
                            </div>
                          ))}
                          {/* OI row */}
                          <div className="col-span-1 py-2 flex items-center justify-center font-black text-[#00357f] bg-[#f9f9ff] rounded-l text-xs border border-r-0 border-[#cbd5e1]/40 mt-1">OI</div>
                          {[latestExam.oi_sphere, latestExam.oi_cylinder, latestExam.oi_axis, latestExam.oi_add].map((v, i) => (
                            <div key={i} className={`col-span-1 py-2 font-mono font-bold text-[#111c2d] bg-white border border-[#cbd5e1]/40 mt-1 ${i === 3 ? 'rounded-r border-l-0' : 'border-x-0'}`}>
                              {v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}
                            </div>
                          ))}
                        </div>

                        {/* DIP / lens type badges */}
                        <div className="flex flex-wrap gap-2 mt-auto">
                          {latestExam.pd_distance && (
                            <span className="bg-[#f0f3ff] px-2 py-1 rounded-full text-[10px] font-bold text-[#434653]">
                              DIP: {latestExam.pd_distance}mm
                            </span>
                          )}
                          {latestExam.lens_type && (
                            <span className="bg-[#f0f3ff] px-2 py-1 rounded-full text-[10px] font-bold text-[#434653]">
                              {latestExam.lens_type}
                            </span>
                          )}
                          {latestExam.treatment && (
                            <span className="bg-[#f0f3ff] px-2 py-1 rounded-full text-[10px] font-bold text-[#434653]">
                              {latestExam.treatment}
                            </span>
                          )}
                        </div>

                        <Link href={`/customers/${selectedCustomer.id}/exam/new`}
                          className="mt-4 w-full py-2 px-4 bg-[#00668a] hover:bg-[#004c69] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm">
                          <Eye className="w-3.5 h-3.5" />
                          Registrar Nuevo Examen
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Purchase History Card */}
                  <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#cbd5e1]/40">
                      <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4" />
                        Historial de Compras
                      </h3>
                      <span className="text-[10px] text-[#737784] font-bold">{sales.length} orden{sales.length !== 1 ? 'es' : ''}</span>
                    </div>

                    {sales.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                        <ShoppingBag className="w-8 h-8 text-[#cbd5e1]" />
                        <p className="text-xs text-[#737784] font-semibold">Sin compras registradas</p>
                        <Link href={`/customers/${selectedCustomer.id}/sale/new`}
                          className="text-xs font-bold text-[#00357f] hover:underline">
                          Crear primera venta →
                        </Link>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-3">
                        {sales.map((sale: any) => {
                          const pending = (sale.pending_balance ?? 0) > 0
                          return (
                            <div key={sale.id} className={`p-3 border rounded-xl flex flex-col gap-2 ${pending ? 'border-orange-200 bg-orange-50/50' : 'border-[#cbd5e1]/50 bg-[#f9f9ff]'}`}>
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] text-[#737784] font-bold">
                                  Orden #{sale.id.slice(0, 6).toUpperCase()}
                                </span>
                                {getSaleStatusBadge(sale.status)}
                              </div>
                              <div className="text-xs font-bold text-[#111c2d]">
                                {sale.sale_items?.map((si: any) => si.product?.name || 'Producto').join(', ') || 'Sin detalle'}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-[#737784] font-medium">
                                  {new Date(sale.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <div className="text-right">
                                  <span className="font-bold text-xs text-[#00357f] block">{formatPrice(sale.total ?? 0)}</span>
                                  {pending && (
                                    <span className="text-[10px] text-orange-600 font-bold">
                                      Adeudo: {formatPrice(sale.pending_balance ?? 0)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
