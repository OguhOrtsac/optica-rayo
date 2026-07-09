'use client'

import * as React from 'react'
import { useEffect, useState, useActionState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomerById, getCustomerExams, getProducts, getLensMaterials, getLensTreatments } from '@/lib/services'
import { createLinkedSaleAction, CreateSaleState } from '@/app/customers/actions'
import {
  ArrowLeft,
  ShoppingCart,
  Search,
  Plus,
  Printer,
  CheckCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  Banknote,
  RefreshCcw,
  Settings2,
  Tag,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

type PaymentMode = 'single' | 'installments'
type FrequencyType = 'weekly' | 'biweekly' | 'monthly'

const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

const FREQUENCY_DAYS: Record<FrequencyType, number> = {
  weekly: 7,
  biweekly: 15,
  monthly: 30,
}

const initialState: CreateSaleState = { error: null, success: null }

export default function NewLinkedSalePage({ params }: PageProps) {
  const { id: customerId } = React.use(params)
  const router = useRouter()

  const [customer, setCustomer] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [treatments, setTreatments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Cart state
  const [cart, setCart] = useState<any[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [couponCode, setCouponCode] = useState('')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isPrescriptionVisible, setIsPrescriptionVisible] = useState<boolean>(false)

  // Payment plan state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('single')
  const [downPayment, setDownPayment] = useState<string>('')
  const [numInstallments, setNumInstallments] = useState<number>(6)
  const [frequency, setFrequency] = useState<FrequencyType>('biweekly')
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')

  useEffect(() => {
    const days = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 15 : 30
    const d = new Date()
    d.setDate(d.getDate() + days)
    setFirstPaymentDate(d.toISOString().split('T')[0])
  }, [frequency])

  const [state, formAction, isPending] = useActionState<CreateSaleState, FormData>(createLinkedSaleAction, initialState)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [custData, examsData, productsData, materialsData, treatmentsData] = await Promise.all([
        getCustomerById(customerId),
        getCustomerExams(customerId),
        getProducts(),
        getLensMaterials(),
        getLensTreatments(),
      ])
      setCustomer(custData)
      setExams(examsData)
      setProducts(productsData)
      setMaterials(materialsData)
      setTreatments(treatmentsData)
    } catch (err) {
      console.error('Error loading sale page data:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => router.push(`/customers/${customerId}`), 2500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, customerId, router])

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
        lensMaterialId: '',
        lensMaterialPrice: 0,
        treatmentIds: [],
        treatmentsPrice: 0,
        od_sphere: '',
        od_cylinder: '',
        od_axis: '',
        od_add: '',
        oi_sphere: '',
        oi_cylinder: '',
        oi_axis: '',
        oi_add: '',
        pd_distance: ''
      }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId))
    } else {
      setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity } : item))
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId))
  }

  const handleMaterialChange = (productId: string, materialId: string) => {
    const selectedMat = materials.find(m => m.id === materialId)
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      return {
        ...item,
        lensMaterialId: materialId,
        lensMaterialPrice: selectedMat ? parseFloat(selectedMat.price) : 0
      }
    }))
  }

  const handleTreatmentToggle = (productId: string, treatmentId: string, checked: boolean) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      
      const prevIds: string[] = item.treatmentIds || []
      let nextIds: string[] = []
      if (checked) {
        if (!prevIds.includes(treatmentId)) {
          nextIds = [...prevIds, treatmentId]
        } else {
          nextIds = prevIds
        }
      } else {
        nextIds = prevIds.filter((id: string) => id !== treatmentId)
      }

      // Calculate total treatments price
      const totalTPrice = nextIds.reduce((sum: number, id: string) => {
        const t = treatments.find(treat => treat.id === id)
        return sum + (t ? parseFloat(t.price) : 0)
      }, 0)

      return {
        ...item,
        treatmentIds: nextIds,
        treatmentsPrice: totalTPrice
      }
    }))
  }

  const handlePrescriptionChange = (productId: string, field: string, value: string) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      return {
        ...item,
        [field]: value
      }
    }))
  }

  const handleAutofillPrescription = (productId: string) => {
    const examToUse = selectedExamId ? exams.find(e => e.id === selectedExamId) : exams[0]
    if (!examToUse) return
    
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      return {
        ...item,
        od_sphere: examToUse.od_sphere?.toString() || '',
        od_cylinder: examToUse.od_cylinder?.toString() || '',
        od_axis: examToUse.od_axis?.toString() || '',
        od_add: examToUse.od_add?.toString() || '',
        oi_sphere: examToUse.oi_sphere?.toString() || '',
        oi_cylinder: examToUse.oi_cylinder?.toString() || '',
        oi_axis: examToUse.oi_axis?.toString() || '',
        oi_add: examToUse.oi_add?.toString() || '',
        pd_distance: examToUse.pd_distance?.toString() || ''
      }
    }))
  }

  // Financial calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const itemUnitPrice = item.price + (item.lensMaterialPrice || 0) + (item.treatmentsPrice || 0)
      return sum + itemUnitPrice * item.quantity
    }, 0)
  }, [cart])
  const iva = useMemo(() => subtotal * 0.16, [subtotal])
  const total = useMemo(() => subtotal + iva, [subtotal, iva])

  const downPaymentNum = useMemo(() => {
    if (paymentMode === 'single') return total
    const parsed = parseFloat(downPayment.replace(/,/g, '') || '0')
    return isNaN(parsed) ? 0 : Math.min(parsed, total)
  }, [paymentMode, downPayment, total])

  const amountToFinance = useMemo(() => Math.max(0, total - downPaymentNum), [total, downPaymentNum])
  const installmentAmount = useMemo(() => numInstallments > 0 ? amountToFinance / numInstallments : 0, [amountToFinance, numInstallments])
  const suggestedDownPayment = useMemo(() => total * 0.2, [total])

  const paymentSchedule = useMemo(() => {
    if (paymentMode === 'single' || numInstallments === 0 || !firstPaymentDate) return []
    const days = FREQUENCY_DAYS[frequency]
    const schedule = []
    let baseDate = new Date(firstPaymentDate + 'T12:00:00')
    for (let i = 1; i <= numInstallments; i++) {
      if (i > 1) {
        baseDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
      }
      schedule.push({
        num: i,
        date: baseDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
        amount: installmentAmount,
      })
    }
    return schedule
  }, [paymentMode, numInstallments, frequency, installmentAmount, firstPaymentDate])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const catLabel = (cat: string) =>
    cat === 'frames' ? 'Armazón' : cat === 'lenses' ? 'Micas' : cat === 'contact_lenses' ? 'Contacto' : 'Accesorio'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando catálogo y datos del cliente...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-[#cbd5e1] rounded-2xl p-8 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-[#ba1a1a]" />
          </div>
          <h2 className="text-lg font-bold text-[#111c2d]">Cliente no encontrado</h2>
          <Link href="/customers" className="inline-block text-xs font-bold text-[#00357f] hover:underline">
            ← Volver a clientes
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] pt-4 pb-24 md:pb-8">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/customers/${customerId}`} className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Cierre de Venta</h1>
            </div>
            <p className="text-sm text-[#434653] font-medium pl-8">
              Cliente: <strong className="text-[#111c2d]">{customer.full_name}</strong> • Ref: #{customerId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white border border-[#cbd5e1] hover:bg-[#f0f3ff] text-[#111c2d] px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <Printer className="w-4 h-4" />
            Imprimir Presupuesto
          </button>
        </div>

        {/* Feedback Messages */}
        {state?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-600">¡Venta registrada con éxito!</p>
              <p className="text-xs text-emerald-700 mt-1">{state.success}</p>
              <p className="text-xs text-emerald-600/80 mt-1">Redirigiendo al expediente...</p>
            </div>
          </div>
        )}
        {state?.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-600">{state.error}</p>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ===== LEFT: Cart Summary ===== */}
          <div className="lg:col-span-4 bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Cart header */}
            <div className="p-4 border-b border-[#cbd5e1] bg-[#f9f9ff] flex justify-between items-center">
              <h3 className="font-bold text-xs text-[#00357f] flex items-center gap-1.5 uppercase tracking-wider">
                <ShoppingCart className="w-4 h-4" />
                Carrito Actual
              </h3>
              <span className="bg-[#00357f] text-white px-2 py-0.5 rounded-full font-bold text-[10px]">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
              </span>
            </div>

            {/* Cart items */}
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px]">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#737784] font-semibold">
                  El carrito está vacío. Agrega productos del catálogo.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="bg-[#f9f9ff] border border-[#cbd5e1]/40 p-3.5 rounded-xl text-xs space-y-3">
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#111c2d] truncate">{item.name}</p>
                        <p className="text-[10px] text-[#737784] font-mono mt-0.5">
                          {formatPrice(item.price)} c/u
                          {item.lensMaterialPrice > 0 && ` + Mica: ${formatPrice(item.lensMaterialPrice)}`}
                          {item.treatmentsPrice > 0 && ` + Extras: ${formatPrice(item.treatmentsPrice)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-6 h-6 bg-white hover:bg-[#dee8ff] rounded-md text-[#00357f] font-extrabold flex items-center justify-center border border-[#cbd5e1]">
                          −
                        </button>
                        <span className="font-mono font-bold text-[#111c2d] w-6 text-center">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-6 h-6 bg-white hover:bg-[#dee8ff] rounded-md text-[#00357f] font-extrabold flex items-center justify-center border border-[#cbd5e1]">
                          +
                        </button>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.productId)}
                        className="text-[#ba1a1a] hover:text-[#93000a] font-bold px-1 shrink-0">✕</button>
                    </div>

                    {/* Lens Customization Form (Only for Frames) */}
                    {item.category === 'frames' && (
                      <div className="mt-2 pt-2 border-t border-[#cbd5e1]/30 space-y-2.5 text-left">
                        {/* Material Selector */}
                        <div>
                          <label className="block text-[8px] font-black text-[#434653] uppercase tracking-wider mb-1">Material de Mica</label>
                          <select 
                            value={item.lensMaterialId || ''} 
                            onChange={e => handleMaterialChange(item.productId, e.target.value)}
                            className="w-full bg-white border border-[#cbd5e1] rounded px-2 py-1 text-[10px] outline-none"
                          >
                            <option value="">Ninguno (Solo armazón)</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.name} (+{formatPrice(m.price)})</option>
                            ))}
                          </select>
                        </div>

                        {/* Treatments Selectors */}
                        {treatments.length > 0 && (
                          <div>
                            <label className="block text-[8px] font-black text-[#434653] uppercase tracking-wider mb-1">Tratamientos Extras</label>
                            <div className="grid grid-cols-1 gap-1 pl-1">
                              {treatments.map(t => {
                                const checked = item.treatmentIds?.includes(t.id) || false;
                                return (
                                  <label key={t.id} className="flex items-center gap-1.5 text-[9px] font-medium text-[#434653] cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={checked}
                                      onChange={e => handleTreatmentToggle(item.productId, t.id, e.target.checked)}
                                      className="rounded border-[#cbd5e1] text-[#00357f]" 
                                    />
                                    <span>{t.name} (+{formatPrice(t.price)})</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Prescription Fields */}
                        <div className="space-y-1.5 bg-[#f0f3ff]/40 p-2 rounded-lg border border-[#cbd5e1]/20">
                          <div className="flex justify-between items-center">
                            <label className="block text-[8px] font-black text-[#00357f] uppercase tracking-wider">Graduación Lente</label>
                            {exams.length > 0 && (
                              <button 
                                type="button" 
                                onClick={() => handleAutofillPrescription(item.productId)}
                                className="text-[8px] font-bold text-[#00357f] hover:underline cursor-pointer"
                              >
                                Cargar última receta
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-5 gap-1 text-center font-mono text-[9px]">
                            <span className="text-[7px] text-[#737784] font-bold uppercase self-center">Ojo</span>
                            <span className="text-[7px] text-[#737784] font-bold uppercase">Esf</span>
                            <span className="text-[7px] text-[#737784] font-bold uppercase">Cil</span>
                            <span className="text-[7px] text-[#737784] font-bold uppercase">Eje</span>
                            <span className="text-[7px] text-[#737784] font-bold uppercase">Add</span>

                            <span className="font-bold text-[#00357f] self-center text-left pl-0.5">OD</span>
                            <input type="text" placeholder="Esf" value={item.od_sphere || ''} onChange={e => handlePrescriptionChange(item.productId, 'od_sphere', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Cil" value={item.od_cylinder || ''} onChange={e => handlePrescriptionChange(item.productId, 'od_cylinder', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Eje" value={item.od_axis || ''} onChange={e => handlePrescriptionChange(item.productId, 'od_axis', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Add" value={item.od_add || ''} onChange={e => handlePrescriptionChange(item.productId, 'od_add', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />

                            <span className="font-bold text-[#00357f] self-center text-left pl-0.5">OI</span>
                            <input type="text" placeholder="Esf" value={item.oi_sphere || ''} onChange={e => handlePrescriptionChange(item.productId, 'oi_sphere', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Cil" value={item.oi_cylinder || ''} onChange={e => handlePrescriptionChange(item.productId, 'oi_cylinder', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Eje" value={item.oi_axis || ''} onChange={e => handlePrescriptionChange(item.productId, 'oi_axis', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                            <input type="text" placeholder="Add" value={item.oi_add || ''} onChange={e => handlePrescriptionChange(item.productId, 'oi_add', e.target.value)} className="bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-sans" />
                          </div>

                          <div className="flex justify-between items-center gap-2 pt-1.5 mt-1.5 border-t border-[#cbd5e1]/30">
                            <span className="text-[7px] text-[#737784] font-bold uppercase">Distancia Pupilar (DIP mm)</span>
                            <input 
                              type="text" 
                              placeholder="DIP" 
                              value={item.pd_distance || ''} 
                              onChange={e => handlePrescriptionChange(item.productId, 'pd_distance', e.target.value)} 
                              className="w-16 bg-white border border-[#cbd5e1] rounded text-[9px] text-center py-0.5 font-mono" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals footer */}
            <div className="p-4 bg-[#f9f9ff] border-t border-[#cbd5e1] space-y-2">
              <div className="flex justify-between text-xs text-[#434653] font-medium">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#434653] font-medium">
                <span>IVA (16%)</span><span>{formatPrice(iva)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#cbd5e1] border-dashed">
                <span className="font-bold text-sm text-[#111c2d]">Total</span>
                <span className="font-mono text-lg font-black text-[#00357f]">{formatPrice(total)}</span>
              </div>
              {paymentMode === 'installments' && cart.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#cbd5e1]/60 space-y-1">
                  <div className="flex justify-between text-xs text-[#434653]">
                    <span>Anticipo cobrado</span>
                    <span className="font-bold text-emerald-700">{formatPrice(downPaymentNum)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#434653]">
                    <span>Adeudo pendiente</span>
                    <span className="font-bold text-[#ba1a1a]">{formatPrice(amountToFinance)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#434653]">
                    <span>{numInstallments} cuotas de</span>
                    <span className="font-bold text-[#00357f]">{formatPrice(installmentAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT: Catalog + Payment Config + Payment Plan ===== */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Catalog Selection */}
            <div className="bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider border-b border-[#cbd5e1]/40 pb-2">
                Selección de Catálogo
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
                  <input type="text" placeholder="Buscar producto..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg py-2 pl-10 pr-3 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none" />
                </div>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs focus:border-[#00357f] outline-none">
                  <option value="all">Todas las categorías</option>
                  <option value="frames">Armazones</option>
                  <option value="lenses">Micas / Lentes</option>
                  <option value="contact_lenses">Lentes de Contacto</option>
                  <option value="accessories">Accesorios</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-[#737784] py-8 text-center sm:col-span-2 font-semibold">No se encontraron productos.</p>
                ) : (
                  filteredProducts.map(p => (
                    <div key={p.id} className="bg-[#f9f9ff] border border-[#cbd5e1]/40 hover:border-[#b0c6ff] rounded-xl p-3 flex flex-col justify-between transition-all group">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-xs text-[#111c2d] group-hover:text-[#00357f] transition-colors line-clamp-1">{p.name}</h4>
                          <span className="text-[8px] bg-[#dee8ff] text-[#00357f] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                            {catLabel(p.category)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#737784] line-clamp-1 mt-1">{p.description || 'Sin descripción'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#cbd5e1]/40">
                        <span className="font-mono font-bold text-xs text-[#111c2d]">{formatPrice(p.price)}</span>
                        <button type="button" onClick={() => addToCart(p)}
                          className="bg-[#00357f] hover:bg-[#004aad] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Agregar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Configuration */}
            <form action={formAction} className="bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm space-y-5">
              <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#cbd5e1]/40 pb-2">
                <Settings2 className="w-4 h-4" />
                Configuración de Pago
              </h3>

              {/* Hidden fields */}
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="examId" value={selectedExamId} />
              <input type="hidden" name="couponCode" value={couponCode} />
              <input type="hidden" name="notes" value={notes} />
              <input type="hidden" name="items" value={JSON.stringify(cart)} />
              <input type="hidden" name="paymentPlanType" value={paymentMode} />
              <input type="hidden" name="paidAmount" value={paymentMode === 'single' ? total.toString() : downPayment} />
              <input type="hidden" name="paymentMethod" value={paymentMethod} />
              <input type="hidden" name="isPrescriptionVisible" value={isPrescriptionVisible.toString()} />
              <input type="hidden" name="paymentFrequency" value={frequency} />
              <input type="hidden" name="firstPaymentDate" value={firstPaymentDate} />
              <input type="hidden" name="numInstallments" value={numInstallments.toString()} />

              {/* Payment mode toggle */}
              <div className="flex p-1 bg-[#f0f3ff] rounded-xl border border-[#cbd5e1] w-full md:w-max">
                <button type="button"
                  onClick={() => setPaymentMode('single')}
                  className={`flex-1 md:w-40 py-2 px-4 rounded-lg text-xs font-bold transition-colors ${paymentMode === 'single' ? 'bg-white shadow-sm border border-[#cbd5e1] text-[#00357f]' : 'text-[#737784] hover:text-[#434653]'}`}>
                  <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
                  Pago Único
                </button>
                <button type="button"
                  onClick={() => setPaymentMode('installments')}
                  className={`flex-1 md:w-40 py-2 px-4 rounded-lg text-xs font-bold transition-colors ${paymentMode === 'installments' ? 'bg-white shadow-sm border border-[#cbd5e1] text-[#00357f]' : 'text-[#737784] hover:text-[#434653]'}`}>
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                  A Plazos (Cuotas)
                </button>
              </div>

              {/* Installment settings */}
              {paymentMode === 'installments' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#f9f9ff] rounded-xl border border-[#e7eeff]">
                  {/* Down payment */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#434653] uppercase tracking-wider">Anticipo Requerido</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737784] text-xs font-bold">$</span>
                      <input type="text" value={downPayment} onChange={e => setDownPayment(e.target.value)}
                        placeholder={suggestedDownPayment.toFixed(2)}
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-xs focus:border-[#00357f] outline-none font-mono" />
                    </div>
                    <p className="text-[10px] text-[#737784]">Sugerido 20%: {formatPrice(suggestedDownPayment)}</p>
                  </div>

                  {/* Amount to finance */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#434653] uppercase tracking-wider">Monto a Financiar</label>
                    <div className="w-full px-3 py-2 rounded-lg border border-[#e7eeff] bg-[#f0f3ff] text-xs font-mono font-bold text-[#111c2d] flex items-center">
                      {formatPrice(amountToFinance)}
                    </div>
                    <p className="text-[10px] text-[#737784]">Calculado automáticamente</p>
                  </div>

                  {/* First payment date */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#434653] uppercase tracking-wider">Fecha del Primer Pago</label>
                    <input 
                      type="date" 
                      value={firstPaymentDate} 
                      onChange={e => setFirstPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-xs focus:border-[#00357f] outline-none" 
                    />
                  </div>

                  {/* Frequency */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#434653] uppercase tracking-wider">Frecuencia de Pago</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value as FrequencyType)}
                      className="w-full px-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-xs focus:border-[#00357f] outline-none">
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>

                  {/* Number of installments */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#434653] uppercase tracking-wider">Número de Cuotas</label>
                    <select value={numInstallments} onChange={e => setNumInstallments(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-xs focus:border-[#00357f] outline-none">
                      <option value={2}>2 Pagos</option>
                      <option value={4}>4 Pagos</option>
                      <option value={6}>6 Pagos</option>
                      <option value={12}>12 Pagos</option>
                    </select>
                  </div>

                  {/* Recalculate display */}
                  <div className="flex items-end">
                    <div className="w-full px-3 py-2 rounded-lg border border-[#e7eeff] bg-[#f0f3ff] text-xs flex flex-col">
                      <span className="text-[#737784] font-bold">Cuota aprox.</span>
                      <span className="font-mono font-black text-[#00357f] text-sm mt-0.5">
                        {installmentAmount > 0 ? formatPrice(installmentAmount) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['cash', 'card', 'transfer'] as const).map(method => (
                  <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`flex items-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${paymentMethod === method ? 'border-[#00357f] bg-[#dee8ff] text-[#00357f]' : 'border-[#cbd5e1] bg-white text-[#737784] hover:border-[#b0c6ff]'}`}>
                    {method === 'cash' ? <Banknote className="w-4 h-4" /> : method === 'card' ? <CreditCard className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                    {method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : 'Transferencia'}
                  </button>
                ))}
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#434653] uppercase tracking-wider mb-2">Vincular Examen Clínico</label>
                    <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
                      className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs focus:border-[#00357f] outline-none">
                      <option value="">No vincular a examen</option>
                      {exams.map((ex, i) => (
                        <option key={ex.id} value={ex.id}>
                          Examen #{exams.length - i} ({new Date(ex.exam_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}) - {ex.lens_type || 'General'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-[#434653] uppercase tracking-wider mb-2">Cupón de Descuento</label>
                  <div className="relative">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
                    <input type="text" placeholder="Ej. RAYO20" value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg py-2 pl-9 pr-3 text-xs focus:border-[#00357f] outline-none font-mono uppercase" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-[#434653] uppercase tracking-wider mb-2">Notas de la Venta</label>
                  <textarea rows={2} placeholder="Instrucciones especiales, laboratorio, entrega..." value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-3 text-xs focus:border-[#00357f] outline-none resize-none" />
                </div>
                <div className="md:col-span-2 border-t border-[#cbd5e1]/45 pt-4 mt-2 flex items-center justify-between">
                  <div className="text-left">
                    <label className="block text-xs font-bold text-[#111c2d]">Permitir visualización de Receta al Cliente</label>
                    <p className="text-[10px] text-[#737784] font-medium mt-0.5">
                      Si se activa, el cliente podrá ver los valores detallados de su graduación óptica desde su perfil web.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPrescriptionVisible(!isPrescriptionVisible)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPrescriptionVisible ? 'bg-[#00357f]' : 'bg-[#cbd5e1]'}`}
                  >
                    <span 
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPrescriptionVisible ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#cbd5e1]/40">
                <Link href={`/customers/${customerId}`}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors">
                  Cancelar
                </Link>
                <button type="submit"
                  disabled={isPending || cart.length === 0 || !!state?.success}
                  className="bg-[#00357f] hover:bg-[#004aad] text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer text-xs">
                  {isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Registrando venta...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {paymentMode === 'single' ? 'Confirmar y Cobrar' : 'Confirmar Plan y Cobrar Anticipo'}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Payment Schedule Table */}
            {paymentMode === 'installments' && paymentSchedule.length > 0 && (
              <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#cbd5e1] bg-[#f9f9ff] flex justify-between items-center">
                  <h3 className="font-bold text-xs text-[#00357f] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Plan de Pagos Proyectado
                  </h3>
                  <div className="flex gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-[#737784]">
                      <span className="w-2 h-2 rounded-full bg-[#40c2fd]" /> Anticipo
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-[#737784]">
                      <span className="w-2 h-2 rounded-full bg-[#c3c6d5]" /> Pendiente
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-[#f9f9ff] border-b border-[#cbd5e1]">
                        <th className="text-[10px] font-black text-[#737784] uppercase p-3 px-4 w-24">Cuota</th>
                        <th className="text-[10px] font-black text-[#737784] uppercase p-3 px-4">Fecha de Vencimiento</th>
                        <th className="text-[10px] font-black text-[#737784] uppercase p-3 px-4 text-right">Monto</th>
                        <th className="text-[10px] font-black text-[#737784] uppercase p-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-[#111c2d]">
                      {/* Down payment row */}
                      <tr className="border-b border-[#cbd5e1] bg-[#f0f3ff]">
                        <td className="p-3 px-4 text-[#737784] font-bold">Anticipo</td>
                        <td className="p-3 px-4 font-semibold text-[#111c2d]">
                          Hoy ({new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })})
                        </td>
                        <td className="p-3 px-4 text-right font-bold text-[#00357f]">{formatPrice(downPaymentNum)}</td>
                        <td className="p-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#40c2fd]/20 text-[#00668a] text-[10px] font-bold border border-[#40c2fd]/30">
                            Por Cobrar
                          </span>
                        </td>
                      </tr>
                      {/* Installment rows */}
                      {paymentSchedule.map((pmt, idx) => (
                        <tr key={idx} className={`border-b border-[#cbd5e1] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9ff]'}`}>
                          <td className="p-3 px-4 text-[#737784]">{pmt.num} de {numInstallments}</td>
                          <td className="p-3 px-4 text-[#111c2d]">{pmt.date}</td>
                          <td className="p-3 px-4 text-right font-semibold">{formatPrice(pmt.amount)}</td>
                          <td className="p-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#d8e3fb] text-[#434653] text-[10px] font-bold border border-[#c3c6d5]/50">
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  )
}
