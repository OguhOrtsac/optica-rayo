'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getProducts, getWishlist, toggleWishlistItem } from '@/lib/services'
import { getProfileData } from '@/app/auth/actions'
import { Database } from '@/types/database.types'
import useEmblaCarousel from 'embla-carousel-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  SlidersHorizontal, 
  Search, 
  Grid, 
  List, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  Info, 
  X, 
  Tag, 
  Compass, 
  Percent,
  Heart,
  Eye,
  Activity,
  Layers,
  FileText,
  Upload,
  CheckCircle,
  TrendingDown
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

interface ProfileData {
  username: string
  fullName: string
  role: string
  email: string
}

function CatalogContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Authenticated user state (for Wishlist sync)
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null)
  const [wishlist, setWishlist] = useState<string[]>([])

  // Face Shape Filter state (Shallow Routed)
  const faceShapeFilter = searchParams.get('faceShape') || 'all'

  // Embla Carousel Hook for Promo banner
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center', duration: 30 })
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false)
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  // Fetch URL Parameters (Shallow Routing values)
  const categoryFilter = searchParams.get('category') || 'all'
  const maxPriceFilter = parseInt(searchParams.get('price') || '10000')
  const searchTerm = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'recommended'
  const onlyPromoFilter = searchParams.get('promo') === 'true'
  const layoutMode = (searchParams.get('layout') as 'grid' | 'list') || 'grid'

  // Lens Wizard Stepper state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [selectedGraduation, setSelectedGraduation] = useState<'none' | 'monofocal' | 'bifocal' | 'progresivo'>('none')
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([])
  const [prescriptionMode, setPrescriptionMode] = useState<'upload' | 'manual'>('upload')
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  
  // Manual prescription values
  const [odSphere, setOdSphere] = useState('0.00')
  const [odCylinder, setOdCylinder] = useState('0.00')
  const [odAxis, setOdAxis] = useState('0')
  const [oiSphere, setOiSphere] = useState('0.00')
  const [oiCylinder, setOiCylinder] = useState('0.00')
  const [oiAxis, setOiAxis] = useState('0')

  // Load products and verify user auth session
  useEffect(() => {
    async function initCatalog() {
      try {
        setLoading(true)
        const productsData = await getProducts()
        setProducts(productsData)

        // Try to fetch profile
        try {
          const profile = await getProfileData()
          if (profile) {
            setUserProfile(profile)
            // Fetch wishlist from server
            const serverWishlist = await getWishlist(profile.email)
            setWishlist(serverWishlist)
          }
        } catch (_) {
          // Guest mode: load wishlist from localStorage
          const localWishlist = localStorage.getItem('optica_rayo_wishlist')
          if (localWishlist) {
            setWishlist(JSON.parse(localWishlist))
          }
        }
      } catch (e) {
        console.error('Error initializing public catalog:', e)
      } finally {
        setLoading(false)
      }
    }
    initCatalog()
  }, [])

  // Categories definitions
  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'frames', label: 'Armazones' },
    { value: 'lenses', label: 'Micas' },
    { value: 'contact_lenses', label: 'Lentes de Contacto' },
    { value: 'accessories', label: 'Accesorios' }
  ]

  // Face shape definitions
  const faceShapes = [
    { value: 'all', label: 'Cualquiera' },
    { value: 'round', label: 'Redondo' },
    { value: 'square', label: 'Cuadrado' },
    { value: 'oval', label: 'Ovalado' }
  ]

  // Calculate dynamic absolute max price
  const absoluteMaxPrice = useMemo(() => {
    if (products.length === 0) return 10000
    return Math.ceil(Math.max(...products.map(p => p.price)))
  }, [products])

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length }
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [products])

  // Filter products for the Hero Carousel (Promos or Featured with images)
  const promoProducts = useMemo(() => {
    return products.filter(p => (p.is_promo || p.is_featured) && p.image_url)
  }, [products])

  // Embla Carousel navigation helpers
  const scrollPrev = () => emblaApi && emblaApi.scrollPrev()
  const scrollNext = () => emblaApi && emblaApi.scrollNext()
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index)

  const onSelect = () => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setPrevBtnEnabled(emblaApi.canScrollPrev())
    setNextBtnEnabled(emblaApi.canScrollNext())
  }

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    setScrollSnaps(emblaApi.scrollSnapList())
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
  }, [emblaApi, promoProducts])

  // Shallow Routing handler: update query parameters without reloading
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all' && value !== '') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`/catalog?${params.toString()}`, { scroll: false })
  }

  const handleResetFilters = () => {
    router.replace('/catalog', { scroll: false })
  }

  // Check product face shape compatibility
  const isFaceShapeCompatible = (productName: string, shape: string) => {
    if (shape === 'all') return true
    
    const nameLower = productName.toLowerCase()
    if (shape === 'round') {
      // Clubmaster, Navigator, Aviador match round/oval faces
      return nameLower.includes('clubmaster') || nameLower.includes('navigator') || nameLower.includes('aviador') || nameLower.includes('gucci')
    }
    if (shape === 'square') {
      // Holbrook, Carey match square/round faces
      return nameLower.includes('holbrook') || nameLower.includes('carey') || nameLower.includes('vintage')
    }
    if (shape === 'oval') {
      // Clubmaster, Gucci GG match oval faces
      return nameLower.includes('clubmaster') || nameLower.includes('gucci') || nameLower.includes('retro')
    }
    return true
  }

  // Filter and Sort execution
  const processedProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
      const matchesPrice = p.price <= maxPriceFilter
      const matchesPromo = !onlyPromoFilter || p.is_promo
      
      // Face shape match
      const matchesFaceShape = isFaceShapeCompatible(p.name, faceShapeFilter)

      return matchesSearch && matchesCategory && matchesPrice && matchesPromo && matchesFaceShape
    })

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [products, searchTerm, categoryFilter, maxPriceFilter, onlyPromoFilter, faceShapeFilter, sortBy])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Wishlist Action Toggle (Hybrid Local/Supabase)
  const handleToggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const isFav = wishlist.includes(productId)
    let newWishlist = [...wishlist]

    if (isFav) {
      newWishlist = newWishlist.filter(id => id !== productId)
    } else {
      newWishlist.push(productId)
    }
    setWishlist(newWishlist)

    if (userProfile) {
      // Authenticated User: sync directly with DB / Mock DB via API
      await toggleWishlistItem(userProfile.email, productId, !isFav)
      console.log(`Wishlist updated on DB/Mocks for ${userProfile.email}`)
    } else {
      // Guest User: store in localStorage
      localStorage.setItem('optica_rayo_wishlist', JSON.stringify(newWishlist))
      console.log('Wishlist updated on LocalStorage (Guest Mode)')
    }
  }

  // Calculate live prescription lens price additions
  const extraCosts = useMemo(() => {
    let sum = 0
    if (selectedGraduation === 'monofocal') sum += 800
    if (selectedGraduation === 'bifocal') sum += 1200
    if (selectedGraduation === 'progresivo') sum += 2200

    selectedTreatments.forEach(t => {
      if (t === 'antireflective') sum += 300
      if (t === 'blueblock') sum += 500
      if (t === 'transitions') sum += 1200
    })

    return sum
  }, [selectedGraduation, selectedTreatments])

  const totalConfiguredPrice = useMemo(() => {
    if (!selectedProduct) return 0
    return selectedProduct.price + extraCosts
  }, [selectedProduct, extraCosts])

  // Handle fake file uploads for visual response
  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFileName(e.target.files[0].name)
    }
  }

  const getWhatsAppLink = (product: Product) => {
    const phoneNumber = '521234567890'
    let configurationSummary = ''
    
    if (product.category === 'frames' && selectedGraduation !== 'none') {
      const gradName = 
        selectedGraduation === 'monofocal' ? 'Monofocal (+ $800)' :
        selectedGraduation === 'bifocal' ? 'Bifocal (+ $1,200)' : 'Progresivo (+ $2,200)'
        
      const treatmentsSummary = selectedTreatments.map(t => 
        t === 'antireflective' ? 'Antirreflejante (+ $300)' :
        t === 'blueblock' ? 'Filtro Luz Azul (+ $500)' : 'Transitions Fotocromático (+ $1,200)'
      ).join(', ') || 'Ninguno'

      configurationSummary = `\n\n*--- Configuración de Micas ---*\n- *Graduación:* ${gradName}\n- *Tratamientos:* ${treatmentsSummary}\n- *Precio Total:* ${formatPrice(totalConfiguredPrice)}`
    }

    const message = encodeURIComponent(
      `¡Hola! Estoy muy interesado en adquirir este producto del catálogo:\n\n*Lentes:* ${product.name}\n*Precio Base:* ${formatPrice(product.price)}${configurationSummary}\n\n¿Cuentan con disponibilidad para probármelos en sucursal o agendar mi examen de vista?`
    )
    return `https://wa.me/${phoneNumber}?text=${message}`
  }

  // Opens product detail modal and resets stepper configuration
  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product)
    setWizardStep(1)
    setSelectedGraduation('none')
    setSelectedTreatments([])
    setUploadedFileName('')
  }

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* High-end design backdrops */}
      <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/10 to-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-violet-600/5 to-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-10 relative">
        
        {/* Header / Brand */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-cyan-500 to-indigo-500 p-1.5 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Compass className="w-5 h-5 text-slate-950" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Escaparate Digital</span>
              {userProfile && (
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full">
                  Paciente: {userProfile.fullName}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-350 to-indigo-400 bg-clip-text text-transparent">
              Colección Óptica Rayo
            </h1>
            <p className="text-xs text-slate-550 max-w-xl">
              Modelos oftálmicos de alta costura, lentes solares y micas progresivas de última generación.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-800/40 p-4 rounded-2xl max-w-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Examen de Vista Gratis</p>
                <p className="text-xs text-slate-400 font-semibold leading-snug">Al armar tus lentes graduados completos.</p>
              </div>
            </div>
            
            {userProfile ? (
              <a 
                href="/dashboard/customer" 
                className="bg-slate-900 border border-slate-800 hover:text-cyan-400 px-4 py-3 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[44px] flex items-center"
              >
                Mi Portal Paciente
              </a>
            ) : (
              <a 
                href="/login" 
                className="bg-gradient-to-tr from-cyan-550 to-indigo-600 hover:from-cyan-450 text-slate-955 px-4.5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0 cursor-pointer min-h-[44px] flex items-center"
              >
                Ingresar
              </a>
            )}
          </div>
        </div>

        {/* HERO CAROUSEL: INMERSIVO & TÁCTIL */}
        {promoProducts.length > 0 && (
          <div className="relative group/carousel max-w-5xl mx-auto">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-550 mb-3.5 flex items-center gap-2 px-1">
              <Percent className="w-4 h-4 text-cyan-400 shrink-0" />
              Modelos Destacados y Promociones
            </h2>

            <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-955/40 shadow-2xl" ref={emblaRef}>
              <div className="flex">
                {promoProducts.map((p) => (
                  <div key={p.id} className="flex-[0_0_100%] min-w-0 relative h-[320px] md:h-[400px] flex items-center">
                    <img 
                      src={p.image_url || ''} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover opacity-15 blur-xl pointer-events-none"
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full items-center relative z-10 p-6 md:p-12 gap-6">
                      
                      <div className="space-y-4 text-left order-2 md:order-1 flex flex-col justify-center">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-550/40 text-cyan-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                            {p.category === 'frames' ? 'Armazón' : 'Solar'}
                          </span>
                          <span className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                            <Tag className="w-3 h-3 shrink-0" /> Promoción Especial
                          </span>
                        </div>

                        <h3 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight leading-tight">
                          {p.name}
                        </h3>
                        
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed max-w-md">
                          {p.description}
                        </p>

                        <div className="flex items-center gap-5 pt-2">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">Precio Especial</span>
                            <span className="text-2xl font-black text-slate-100">{formatPrice(p.price)}</span>
                          </div>
                          
                          <a
                            href={getWhatsAppLink(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-550 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-cyan-500/10 cursor-pointer flex items-center gap-2 min-h-[44px]"
                          >
                            <Phone className="w-4 h-4 text-slate-955" />
                            Apartar por WhatsApp
                          </a>
                        </div>
                      </div>

                      <div className="w-full h-44 md:h-72 rounded-2xl overflow-hidden bg-slate-955/60 border border-slate-900 shadow-xl order-1 md:order-2 relative">
                        <img 
                          src={p.image_url || ''} 
                          alt={p.name} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                        />
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={scrollPrev}
              disabled={!prevBtnEnabled}
              className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 backdrop-blur border border-slate-800 flex items-center justify-center text-slate-450 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl z-25 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!nextBtnEnabled}
              className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 backdrop-blur border border-slate-800 flex items-center justify-center text-slate-455 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl z-25 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex justify-center gap-1.5 mt-3.5">
              {scrollSnaps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollTo(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                    index === selectedIndex ? 'bg-cyan-400 w-6' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* LAYOUT: FILTER SIDEBAR & PRODUCT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* 1. FILTER SIDEBAR (SHALLOW ROUTING SYSTEM) */}
          <aside className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-6 lg:sticky lg:top-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-950">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                Filtros
              </span>
              <button
                onClick={handleResetFilters}
                className="text-[10px] font-extrabold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Limpiar Filtros
              </button>
            </div>

            {/* Categories buttons */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Categoría</label>
              <div className="flex flex-col gap-1.5">
                {categories.map(cat => {
                  const count = categoryCounts[cat.value] || 0
                  const isSelected = categoryFilter === cat.value
                  return (
                    <button
                      key={cat.value}
                      onClick={() => updateFilter('category', cat.value)}
                      className={`flex justify-between items-center px-4 py-3 rounded-2xl text-xs font-bold border text-left transition-all cursor-pointer min-h-[44px] ${
                        isSelected
                          ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border-cyan-500 text-cyan-400 shadow-md shadow-cyan-500/5'
                          : 'bg-slate-955/40 border-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-800'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[10px] opacity-60">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Face Shape Filter */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Forma de Rostro</label>
              <div className="grid grid-cols-2 gap-1.5">
                {faceShapes.map(shape => {
                  const isSelected = faceShapeFilter === shape.value
                  return (
                    <button
                      key={shape.value}
                      onClick={() => updateFilter('faceShape', shape.value)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold border text-center transition-all cursor-pointer min-h-[38px] uppercase tracking-wider ${
                        isSelected
                          ? 'bg-gradient-to-tr from-cyan-500/15 to-indigo-500/15 border-cyan-500 text-cyan-400'
                          : 'bg-slate-955/40 border-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-800'
                      }`}
                    >
                      {shape.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price slider filter */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                <label>Precio Máximo</label>
                <span className="text-cyan-400 text-xs font-black">{formatPrice(maxPriceFilter)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={absoluteMaxPrice || 10000}
                step="100"
                value={maxPriceFilter}
                onChange={e => updateFilter('price', e.target.value)}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                <span>$0</span>
                <span>{formatPrice(absoluteMaxPrice || 10000)}</span>
              </div>
            </div>

            {/* Toggle Promos Only */}
            <div className="flex items-center justify-between p-3.5 bg-slate-955/40 border border-slate-950 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-350">Solo Promociones</p>
                <p className="text-[9px] text-slate-500">Filtrar con precio especial</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPromoFilter}
                  onChange={e => updateFilter('promo', e.target.checked ? 'true' : null)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-955"></div>
              </label>
            </div>
          </aside>

          {/* 2. RESULTS CONTAINER */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Header controls bar */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
              
              {/* Live search input */}
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar modelo, marca, cristal..."
                  value={searchTerm}
                  onChange={e => updateFilter('search', e.target.value)}
                  className="w-full bg-slate-955 border border-slate-900 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all min-h-[44px]"
                />
              </div>

              {/* View options */}
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                
                {/* Sort selector */}
                <select
                  value={sortBy}
                  onChange={e => updateFilter('sort', e.target.value)}
                  className="bg-slate-955 border border-slate-900 rounded-2xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 cursor-pointer min-h-[44px] font-bold"
                >
                  <option value="recommended">Recomendados</option>
                  <option value="price_asc">Precio: Menor a Mayor</option>
                  <option value="price_desc">Precio: Mayor a Menor</option>
                  <option value="name_asc">Nombre: A-Z</option>
                </select>

                {/* Grid vs List toggle layout */}
                <div className="flex bg-slate-955 border border-slate-900 rounded-2xl p-1 shrink-0">
                  <button
                    onClick={() => updateFilter('layout', 'grid')}
                    className={`p-2 rounded-xl transition-all cursor-pointer min-h-[36px] ${
                      layoutMode === 'grid'
                        ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400'
                        : 'text-slate-550 hover:text-slate-355'
                    }`}
                    title="Vista Cuadrícula"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateFilter('layout', 'list')}
                    className={`p-2 rounded-xl transition-all cursor-pointer min-h-[36px] ${
                      layoutMode === 'list'
                        ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400'
                        : 'text-slate-550 hover:text-slate-355'
                    }`}
                    title="Vista Lista"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>

            {/* List / Grid display with Framer Motion Layout animation */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-550 border-t-transparent" />
                <p className="text-xs text-slate-550 font-bold">Cargando catálogo...</p>
              </div>
            ) : processedProducts.length === 0 ? (
              <div className="text-center py-28 bg-slate-900/10 border border-slate-900 rounded-3xl space-y-3">
                <div className="w-12 h-12 bg-slate-955 border border-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500">
                  <Info className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-350">Ningún lente coincide con tus filtros</h3>
                  <p className="text-xs text-slate-550 max-w-xs mx-auto leading-normal">
                    Intenta cambiar los parámetros o limpia todos los filtros aplicados.
                  </p>
                </div>
              </div>
            ) : (
              <motion.div 
                layout 
                className={
                  layoutMode === 'grid' 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" 
                    : "flex flex-col gap-4"
                }
              >
                <AnimatePresence mode="popLayout">
                  {processedProducts.map(p => {
                    const isFaved = wishlist.includes(p.id)
                    const isCriticalStock = p.stock <= 3 && p.stock > 0

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -6 }}
                        key={p.id}
                        className={`bg-slate-900/30 border border-slate-900/60 hover:border-cyan-500/25 rounded-3xl p-4 flex flex-col justify-between gap-4 transition-all duration-350 group relative overflow-hidden ${
                          layoutMode === 'list' ? 'sm:flex-row items-center' : ''
                        }`}
                      >
                        {/* Wishlist Heart Trigger */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleWishlist(p.id, e)}
                          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-all cursor-pointer hover:scale-105 active:scale-95"
                          title={isFaved ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        >
                          <Heart className={`w-4 h-4 transition-all ${isFaved ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                        </button>

                        {/* Scarcity Trigger: critical stock <= 3 */}
                        {isCriticalStock && (
                          <div className="absolute top-3 left-3 z-20 bg-rose-600/90 border border-rose-500 text-slate-100 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg shadow-rose-950/20 animate-pulse">
                            <TrendingDown className="w-3 h-3 shrink-0 text-slate-100" /> ¡Últimas {p.stock} piezas!
                          </div>
                        )}

                        {/* Promotion ribbon */}
                        {p.is_promo && !isCriticalStock && (
                          <div className="absolute top-3 left-3 z-20 bg-rose-500 text-slate-955 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                            <Percent className="w-2.5 h-2.5" /> Promo
                          </div>
                        )}

                        <div className={`space-y-4 ${layoutMode === 'list' ? 'flex flex-row items-center gap-4 w-full sm:w-auto' : ''}`}>
                          {/* Image Box */}
                          {p.image_url ? (
                            <div className={`rounded-2xl overflow-hidden bg-slate-955 border border-slate-955/60 shrink-0 relative ${
                              layoutMode === 'list' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-full h-44'
                            }`}>
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-slate-955/65 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-slate-900/90 border border-cyan-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Ver más
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className={`rounded-2xl bg-slate-955 border border-slate-950 shrink-0 flex items-center justify-center text-slate-655 relative ${
                              layoutMode === 'list' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-full h-44'
                            }`}>
                              <Compass className="w-10 h-10 opacity-20 group-hover:scale-110 transition-transform" />
                              <div className="absolute inset-0 bg-slate-955/65 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-slate-900/90 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                                  Ver más
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider">
                                {p.category === 'frames' && 'Armazón'}
                                {p.category === 'lenses' && 'Mica'}
                                {p.category === 'contact_lenses' && 'Lente de Contacto'}
                                {p.category === 'accessories' && 'Accesorio'}
                              </span>
                              
                              <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                p.stock === 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                p.stock < 5 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {p.stock === 0 ? 'Agotado' : p.stock < 5 ? `Últimas ${p.stock} pz` : 'Disponible'}
                              </span>
                            </div>

                            <h3 className="font-extrabold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate max-w-[200px]">
                              {p.name}
                            </h3>
                            
                            {layoutMode === 'grid' && (
                              <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                                {p.description || 'Detalle estético de calidad superior.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pricing & Call to Actions */}
                        <div className={`border-t border-slate-950/80 pt-3 flex items-center justify-between gap-3 ${
                          layoutMode === 'list' ? 'sm:border-t-0 sm:pt-0 sm:justify-end sm:w-auto w-full' : 'w-full'
                        }`}>
                          <div className="min-w-0">
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Precio Especial</p>
                            <p className="font-black text-slate-100 text-sm">{formatPrice(p.price)}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(p)}
                              className="text-[10px] font-black text-slate-450 hover:text-slate-200 bg-slate-955 border border-slate-900 px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap min-h-[38px] flex items-center"
                            >
                              Detalle
                            </button>
                            <a
                              href={getWhatsAppLink(p)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-400 hover:to-teal-555 text-slate-955 font-black text-[10px] px-3.5 py-2 rounded-xl shadow cursor-pointer whitespace-nowrap min-h-[38px]"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-955" />
                              Consultar
                            </a>
                          </div>
                        </div>

                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}

          </div>

        </div>

      </div>

      {/* ========================================================
         MODAL: LENS WIZARD STEPPER CONFIGURATOR
         ======================================================== */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-3xl p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] relative"
            >
              {/* Close trigger */}
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 text-slate-500 hover:text-slate-250 cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center border border-slate-800 rounded-xl bg-slate-955/40"
              >
                <X className="w-4 h-4" />
              </button>

              {/* LENS WIZARD HEADER */}
              <div className="space-y-1 text-left">
                <span className="text-[9px] font-black uppercase text-cyan-400 tracking-widest bg-slate-955 px-2.5 py-1 rounded border border-slate-950">
                  {selectedProduct.category === 'frames' ? 'Lens Wizard Activo' : 'Detalle del Lente'}
                </span>
                <h3 className="text-lg font-black text-slate-100 mt-2 truncate max-w-[280px]">{selectedProduct.name}</h3>
              </div>

              {/* Image banner inside Modal */}
              {selectedProduct.image_url && wizardStep === 1 && (
                <div className="w-full h-44 rounded-2xl overflow-hidden bg-slate-955 border border-slate-950">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* CONDITIONAL WIZARD FLOW FOR FRAMES */}
              {selectedProduct.category === 'frames' ? (
                <div className="space-y-5 text-left border-t border-b border-slate-950 py-4">
                  {/* STEPPER PROGRESS INDICATOR */}
                  <div className="flex justify-between items-center px-4 bg-slate-955/60 py-2 border border-slate-955 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className={wizardStep === 1 ? 'text-cyan-400' : 'text-emerald-400'}>1. Graduación</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 2 ? 'text-cyan-400' : wizardStep > 2 ? 'text-emerald-400' : ''}>2. Filtros</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 3 ? 'text-cyan-400' : ''}>3. Receta</span>
                  </div>

                  {/* STEP 1: GRADUATION SELECTION */}
                  {wizardStep === 1 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        Paso 1: Selecciona el tipo de mica graduada
                      </p>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'none', label: 'Sin graduación (Protección básica)', cost: '+$0 MXN' },
                          { value: 'monofocal', label: 'Monofocal (Visión de Lejos o Cerca)', cost: '+$800 MXN' },
                          { value: 'bifocal', label: 'Bifocal (Visión Doble con luneta)', cost: '+$1,200 MXN' },
                          { value: 'progresivo', label: 'Progresivo Premium (Multi-distancia fluida)', cost: '+$2,200 MXN' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setSelectedGraduation(opt.value as any)}
                            className={`flex justify-between items-center px-4 py-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[48px] ${
                              selectedGraduation === opt.value
                                ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border-cyan-550 text-cyan-400'
                                : 'bg-slate-955/40 border-slate-950 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="text-[10px] text-cyan-400 shrink-0">{opt.cost}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: TREATMENT FILTERS */}
                  {wizardStep === 2 && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Paso 2: Tratamientos y Filtros Adicionales
                      </p>

                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'antireflective', label: 'Antirreflejante Crizal (Elimina destellos)', cost: '+$300 MXN' },
                          { value: 'blueblock', label: 'Blue Shield (Filtro para celular/pantalla)', cost: '+$500 MXN' },
                          { value: 'transitions', label: 'Transitions (Micas que se oscurecen al sol)', cost: '+$1,200 MXN' }
                        ].map(opt => {
                          const isSelected = selectedTreatments.includes(opt.value)
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTreatments(selectedTreatments.filter(t => t !== opt.value))
                                } else {
                                  setSelectedTreatments([...selectedTreatments, opt.value])
                                }
                              }}
                              className={`flex justify-between items-center px-4 py-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[48px] ${
                                isSelected
                                  ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border-cyan-550 text-cyan-400'
                                  : 'bg-slate-955/40 border-slate-950 text-slate-400 hover:border-slate-800'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className="text-[10px] text-cyan-400 shrink-0">{opt.cost}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PRESCRIPTION METHOD */}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        Paso 3: Sube tu receta u organízala manual
                      </p>

                      <div className="flex bg-slate-955 border border-slate-950 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setPrescriptionMode('upload')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                            prescriptionMode === 'upload' ? 'bg-slate-900 text-cyan-400 border border-slate-800/40' : 'text-slate-500'
                          }`}
                        >
                          Subir Receta
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrescriptionMode('manual')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                            prescriptionMode === 'manual' ? 'bg-slate-900 text-cyan-400 border border-slate-800/40' : 'text-slate-500'
                          }`}
                        >
                          Manual
                        </button>
                      </div>

                      {prescriptionMode === 'upload' ? (
                        /* Upload recipe box */
                        <div className="border-2 border-dashed border-slate-800 hover:border-cyan-550/40 p-6 rounded-2xl bg-slate-955/30 text-center transition-all relative">
                          <input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={handleFakeUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="space-y-2 flex flex-col items-center">
                            <Upload className="w-8 h-8 text-cyan-400 animate-bounce" />
                            {uploadedFileName ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                                <CheckCircle className="w-4 h-4" />
                                <span>{uploadedFileName} cargada!</span>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-slate-300">Arrastra tu receta o haz clic aquí</p>
                                <p className="text-[10px] text-slate-500">Admite PDF, JPG, PNG de tu examen clínico</p>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Manual inputs OD e OI */
                        <div className="space-y-3 bg-slate-955/40 p-4 border border-slate-950 rounded-2xl text-xs">
                          {/* Right eye */}
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-cyan-400">Ojo Derecho (OD)</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Esf</label>
                                <input type="text" value={odSphere} onChange={e => setOdSphere(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Cil</label>
                                <input type="text" value={odCylinder} onChange={e => setOdCylinder(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Eje</label>
                                <input type="text" value={odAxis} onChange={e => setOdAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                            </div>
                          </div>

                          {/* Left eye */}
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-indigo-400">Ojo Izquierdo (OI)</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Esf</label>
                                <input type="text" value={oiSphere} onChange={e => setOiSphere(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Cil</label>
                                <input type="text" value={oiCylinder} onChange={e => setOiCylinder(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                              <div>
                                <label className="text-[8px] text-slate-500 font-bold block mb-1">Eje</label>
                                <input type="text" value={oiAxis} onChange={e => setOiAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-center text-slate-200" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEPPER WIZARD FOOTER NAVIGATION */}
                  <div className="flex justify-between items-center gap-3 pt-2">
                    {wizardStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setWizardStep((wizardStep - 1) as any)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2.5 rounded-xl cursor-pointer"
                      >
                        Atrás
                      </button>
                    )}
                    
                    {wizardStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => setWizardStep((wizardStep + 1) as any)}
                        className="ml-auto text-xs font-bold text-slate-955 bg-cyan-400 px-5 py-2.5 rounded-xl cursor-pointer"
                      >
                        Siguiente paso
                      </button>
                    ) : (
                      <span className="text-[9px] font-black text-emerald-400 ml-auto uppercase bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-emerald-950/20">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Receta Configurada
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Plain product layout for Lenses, Contact lenses or accessories */
                <div className="space-y-4 text-left border-t border-b border-slate-950 py-4">
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-955/50 border border-slate-950/40 p-4 rounded-2xl">
                    {selectedProduct.description || 'Detalles del accesorio o producto clínico premium.'}
                  </p>
                </div>
              )}

              {/* LIVE PRICING CALCULATION PANEL */}
              <div className="flex justify-between items-center bg-slate-955/50 border border-slate-950/40 p-4 rounded-2xl">
                <div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                    {selectedGraduation !== 'none' ? 'Total Configurado' : 'Precio Sugerido'}
                  </p>
                  <p className="text-2xl font-black text-cyan-400">
                    {formatPrice(selectedProduct.category === 'frames' ? totalConfiguredPrice : selectedProduct.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Garantía Óptica</p>
                  <p className="text-xs text-slate-350 font-bold">1 Año Rayo Care</p>
                </div>
              </div>

              {/* Final Actions buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 text-xs font-black text-slate-450 hover:text-slate-200 bg-slate-955 border border-slate-900 py-3 rounded-xl cursor-pointer min-h-[44px]"
                >
                  Cerrar
                </button>
                <a
                  href={getWhatsAppLink(selectedProduct)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-400 hover:to-teal-500 text-slate-955 font-black text-xs py-3 rounded-xl shadow cursor-pointer min-h-[44px]"
                >
                  <Phone className="w-4 h-4 text-slate-955 shrink-0" />
                  {selectedProduct.category === 'frames' && selectedGraduation !== 'none' ? 'Comprar Lentes' : 'Consultar Disponibilidad'}
                </a>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  )
}

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-955 text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-550 border-t-transparent" />
        <p className="text-xs text-slate-500 font-black">Cargando catálogo...</p>
      </div>
    }>
      <CatalogContent />
    </Suspense>
  )
}
