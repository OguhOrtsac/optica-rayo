'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchCustomers, getCustomerExams, getCustomerSales } from '@/lib/services'
import PageHeader from '@/components/page-header'
import { orderCodeFromSaleId } from '@/lib/ticket'
import {
  Search,
  PlusCircle,
  ChevronRight,
  ChevronUp,
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
    // Toggle: si se hace clic en el mismo cliente, colapsar
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null)
      setExams([])
      setSales([])
      return
    }

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

  /** Graduación con signo y dos decimales: -2.5 → «−2.50», 0.25 → «+0.25». */
  const fmtDiopters = (v: number | null | undefined) => {
    if (v == null) return '—'
    const abs = Math.abs(v).toFixed(2)
    return v > 0 ? `+${abs}` : v < 0 ? `−${abs}` : abs
  }

  const latestExam = exams[0] || null

  const getSaleStatusBadge = (status: string) => {
    switch (status) {
      case 'Entregado':
        return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e2f9ee] text-[#00422b] text-[11px] font-bold shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Entregado</span>
      case 'Listo_Entrega':
        return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dee8ff] text-[#00357f] text-[11px] font-bold shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Listo</span>
      case 'En_Taller':
        return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-bold shrink-0"><Clock className="w-3.5 h-3.5" /> En taller</span>
      case 'Anticipo_Pagado':
        return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-bold shrink-0"><AlertTriangle className="w-3.5 h-3.5" /> Anticipo</span>
      default:
        return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dee8ff] text-[#00357f] text-[11px] font-bold shrink-0"><Clock className="w-3.5 h-3.5" /> {status || 'Pendiente'}</span>
    }
  }

  /**
   * Tarjeta «Historial de exámenes»: el examen más reciente completo, el
   * cambio de esfera contra el anterior y la progresión cronológica de
   * todos los exámenes previos. Se comparte entre el desplegable móvil
   * y el panel de escritorio; `variant` conserva los textos de cada
   * contexto y el botón extra de escritorio.
   */
  const renderExamHistory = (customerId: string, variant: 'mobile' | 'desktop') => {
    const prevExam = exams[1] || null
    const odDelta = latestExam && prevExam && latestExam.od_sphere != null && prevExam.od_sphere != null
      ? { prev: prevExam.od_sphere, cur: latestExam.od_sphere }
      : null
    const oiDelta = latestExam && prevExam && latestExam.oi_sphere != null && prevExam.oi_sphere != null
      ? { prev: prevExam.oi_sphere, cur: latestExam.oi_sphere }
      : null
    // Con 2+ exámenes la progresión lista los anteriores; con uno solo,
    // ese único registro con su fecha (sin inventar cambios).
    const progressionExams = exams.length > 1 ? exams.slice(1) : exams

    return (
      <div className="bg-white border border-[#cbd5e1]/60 rounded-[20px] or-shadow-card p-4 md:p-5 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-[#111c2d]">
            <span className="w-9 h-9 rounded-xl bg-[#e6f7fb] flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-[#0899c9]" />
            </span>
            Historial de exámenes
          </h3>
          {exams.length > 0 && (
            <span className="text-xs text-[#5d606f] font-semibold shrink-0">
              {exams.length} examen{exams.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {!latestExam ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 md:py-8 gap-2">
            <span className="w-12 h-12 rounded-full bg-[#f0f3ff] flex items-center justify-center">
              <Eye className="w-6 h-6 text-[#00357f]/50" />
            </span>
            <p className="text-sm text-[#5d606f] font-semibold">Sin examen registrado</p>
            <Link href={`/customers/${customerId}/exam/new`}
              className="text-xs font-bold text-[#00357f] hover:underline">
              {variant === 'mobile' ? 'Registrar examen →' : 'Registrar primer examen →'}
            </Link>
          </div>
        ) : (
          <>
            {/* Examen más reciente: fecha destacada y optometrista */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
              <span className="bg-[#dee8ff] text-[#00357f] px-2.5 py-1 rounded-full text-[11px] font-bold">
                Más reciente · {formatDate(latestExam.exam_date)}
              </span>
              {latestExam.examiner?.full_name && (
                <span className="text-xs text-[#5d606f] font-medium">
                  Optometrista: <span className="font-semibold text-[#434653]">{latestExam.examiner.full_name}</span>
                </span>
              )}
            </div>

            {/* Rejilla de graduación del examen más reciente */}
            <div className="grid grid-cols-5 gap-1 text-center">
              <div className="col-span-1" />
              {['ESF', 'CIL', 'EJE', 'ADD'].map(h => (
                <div key={h} className="col-span-1 py-1.5 bg-[#f0f3ff] rounded-lg text-[10px] md:text-[11px] font-extrabold text-[#434653]">{h}</div>
              ))}
              <div className="col-span-1 py-2 md:py-2.5 flex items-center justify-center font-black text-[#00357f] bg-[#eef4ff] rounded-lg text-xs md:text-sm">OD</div>
              {[latestExam.od_sphere, latestExam.od_cylinder, latestExam.od_axis, latestExam.od_add].map((v, i) => (
                <div key={i} className="col-span-1 py-2 md:py-2.5 bg-white border border-[#e7eeff] rounded-lg tabular-nums font-semibold text-xs md:text-sm text-[#111c2d]">
                  {v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}
                </div>
              ))}
              <div className="col-span-1 py-2 md:py-2.5 flex items-center justify-center font-black text-[#00357f] bg-[#eef4ff] rounded-lg text-xs md:text-sm">OI</div>
              {[latestExam.oi_sphere, latestExam.oi_cylinder, latestExam.oi_axis, latestExam.oi_add].map((v, i) => (
                <div key={i} className="col-span-1 py-2 md:py-2.5 bg-white border border-[#e7eeff] rounded-lg tabular-nums font-semibold text-xs md:text-sm text-[#111c2d]">
                  {v != null ? (i === 2 ? `${v}°` : v > 0 ? `+${v}` : v) : '—'}
                </div>
              ))}
            </div>

            {/* DIP / tipo de lente / tratamiento */}
            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-4">
              {latestExam.pd_distance && (
                <span className="bg-[#f0f3ff] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#434653]">
                  DIP: {latestExam.pd_distance}mm
                </span>
              )}
              {latestExam.lens_type && (
                <span className="bg-[#f0f3ff] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#434653]">
                  {latestExam.lens_type}
                </span>
              )}
              {latestExam.treatment && (
                <span className="bg-[#f0f3ff] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#434653]">
                  {latestExam.treatment}
                </span>
              )}
            </div>

            {/* Cambio de esfera contra el examen anterior */}
            {(odDelta || oiDelta) && (
              <div className="mt-4 bg-[#f0f3ff] rounded-xl px-3 py-2.5">
                <p className="text-xs font-bold text-[#00357f]">Cambio desde el examen anterior</p>
                <div className="mt-1 space-y-0.5 text-xs text-[#434653] tabular-nums font-medium">
                  {odDelta && (
                    <p>OD esfera: {fmtDiopters(odDelta.prev)} → {fmtDiopters(odDelta.cur)} (Δ {fmtDiopters(odDelta.cur - odDelta.prev)})</p>
                  )}
                  {oiDelta && (
                    <p>OI esfera: {fmtDiopters(oiDelta.prev)} → {fmtDiopters(oiDelta.cur)} (Δ {fmtDiopters(oiDelta.cur - oiDelta.prev)})</p>
                  )}
                </div>
              </div>
            )}

            {/* Progresión cronológica */}
            <div className="mt-4">
              <h4 className="text-sm font-bold text-[#111c2d]">Progresión</h4>
              <ul className="divide-y divide-[#e7eeff]">
                {progressionExams.map((exam: any) => (
                  <li key={exam.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111c2d]">{formatDate(exam.exam_date)}</p>
                      {exam.examiner?.full_name && (
                        <p className="text-[11px] text-[#5d606f] font-medium truncate">{exam.examiner.full_name}</p>
                      )}
                    </div>
                    <p className="text-xs text-[#434653] tabular-nums font-medium text-right whitespace-nowrap">
                      <span className="font-bold text-[#00357f]">OD</span> {fmtDiopters(exam.od_sphere)} / {fmtDiopters(exam.od_cylinder)}
                      <span className="text-[#c3c6d5] mx-1.5">·</span>
                      <span className="font-bold text-[#00357f]">OI</span> {fmtDiopters(exam.oi_sphere)} / {fmtDiopters(exam.oi_cylinder)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* El acceso a la ficha completa vive en «Ver perfil» de la
                tarjeta (dictado del dueño, 2026-11-18: fuera el enlace
                «Ver expediente clínico completo», duplicaba ese acceso). */}

            {variant === 'desktop' && (
              <Link href={`/customers/${customerId}/exam/new`}
                className="mt-3 w-full min-h-[44px] px-4 bg-[#00509e] hover:bg-[#00357f] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm">
                <Eye className="w-3.5 h-3.5" />
                Registrar Nuevo Examen
              </Link>
            )}
          </>
        )}
      </div>
    )
  }

  /**
   * Tarjeta «Historial de compras» compartida entre el desplegable
   * móvil y el panel de escritorio (en móvil la lista se acota; en
   * escritorio ocupa el alto de la tarjeta).
   */
  const renderSalesHistory = (customerId: string, variant: 'mobile' | 'desktop') => (
    <div className="bg-white border border-[#cbd5e1]/60 rounded-[20px] or-shadow-card p-4 md:p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="flex items-center gap-2.5 text-base font-bold text-[#111c2d]">
          <span className="w-9 h-9 rounded-xl bg-[#e2f9ee] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-[#00422b]" />
          </span>
          Historial de compras
        </h3>
        <span className="text-xs text-[#5d606f] font-semibold shrink-0">
          {sales.length} orden{sales.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {sales.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 md:py-8 gap-2">
          <span className="w-12 h-12 rounded-full bg-[#f0f3ff] flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-[#00357f]/50" />
          </span>
          <p className="text-sm text-[#5d606f] font-semibold">Sin compras registradas</p>
          <Link href={`/customers/${customerId}/sale/new`}
            className="text-xs font-bold text-[#00357f] hover:underline">
            {variant === 'mobile' ? 'Registrar venta →' : 'Crear primera venta →'}
          </Link>
        </div>
      ) : (
        <div className={`space-y-2 md:space-y-3 overflow-y-auto pr-1 ${variant === 'mobile' ? 'max-h-[150px]' : 'flex-1'}`}>
          {sales.map((sale: any) => {
            const pending = (sale.pending_balance ?? 0) > 0
            return (
              <div key={sale.id} className={`p-3 border rounded-2xl flex flex-col gap-1.5 ${pending ? 'border-[#ffdad6] bg-[#ffdad6]/15' : 'border-[#e7eeff] bg-[#f9f9ff]'}`}>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] text-[#5d606f] font-bold">
                    Orden #{orderCodeFromSaleId(sale.id)}
                  </span>
                  {getSaleStatusBadge(sale.status)}
                </div>
                <p className="text-sm font-semibold text-[#111c2d] leading-snug">
                  {sale.sale_items?.map((si: any) => si.product?.name || 'Producto').join(', ') || 'Sin detalle'}
                </p>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-[#5d606f] font-medium">
                    {formatDate(sale.created_at)}
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-[#00357f] tabular-nums block">
                      {formatPrice(sale.total ?? 0)}
                    </span>
                    {pending && (
                      <span className="text-xs text-[#ba1a1a] font-bold tabular-nums">
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
  )

  return (
    <main className="min-h-screen text-[#111c2d] pt-2 pb-24 md:pb-0">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-[calc(100dvh-2rem)]">

        {/* Header: en móvil solo la etiqueta + el botón de nuevo (PageHeader) */}
        <PageHeader
          title="Clientes"
          mobileClassName="mb-4"
          mobileExtra={
            <div className="mt-3">
              <Link href="/customers/new"
                className="flex items-center justify-center gap-2 bg-[#00357f] hover:bg-[#00509e] text-white font-bold text-sm px-5 min-h-[44px] rounded-xl shadow-sm transition-colors w-fit cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2">
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo Cliente</span>
                <span className="sm:hidden">Nuevo</span>
              </Link>
            </div>
          }
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Clientes</h1>
              <p className="text-sm text-[#434653] mt-1 font-medium">Directorio clínico y expedientes de clientes.</p>
            </div>
            <Link href="/customers/new"
              className="flex items-center justify-center gap-2 bg-[#00357f] hover:bg-[#00509e] text-white font-bold text-sm px-5 min-h-[44px] rounded-xl shadow-sm transition-colors w-fit cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </div>
        </PageHeader>

        {/* Two-column master-detail layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">

          {/* ===== LEFT: Patient directory ===== */}
          <div className="md:col-span-4 flex flex-col bg-white border border-[#cbd5e1]/60 rounded-[20px] or-shadow-card overflow-hidden h-[calc(100dvh-10rem)]">

            {/* Search bar */}
            <div className="p-3 md:p-4 border-b border-[#e7eeff]">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#5d606f]" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-[#f0f3ff] border border-transparent rounded-full pl-11 pr-11 py-3 text-sm text-[#111c2d] placeholder-[#5d606f]/70 focus:bg-white focus:border-[#00357f] focus:ring-2 focus:ring-[#00357f]/25 outline-none transition-shadow"
                />
                {loading && (
                  <span className="absolute inset-y-0 right-4 flex items-center">
                    <div className="w-4 h-4 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                  </span>
                )}
              </div>
            </div>

            {/* Patient list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {!loading && customers.length === 0 ? (
                <div className="py-16 text-center space-y-3 px-4">
                  <div className="w-14 h-14 bg-[#dee8ff] rounded-full flex items-center justify-center mx-auto">
                    <Users className="w-7 h-7 text-[#00357f]" />
                  </div>
                  <p className="text-sm text-[#434653] font-semibold">
                    {query ? `Sin resultados para "${query}"` : 'No hay clientes registrados.'}
                  </p>
                  <Link href="/customers/new" className="inline-block text-xs font-bold text-[#00357f] hover:underline">
                    Registrar primer cliente →
                  </Link>
                </div>
              ) : (
                customers.map(c => {
                  const isActive = selectedCustomer?.id === c.id
                  const age = getAge(c.customer_profiles?.date_of_birth)
                  return (
                    <div key={c.id}>
                      <button
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${isActive ? 'bg-[#dee8ff]/70 or-shadow-card' : 'hover:bg-[#f0f3ff]'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-extrabold text-sm select-none ${isActive ? 'bg-[#00357f] text-white' : 'bg-[#dee8ff] text-[#00357f]'}`}>
                            {getInitials(c.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm leading-snug truncate ${isActive ? 'text-[#00357f]' : 'text-[#111c2d]'}`}>{c.full_name}</p>
                            {c.customer_profiles?.phone ? (
                              <p className="flex items-center gap-1 text-xs text-[#5d606f] font-medium mt-0.5">
                                <Phone className="w-3 h-3 shrink-0" />
                                {c.customer_profiles.phone}
                              </p>
                            ) : (
                              <p className="text-xs text-[#5d606f] font-medium mt-0.5 truncate">
                                @{c.email?.replace('@opticarayo.com', '')}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#00357f] rotate-90' : 'text-[#c3c6d5]'}`} />
                      </button>

                      {/* Detalle colapsable en móvil. Dictado del dueño
                          (2026-11-18): la tarjeta desplegada lleva un MARCO
                          visible que pulsa suave (anim-frame-pulse) para
                          que se note que estás dentro de una tarjeta
                          abierta, y un botón «Cerrar» al final. */}
                      {isActive && (
                        <div className="anim-frame-pulse block md:hidden mx-0.5 mt-1 rounded-[22px] border-2 border-[#0899c9]/45 bg-[#f6f9ff]/70 px-2 pb-3 pt-2 space-y-3">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="w-5 h-5 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <>
                              {/* Información básica & Acciones */}
                              <div className="bg-white border border-[#cbd5e1]/60 rounded-[20px] or-shadow-card p-4 space-y-3">
                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#434653] font-medium">
                                  <span className="flex items-center gap-1.5">
                                    <CalendarDays className="w-4 h-4 text-[#00509e]" />
                                    Desde {formatDate(c.created_at)}
                                  </span>
                                  {age && (
                                    <span className="flex items-center gap-1.5">
                                      <Cake className="w-4 h-4 text-[#be185d]" />
                                      {age} años
                                    </span>
                                  )}
                                  {c.customer_profiles?.phone && (
                                    <span className="flex items-center gap-1.5">
                                      <Phone className="w-4 h-4 text-[#047857]" />
                                      {c.customer_profiles.phone}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-[#e7eeff]">
                                  <Link href={`/customers/${c.id}`}
                                    className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-[#ede9fe] text-[#6d28d9] rounded-xl text-xs font-bold hover:bg-[#ddd0fd] transition-colors">
                                    <Eye className="w-4 h-4" />
                                    Ver perfil
                                  </Link>
                                  <Link href={`/customers/${c.id}/sale/new`}
                                    className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-[#e2f9ee] text-[#00422b] rounded-xl text-xs font-bold hover:bg-[#c9f2dd] transition-colors">
                                    <ShoppingBag className="w-4 h-4" />
                                    Venta
                                  </Link>
                                  <Link href={`/customers/${c.id}/exam/new`}
                                    className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-[#dee8ff] text-[#00357f] rounded-xl text-xs font-bold hover:bg-[#c9dbff] transition-colors">
                                    <Eye className="w-4 h-4" />
                                    Examen
                                  </Link>
                                </div>
                              </div>

                              {renderExamHistory(c.id, 'mobile')}
                              {renderSalesHistory(c.id, 'mobile')}

                              <button
                                type="button"
                                onClick={() => setSelectedCustomer(null)}
                                className="w-full min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#434653] hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                              >
                                <ChevronUp className="w-4 h-4" />
                                Cerrar vista previa
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer count */}
            <div className="p-3 border-t border-[#e7eeff]">
              <p className="text-xs text-[#5d606f] font-semibold text-center">
                {customers.length} cliente{customers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* ===== RIGHT: Patient detail panel ===== */}
          <div className="hidden md:flex md:col-span-8 flex-col gap-6 overflow-y-auto pb-8 h-[calc(100dvh-10rem)]">
            {!selectedCustomer ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-6">
                <div className="w-20 h-20 bg-[#dee8ff] rounded-[20px] flex items-center justify-center">
                  <Users className="w-9 h-9 text-[#00357f]" />
                </div>
                <p className="text-base text-[#434653] font-semibold">Selecciona un cliente del directorio.</p>
                <p className="text-sm text-[#5d606f] font-medium">Su expediente, historial de exámenes y compras aparecerán aquí.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Patient header card */}
                <div className="bg-white border border-[#cbd5e1]/60 rounded-[20px] or-shadow-card p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-[20px] bg-[#00357f] text-white flex items-center justify-center font-black text-xl select-none shrink-0">
                      {getInitials(selectedCustomer.full_name)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-[#111c2d] tracking-tight">{selectedCustomer.full_name}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-[#434653] font-medium">
                          <CalendarDays className="w-4 h-4 text-[#00509e]" />
                          Desde {formatDate(selectedCustomer.created_at)}
                        </span>
                        {getAge(selectedCustomer.customer_profiles?.date_of_birth) && (
                          <span className="flex items-center gap-1.5 text-xs text-[#434653] font-medium">
                            <Cake className="w-4 h-4 text-[#be185d]" />
                            {getAge(selectedCustomer.customer_profiles?.date_of_birth)} años
                          </span>
                        )}
                        {selectedCustomer.customer_profiles?.phone && (
                          <span className="flex items-center gap-1.5 text-xs text-[#434653] font-medium">
                            <Phone className="w-4 h-4 text-[#047857]" />
                            {selectedCustomer.customer_profiles.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Link href={`/customers/${selectedCustomer.id}`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 min-h-[44px] bg-[#ede9fe] text-[#6d28d9] rounded-xl text-xs font-bold hover:bg-[#ddd0fd] transition-colors">
                      <Eye className="w-4 h-4" />
                      Ver perfil
                    </Link>
                    <Link href={`/customers/${selectedCustomer.id}/sale/new`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 min-h-[44px] bg-[#e2f9ee] text-[#00422b] rounded-xl text-xs font-bold hover:bg-[#c9f2dd] transition-colors">
                      <ShoppingBag className="w-4 h-4" />
                      Nueva Venta
                    </Link>
                    <Link href={`/customers/${selectedCustomer.id}/exam/new`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 min-h-[44px] bg-[#dee8ff] hover:bg-[#c9dbff] text-[#00357f] rounded-xl text-xs font-bold transition-colors">
                      <Eye className="w-4 h-4" />
                      Examen
                    </Link>
                  </div>
                </div>

                {/* Exam history + Purchase history */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderExamHistory(selectedCustomer.id, 'desktop')}
                  {renderSalesHistory(selectedCustomer.id, 'desktop')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
