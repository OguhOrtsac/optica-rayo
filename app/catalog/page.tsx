'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getProducts, getWishlist, toggleWishlistItem, getMemberDiscountPercent } from '@/lib/services'
import { effectiveClientPrice } from '@/lib/pricing'
import { getProductDescription, getProductDetails, getProductImageAlt, getProductImages } from '@/lib/product-data'
import { getProfileData } from '@/app/auth/actions'
import { Database } from '@/types/database.types'
import useEmblaCarousel from 'embla-carousel-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SlidersHorizontal,
  Search,
  Grid,
  List,
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
  TrendingDown,
  Sparkles
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

interface ProfileData {
  id: string
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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Authenticated user state (for Wishlist sync)
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null)
  const [wishlist, setWishlist] = useState<string[]>([])

  // Member pricing: logged-in customers get the general discount percent
  // or the product's special client price; visitors never see either.
  const [memberPct, setMemberPct] = useState(0)
  const isClient = !!userProfile && userProfile.role === 'customer'
  const priceOf = (p: Product) =>
    isClient ? effectiveClientPrice(p.price, p.client_price, memberPct) : p.price

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
  const selectedCategories = useMemo(() => {
    return categoryFilter !== 'all' ? categoryFilter.split(',') : []
  }, [categoryFilter])
  const maxPriceFilter = parseInt(searchParams.get('price') || '10000')
  const searchTerm = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'recommended'
  const onlyPromoFilter = searchParams.get('promo') === 'true'
  const layoutMode = (searchParams.get('layout') as 'grid' | 'list') || 'grid'
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

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
        const pct = await getMemberDiscountPercent()
        setMemberPct(pct)

        // Try to fetch profile
        try {
          const profile = await getProfileData()
          if (profile) {
            setUserProfile(profile)
            // Fetch wishlist from server
            const serverWishlist = await getWishlist(profile.id)
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
    return products.filter(p => (p.is_promo || p.is_featured) && getProductImages(p).length > 0)
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

  // Shallow Routing handler
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all' && value !== '') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`/catalog?${params.toString()}`, { scroll: false })
  }

  const toggleCategoryFilter = (catValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (catValue === 'all') {
      params.delete('category')
    } else {
      let currentList = params.get('category')?.split(',') || []
      currentList = currentList.filter(c => c !== 'all' && c !== '')

      if (currentList.includes(catValue)) {
        currentList = currentList.filter(c => c !== catValue)
      } else {
        currentList.push(catValue)
      }

      if (currentList.length === 0) {
        params.delete('category')
      } else {
        params.set('category', currentList.join(','))
      }
    }
    router.replace(`/catalog?${params.toString()}`, { scroll: false })
  }

  const handleResetFilters = () => {
    router.replace('/catalog', { scroll: false })
  }

  // Face-shape guide: prefer the frame_shape selected by the administrator;
  // legacy products without that field fall back to their name.
  const isFaceShapeCompatible = (product: Product, shape: string) => {
    if (shape === 'all') return true
    const frameShape = getProductDetails(product).frameShape
    if (frameShape) {
      if (shape === 'round') return frameShape === 'square' || frameShape === 'rectangular' || frameShape === 'aviator'
      if (shape === 'square') return frameShape === 'round' || frameShape === 'oval' || frameShape === 'cat_eye'
      if (shape === 'oval') return true
      return true
    }

    const nameLower = product.name.toLowerCase()
    if (shape === 'round') {
      return nameLower.includes('rectangular') || nameLower.includes('cuadrado') || nameLower.includes('aviador')
    }
    if (shape === 'square') {
      return nameLower.includes('redondo') || nameLower.includes('ovalado') || nameLower.includes('panto')
    }
    if (shape === 'oval') {
      return true // Compatible with almost all shapes
    }
    return true
  }

  // Filtered and sorted products
  const processedProducts = useMemo(() => {
    let result = [...products]

    // 1. Category Filter
    if (selectedCategories.length > 0) {
      result = result.filter(p => selectedCategories.includes(p.category))
    }

    // 2. Max Price Filter
    result = result.filter(p => p.price <= maxPriceFilter)

    // 3. Search Term Filter
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase()
      result = result.filter(p => {
        const details = getProductDetails(p)
        return [p.name, details.brand, details.material, details.sku, details.color, details.notes]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(q))
      })
    }

    // 4. Promo only Filter
    if (onlyPromoFilter) {
      result = result.filter(p => p.is_promo)
    }

    // 5. Face shape filter
    if (faceShapeFilter !== 'all') {
      result = result.filter(p => isFaceShapeCompatible(p, faceShapeFilter))
    }

    // 6. Sorting
    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [products, selectedCategories, maxPriceFilter, searchTerm, onlyPromoFilter, faceShapeFilter, sortBy])

  // Lens Wizard Price calculator helper
  const totalConfiguredPrice = useMemo(() => {
    if (!selectedProduct) return 0
    let base = priceOf(selectedProduct)

    if (selectedGraduation === 'monofocal') base += 800
    else if (selectedGraduation === 'bifocal') base += 1200
    else if (selectedGraduation === 'progresivo') base += 2200

    selectedTreatments.forEach(t => {
      if (t === 'antireflective') base += 300
      else if (t === 'blueblock') base += 500
      else if (t === 'transitions') base += 1200
    })

    return base
  }, [selectedProduct, selectedGraduation, selectedTreatments])

  // Wishlist handler
  const handleToggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const isCurrentlyFaved = wishlist.includes(productId)
    let updated: string[] = []

    if (isCurrentlyFaved) {
      updated = wishlist.filter(id => id !== productId)
    } else {
      updated = [...wishlist, productId]
    }

    setWishlist(updated)

    if (userProfile) {
      // Sync on server
      try {
        await toggleWishlistItem(userProfile.id, productId, !isCurrentlyFaved)
      } catch (err) {
        console.error('Error updating server wishlist:', err)
      }
    } else {
      // Guest mode
      localStorage.setItem('optica_rayo_wishlist', JSON.stringify(updated))
    }
  }

  // Generate WhatsApp Message query
  const getWhatsAppLink = (product: Product) => {
    const textBase = `Hola Óptica Rayo, estoy interesado en el producto: ${product.name} (Ref: #${product.id.slice(0, 5).toUpperCase()}). `
    let textGraduation = ''

    if (product.category === 'frames' && selectedGraduation !== 'none') {
      textGraduation = `Deseo cotizarlo con micas graduadas tipo: ${selectedGraduation.toUpperCase()}. `
      if (selectedTreatments.length > 0) {
        textGraduation += `Tratamientos solicitados: ${selectedTreatments.join(', ').toUpperCase()}. `
      }
      if (prescriptionMode === 'manual') {
        textGraduation += `Graduación Manual: [OD: Esf ${odSphere}, Cil ${odCylinder}, Eje ${odAxis}] [OI: Esf ${oiSphere}, Cil ${oiCylinder}, Eje ${oiAxis}]. `
      } else if (uploadedFileName) {
        textGraduation += 'Subí mi archivo de receta. '
      }
    }

    const fullMsg = textBase + textGraduation + '¿Tienen disponibilidad en sucursal?'
    return `https://wa.me/521234567890?text=${encodeURIComponent(fullMsg)}`
  }

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFileName(e.target.files[0].name)
    }
  }

  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product)
    setSelectedImageIndex(0)
    setWizardStep(1)
    setSelectedGraduation('none')
    setSelectedTreatments([])
    setUploadedFileName('')
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-[#f9f9ff] to-[#eef4ff] text-[#111c2d] px-3 py-4 sm:p-5 md:p-8 space-y-5 sm:space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left">
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-text {
          background: linear-gradient(to right, #00357f, #0088cc, #00d2ff, #0088cc, #00357f);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
          animation: gradient-x 5s ease infinite;
        }
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #00357f;
          border: 3px solid #ffffff;
          box-shadow: 0 2px 5px rgba(0, 53, 127, 0.3);
          cursor: pointer;
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .custom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          background: #0088cc;
        }
      `}</style>

      {/* Header title */}
      <div className="flex justify-between items-center border-b border-[#e7eeff] pb-5">
        <div>
          <h1 className="text-[1.65rem] leading-tight sm:text-3xl md:text-4xl font-black tracking-tight flex items-center gap-2">
            <span className="animate-gradient-text">Estilo & Claridad Para Tu Mirada</span>
          </h1>
          <p className="text-xs md:text-sm text-[#434653] mt-2 font-bold uppercase tracking-wider">
            Encuentra tus armazones favoritos y cotiza cristales con nuestro asistente digital.
          </p>
        </div>
      </div>

      {/* Member pricing banner */}
      {!loading && memberPct > 0 && !isClient && (
        <div className="flex flex-wrap items-center gap-2 bg-[#dee8ff] border border-[#00357f]/20 rounded-xl px-4 py-3">
          <Tag className="w-4 h-4 text-[#00357f]" />
          <p className="text-xs font-bold text-[#00357f]">
            ¿Ya eres cliente de Óptica Rayo? Inicia sesión y obtén {memberPct}% de descuento en el catálogo, además de precios especiales por producto.
          </p>
        </div>
      )}
      {!loading && isClient && (
        <div className="flex flex-wrap items-center gap-2 bg-[#e2f9ee] border border-[#49da9f]/40 rounded-xl px-4 py-3">
          <Tag className="w-4 h-4 text-[#00422b]" />
          <p className="text-xs font-bold text-[#00422b]">
            Estás viendo tus precios de cliente: {memberPct}% de descuento general aplicado, y precio especial en los productos marcados.
          </p>
        </div>
      )}

      {/* HERO SECTION: EMBREE PROMO CAROUSEL */}
      {promoProducts.length > 0 && (
        <div className="relative w-full overflow-visible">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#737784] mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#00357f]" /> Modelos Destacados y Promociones
          </h2>

          <div className="overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white shadow-sm" ref={emblaRef}>
            <div className="flex">
              {promoProducts.map((p) => (
                <div key={p.id} className="flex-[0_0_100%] min-w-0 relative h-[340px] md:h-[380px] flex items-center">
                  <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full items-center p-6 md:p-10 gap-6">

                    <div className="space-y-4 text-left order-2 md:order-1 flex flex-col justify-center">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="bg-[#dee8ff] text-[#00357f] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded">
                          {p.category === 'frames' ? 'Armazón' : 'Solar'}
                        </span>
                        <span className="bg-[#ffdad6] text-[#ba1a1a] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1">
                          <Percent className="w-3 h-3" /> Especial
                        </span>
                      </div>

                      <h3 className="text-xl md:text-2xl font-extrabold text-[#111c2d] tracking-tight leading-tight">
                        {p.name}
                      </h3>

                      <p className="text-xs text-[#737784] line-clamp-3 leading-relaxed max-w-md font-medium">
                        {getProductDescription(p) || 'Armazón oftálmico de alta resistencia y diseño moderno, compatible con todo tipo de micas graduadas.'}
                      </p>

                      <div className="flex items-center gap-5 pt-2">
                        <div>
                          <span className="text-[9px] text-[#737784] uppercase block font-bold">
                            {isClient && priceOf(p) < p.price ? 'Tu precio de cliente' : 'Precio especial'}
                          </span>
                          <span className="text-2xl font-black text-[#00357f] font-mono">{formatPrice(priceOf(p))}</span>
                          {isClient && priceOf(p) < p.price && (
                            <span className="block text-[10px] text-[#737784] line-through font-mono">{formatPrice(p.price)}</span>
                          )}
                        </div>

                        <a
                          href={getWhatsAppLink(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113] font-bold text-xs px-5 py-3 rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
                          Pedir por WhatsApp
                        </a>
                      </div>
                    </div>

                    <button type="button" onClick={() => handleOpenDetailModal(p)} aria-label={`Ver ${p.name}`} className="group w-full h-44 sm:h-52 md:h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-white to-[#eef4ff] border border-[#cbd5e1]/50 shadow-sm order-1 md:order-2 relative cursor-pointer transition duration-300 hover:shadow-[0_18px_45px_-18px_rgba(0,53,127,0.45)] hover:ring-2 hover:ring-[#00357f]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]">
                      {getProductImages(p).length > 0 ? (
                        <img
                          src={getProductImages(p)[0]}
                          alt={getProductImageAlt(p)}
                          className="w-full h-full object-contain p-3 transition duration-700 group-hover:scale-[1.06] group-hover:brightness-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f0f3ff] text-[#00357f]/30">
                          <Eye className="w-12 h-12 stroke-[1.5]" />
                          <span className="text-[10px] font-bold mt-2 uppercase tracking-wider">Sin Imagen</span>
                        </div>
                      )}
                    </button>

                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={scrollPrev}
            disabled={!prevBtnEnabled}
            className="absolute left-[-15px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-[#cbd5e1] flex items-center justify-center text-[#737784] hover:text-[#111c2d] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm z-20 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!nextBtnEnabled}
            className="absolute right-[-15px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-[#cbd5e1] flex items-center justify-center text-[#737784] hover:text-[#111c2d] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm z-20 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LAYOUT: FILTERS & PRODUCT GRID */}
      <div className="flex flex-col gap-5 items-start w-full">

        {/* 1. COLLAPSIBLE TOP FILTERS */}
        <div className="w-full bg-white border border-[#cbd5e1] rounded-2xl p-5 shadow-sm">
          <div
            className="flex justify-between items-center cursor-pointer select-none group"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <SlidersHorizontal className="w-4.5 h-4.5" />
              Filtros y Búsqueda Avanzada
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetFilters(); }}
                className="text-[10px] font-black text-[#00357f] hover:underline cursor-pointer uppercase"
              >
                Limpiar Filtros
              </button>
              <div className={`transition-transform duration-300 ${isFiltersOpen ? '-rotate-180' : ''}`}>
                <ChevronLeft className="w-4 h-4 text-[#737784] -rotate-90" />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isFiltersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 mt-4 border-t border-[#f0f3ff] space-y-6">

                  {/* Category Filter (Horizontal, Multi-select) */}
                  <div className="space-y-3">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-[#737784]">Categorías (Selecciona una o varias)</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => {
                        const isSelected = cat.value === 'all'
                          ? selectedCategories.length === 0
                          : selectedCategories.includes(cat.value)

                        const count = cat.value === 'all'
                          ? products.length
                          : (categoryCounts[cat.value] || 0)

                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleCategoryFilter(cat.value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer min-h-[38px] ${
                              isSelected
                                ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f] shadow-sm scale-102 font-black'
                                : 'bg-[#f0f3ff] border-[#cbd5e1]/40 text-[#434653] hover:bg-[#dee8ff]/30 hover:border-[#cbd5e1]'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className="text-[9px] opacity-60">({count})</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Other Filters Grid (3 Columns) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-[#f0f3ff]">

                    {/* Face Shape */}
                    <div className="space-y-3">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-[#737784]">Forma de Rostro</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {faceShapes.map(shape => {
                          const isSelected = faceShapeFilter === shape.value
                          return (
                            <button
                              key={shape.value}
                              onClick={() => updateFilter('faceShape', shape.value)}
                              className={`px-3 py-2 rounded-lg text-[10px] font-bold border text-center transition-colors cursor-pointer min-h-[38px] uppercase tracking-wider ${
                                isSelected
                                  ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f]'
                                  : 'bg-[#f0f3ff] border-[#cbd5e1]/40 text-[#434653] hover:bg-[#dee8ff]/30'
                              }`}
                            >
                              {shape.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Smooth, Interactive Price range with illumination */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-[#737784]">
                        <label>Rango de Precio</label>
                        <span className="text-[#00357f] text-xs font-black">
                          $0 - {formatPrice(maxPriceFilter)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={absoluteMaxPrice || 10000}
                        step="100"
                        value={maxPriceFilter}
                        onChange={e => updateFilter('price', e.target.value)}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer custom-slider outline-none transition-all duration-150"
                        style={{
                          background: `linear-gradient(to right, #00357f 0%, #0088cc ${((maxPriceFilter) / (absoluteMaxPrice || 10000)) * 100}%, #f0f3ff ${((maxPriceFilter) / (absoluteMaxPrice || 10000)) * 100}%, #f0f3ff 100%)`
                        }}
                      />
                      <div className="flex justify-between text-[9px] text-[#737784] font-bold">
                        <span>Min: $0</span>
                        <span>Máx: {formatPrice(absoluteMaxPrice || 10000)}</span>
                      </div>
                    </div>

                    {/* Toggle Promos */}
                    <div className="space-y-3 flex flex-col justify-center">
                      <div className="flex items-center justify-between p-3 bg-[#f0f3ff] border border-[#cbd5e1]/40 rounded-xl h-[48px] mt-auto">
                        <span className="text-xs font-bold text-[#434653]">Solo Promociones</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={onlyPromoFilter}
                            onChange={e => updateFilter('promo', e.target.checked ? 'true' : null)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-[#cbd5e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00357f]"></div>
                        </label>
                      </div>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. RESULTS CONTAINER */}
        <div className="w-full space-y-5">

          {/* Controls Bar */}
          <div className="bg-white border border-[#cbd5e1] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">

            {/* Live Search */}
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
              <input
                type="text"
                placeholder="Buscar modelo, marca, cristal..."
                value={searchTerm}
                onChange={e => updateFilter('search', e.target.value)}
                className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
              />
            </div>

            {/* View options */}
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">

              <select
                value={sortBy}
                onChange={e => updateFilter('sort', e.target.value)}
                className="bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg px-4 py-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none cursor-pointer min-h-[40px] font-bold"
              >
                <option value="recommended">Recomendados</option>
                <option value="price_asc">Precio: Menor a Mayor</option>
                <option value="price_desc">Precio: Mayor a Menor</option>
                <option value="name_asc">Nombre: A-Z</option>
              </select>

              <div className="flex bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-1 shrink-0">
                <button
                  onClick={() => updateFilter('layout', 'grid')}
                  className={`p-2 rounded-md transition-colors cursor-pointer ${
                    layoutMode === 'grid'
                      ? 'bg-white text-[#00357f] shadow-sm'
                      : 'text-[#737784] hover:text-[#111c2d]'
                  }`}
                  title="Vista Cuadrícula"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateFilter('layout', 'list')}
                  className={`p-2 rounded-md transition-colors cursor-pointer ${
                    layoutMode === 'list'
                      ? 'bg-white text-[#00357f] shadow-sm'
                      : 'text-[#737784] hover:text-[#111c2d]'
                  }`}
                  title="Vista Lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Results display */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
              <p className="text-xs text-[#737784] font-bold">Cargando catálogo...</p>
            </div>
          ) : processedProducts.length === 0 ? (
            <div className="text-center py-20 bg-white border border-[#cbd5e1] rounded-2xl space-y-3 shadow-sm p-6">
              <div className="w-12 h-12 bg-[#f0f3ff] border border-[#cbd5e1] rounded-full flex items-center justify-center mx-auto text-[#00357f]">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#111c2d]">Ningún lente coincide con tus filtros</h3>
                <p className="text-xs text-[#737784] max-w-xs mx-auto leading-normal font-medium">
                  Intenta cambiar los parámetros o limpia todos los filtros aplicados.
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              layout
              className={
                layoutMode === 'grid'
                  ? "grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
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
                      whileHover={{ y: -4 }}
                      key={p.id}
                      onClick={() => handleOpenDetailModal(p)}
                      className={`cursor-pointer bg-white/95 border border-[#cbd5e1] rounded-3xl p-3 sm:p-4 flex flex-col justify-between gap-4 transition-all duration-300 shadow-sm hover:-translate-y-1 hover:border-[#00357f]/35 hover:shadow-[0_20px_45px_-20px_rgba(0,53,127,0.45)] hover:ring-4 hover:ring-[#00357f]/10 group relative overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
                        layoutMode === 'list' ? 'sm:flex-row sm:items-center' : ''
                      }`}
                    >
                      {/* Wishlist Heart */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWishlist(p.id, e)}
                        className="absolute top-2.5 right-2.5 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/95 border border-[#cbd5e1] text-[#737784] hover:text-rose-600 hover:shadow-[0_0_0_5px_rgba(244,63,94,0.10)] transition cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        title={isFaved ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                      >
                        <Heart className={`w-4 h-4 ${isFaved ? 'fill-rose-500 text-rose-500' : 'text-[#737784]'}`} />
                      </button>

                      {/* Scarcity Trigger */}
                      {isCriticalStock && (
                        <div className="absolute top-3 left-3 z-20 bg-[#ffdad6] text-[#ba1a1a] text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#ffdad6] animate-pulse">
                          {p.stock} pz!
                        </div>
                      )}

                      {/* Promotion ribbon */}
                      {p.is_promo && !isCriticalStock && (
                        <div className="absolute top-3 left-3 z-20 bg-[#49da9f]/20 text-[#00422b] text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#49da9f]/30">
                          Promo
                        </div>
                      )}

                      <div className={`space-y-3 ${layoutMode === 'list' ? 'flex flex-row items-center gap-4 w-full sm:w-auto' : ''}`}>
                        {/* Image Box */}
                        {getProductImages(p).length > 0 ? (
                          <div className={`rounded-2xl overflow-hidden bg-gradient-to-br from-white to-[#eef4ff] border border-[#cbd5e1]/40 shrink-0 relative ${
                            layoutMode === 'list' ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-full aspect-[4/3]'
                          }`}>
                            <img
                              src={getProductImages(p)[0]}
                              alt={getProductImageAlt(p)}
                              loading="lazy"
                              className="w-full h-full object-contain p-2.5 transition duration-500 group-hover:scale-[1.07] group-hover:brightness-105"
                            />
                            <div className="absolute inset-0 bg-[#00357f]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-[#00357f]/90 px-2.5 py-1 rounded shadow-sm">
                                Cotizar
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={`rounded-xl bg-[#f0f3ff] border border-[#cbd5e1]/40 shrink-0 flex items-center justify-center text-[#737784] relative ${
                            layoutMode === 'list' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-full h-32 sm:h-36'
                          }`}>
                            <Compass className="w-8 h-8 opacity-40 group-hover:scale-110 transition-transform" />
                          </div>
                        )}

                        <div className="space-y-1.5 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[8px] font-black uppercase text-[#00668a] tracking-wider">
                              {p.category === 'frames' && 'Armazón'}
                              {p.category === 'lenses' && 'Mica'}
                              {p.category === 'contact_lenses' && 'Contacto'}
                              {p.category === 'accessories' && 'Accesorio'}
                            </span>

                            <span className={`text-[8px] font-bold uppercase px-1 rounded ${
                              p.stock === 0 ? 'bg-[#ffdad6] text-[#ba1a1a]' :
                              p.stock < 5 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                              'bg-[#49da9f]/20 text-[#00422b]'
                            }`}>
                              {p.stock === 0 ? 'Agotado' : p.stock < 5 ? `Últimas ${p.stock}` : 'Disponible'}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm sm:text-xs text-[#111c2d] group-hover:text-[#00357f] transition-colors line-clamp-2 max-w-full leading-tight">
                            {p.name}
                          </h3>
                          {getProductDetails(p).brand && (
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#737784]">{getProductDetails(p).brand}</p>
                          )}

                          {layoutMode === 'grid' && (
                            <p className="text-[11px] sm:text-[10px] text-[#737784] line-clamp-2 leading-relaxed font-medium">
                              {getProductDescription(p) || 'Armazón oftálmico premium, compatible con graduación.'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Pricing & Call to Actions */}
                      <div className={`border-t border-[#cbd5e1]/30 pt-2.5 flex items-center justify-between gap-2 w-full ${
                        layoutMode === 'list' ? 'sm:border-t-0 sm:pt-0 sm:w-auto' : ''
                      }`}>
                        <div className={`min-w-0 ${layoutMode === 'list' ? 'sm:text-right' : ''}`}>
                          <p className="text-[8px] text-[#737784] uppercase tracking-widest font-bold">
                            {isClient && priceOf(p) < p.price ? 'Precio cliente' : 'Precio sugerido'}
                          </p>
                          <p className="font-black text-[#00357f] text-sm font-mono">{formatPrice(priceOf(p))}</p>
                          {isClient && priceOf(p) < p.price && (
                            <p className="text-[9px] text-[#737784] line-through font-mono">{formatPrice(p.price)}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(p); }}
                          className="flex min-h-10 items-center justify-center gap-1.5 bg-[#dee8ff] hover:bg-[#c9d8ff] text-[#00357f] font-bold text-[11px] px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      </div>

                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}

        </div>

      </div>

      {/* ========================================================
         MODAL: LENS WIZARD STEPPER CONFIGURATOR
         ======================================================== */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/35 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-white border border-[#cbd5e1] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[94dvh] sm:max-h-[90vh] relative"
            >
              {/* Close trigger */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 text-[#737784] hover:text-[#111c2d] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* LENS WIZARD HEADER */}
              <div className="space-y-1 text-left">
                <span className="text-[9px] font-black uppercase text-[#00357f] tracking-wider bg-[#dee8ff] px-2.5 py-0.5 rounded">
                  {selectedProduct.category === 'frames' ? 'Asistente de Cotización' : 'Detalles de Producto'}
                </span>
                <h3 className="text-lg font-black text-[#111c2d] mt-2 leading-tight pr-8">{selectedProduct.name}</h3>
              </div>

              {/* Product gallery inside the modal */}
              {getProductImages(selectedProduct).length > 0 && (selectedProduct.category !== 'frames' || wizardStep === 1) && (
                <div className="space-y-2">
                  <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#cbd5e1]/50 bg-gradient-to-br from-white to-[#eef4ff] p-3 shadow-inner">
                    <img
                      src={getProductImages(selectedProduct)[Math.min(selectedImageIndex, getProductImages(selectedProduct).length - 1)]}
                      alt={getProductImageAlt(selectedProduct)}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  {getProductImages(selectedProduct).length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Fotos del producto">
                      {getProductImages(selectedProduct).map((image, index) => (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          aria-label={`Ver foto ${index + 1} de ${selectedProduct.name}`}
                          aria-pressed={selectedImageIndex === index}
                          className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${selectedImageIndex === index ? 'border-[#00357f] ring-2 ring-[#00357f]/20' : 'border-[#cbd5e1] hover:border-[#00357f]/50'}`}
                        >
                          <img src={image} alt="" className="h-full w-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                  {(getProductDetails(selectedProduct).brand || getProductDetails(selectedProduct).material || getProductDetails(selectedProduct).color || getProductDetails(selectedProduct).sku) && (
                    <dl className="grid grid-cols-2 gap-2 text-left">
                      {getProductDetails(selectedProduct).brand && (
                        <div className="rounded-xl bg-[#f9f9ff] px-3 py-2"><dt className="text-[9px] font-black uppercase tracking-wider text-[#737784]">Marca</dt><dd className="text-xs font-bold text-[#111c2d]">{getProductDetails(selectedProduct).brand}</dd></div>
                      )}
                      {getProductDetails(selectedProduct).material && (
                        <div className="rounded-xl bg-[#f9f9ff] px-3 py-2"><dt className="text-[9px] font-black uppercase tracking-wider text-[#737784]">Material</dt><dd className="text-xs font-bold text-[#111c2d]">{getProductDetails(selectedProduct).material}</dd></div>
                      )}
                      {getProductDetails(selectedProduct).color && (
                        <div className="rounded-xl bg-[#f9f9ff] px-3 py-2"><dt className="text-[9px] font-black uppercase tracking-wider text-[#737784]">Color</dt><dd className="text-xs font-bold text-[#111c2d]">{getProductDetails(selectedProduct).color}</dd></div>
                      )}
                      {getProductDetails(selectedProduct).sku && (
                        <div className="rounded-xl bg-[#f9f9ff] px-3 py-2"><dt className="text-[9px] font-black uppercase tracking-wider text-[#737784]">SKU</dt><dd className="font-mono text-xs font-bold text-[#111c2d]">{getProductDetails(selectedProduct).sku}</dd></div>
                      )}
                    </dl>
                  )}
                </div>
              )}

              {/* CONDITIONAL WIZARD FLOW FOR FRAMES */}
              {selectedProduct.category === 'frames' ? (
                <div className="space-y-5 text-left border-t border-b border-[#f0f3ff] py-4">

                  {/* STEPPER PROGRESS INDICATOR */}
                  <div className="flex justify-between items-center px-4 bg-[#f0f3ff] py-2 border border-[#cbd5e1]/30 rounded-xl text-[9px] font-black uppercase tracking-wider text-[#737784]">
                    <span className={wizardStep === 1 ? 'text-[#00357f]' : 'text-emerald-600'}>1. Graduación</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 2 ? 'text-[#00357f]' : wizardStep > 2 ? 'text-emerald-600' : ''}>2. Filtros</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 3 ? 'text-[#00357f]' : ''}>3. Receta</span>
                  </div>

                  {/* STEP 1: GRADUATION SELECTION */}
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-[#434653] flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#00357f]" />
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
                            className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[44px] ${
                              selectedGraduation === opt.value
                                ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f]'
                                : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#f0f3ff]'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="text-[10px] text-[#00357f] shrink-0 font-mono">{opt.cost}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: TREATMENT FILTERS */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-[#434653] flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#00357f]" />
                        Paso 2: Tratamientos y Filtros Adicionales
                      </p>

                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'antireflective', label: 'Antirreflejante Crizal (Elimina destellos)', cost: '+$300 MXN' },
                          { value: 'blueblock', label: 'Blue Shield (Filtro para celular/pantalla)', cost: '+$500 MXN' },
                          { value: 'transitions', label: 'Transitions (Micas fotocromáticas)', cost: '+$1,200 MXN' }
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
                              className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[44px] ${
                                isSelected
                                  ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f]'
                                  : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#f0f3ff]'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className="text-[10px] text-[#00357f] shrink-0 font-mono">{opt.cost}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PRESCRIPTION METHOD */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-[#434653] flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#00357f]" />
                        Paso 3: Sube tu receta oftálmica
                      </p>

                      <div className="flex bg-[#f0f3ff] border border-[#cbd5e1] p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPrescriptionMode('upload')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                            prescriptionMode === 'upload' ? 'bg-white text-[#00357f] shadow-sm' : 'text-[#737784]'
                          }`}
                        >
                          Subir Receta
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrescriptionMode('manual')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                            prescriptionMode === 'manual' ? 'bg-white text-[#00357f] shadow-sm' : 'text-[#737784]'
                          }`}
                        >
                          Graduación Manual
                        </button>
                      </div>

                      {prescriptionMode === 'upload' ? (
                        <div className="border-2 border-dashed border-[#cbd5e1] hover:border-[#00357f] p-6 rounded-xl bg-[#f9f9ff] text-center transition-all relative">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFakeUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="space-y-2 flex flex-col items-center">
                            <Upload className="w-8 h-8 text-[#00357f]" />
                            {uploadedFileName ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                <CheckCircle className="w-4 h-4" />
                                <span>{uploadedFileName} cargada!</span>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-[#111c2d]">Arrastra tu receta o haz clic aquí</p>
                                <p className="text-[10px] text-[#737784]">Formatos PDF, JPG, PNG admitidos</p>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 bg-[#f9f9ff] p-4 border border-[#cbd5e1]/40 rounded-xl text-xs">
                          {/* Right eye */}
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-[#00357f]">Ojo Derecho (OD)</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Esf</label>
                                <input type="text" value={odSphere} onChange={e => setOdSphere(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Cil</label>
                                <input type="text" value={odCylinder} onChange={e => setOdCylinder(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Eje</label>
                                <input type="text" value={odAxis} onChange={e => setOdAxis(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                            </div>
                          </div>

                          {/* Left eye */}
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-[#00668a]">Ojo Izquierdo (OI)</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Esf</label>
                                <input type="text" value={oiSphere} onChange={e => setOiSphere(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Cil</label>
                                <input type="text" value={oiCylinder} onChange={e => setOiCylinder(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                              <div>
                                <label className="text-[8px] text-[#737784] font-bold block mb-1">Eje</label>
                                <input type="text" value={oiAxis} onChange={e => setOiAxis(e.target.value)} className="w-full bg-white border border-[#cbd5e1] rounded-lg p-1.5 text-center text-[#111c2d] focus:outline-none" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stepper Footer */}
                  <div className="flex justify-between items-center gap-3 pt-2">
                    {wizardStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setWizardStep((wizardStep - 1) as any)}
                        className="text-xs font-bold text-[#737784] hover:bg-[#dee8ff] px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Atrás
                      </button>
                    )}

                    {wizardStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => setWizardStep((wizardStep + 1) as any)}
                        className="ml-auto text-xs font-bold text-white bg-[#00357f] hover:bg-[#004aad] px-5 py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        Siguiente
                      </button>
                    ) : (
                      <span className="text-[9px] font-black text-emerald-600 ml-auto uppercase bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" /> Receta Configurada
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-left border-t border-b border-[#f0f3ff] py-4">
                  <p className="text-xs text-[#434653] leading-relaxed bg-[#f9f9ff] border border-[#cbd5e1]/40 p-4 rounded-xl font-medium">
                    {getProductDescription(selectedProduct) || 'Detalles del accesorio o producto clínico premium.'}
                  </p>
                </div>
              )}

              {/* LIVE PRICING CALCULATION PANEL */}
              <div className="flex justify-between items-center bg-[#f9f9ff] border border-[#cbd5e1]/45 p-4 rounded-xl text-left">
                <div>
                  <p className="text-[9px] text-[#737784] font-bold uppercase tracking-wider">
                    {selectedGraduation !== 'none' ? 'Total Configurado' : 'Precio Sugerido'}
                  </p>
                  <p className="text-xl font-black text-[#00357f] font-mono">
                    {formatPrice(selectedProduct.category === 'frames' ? totalConfiguredPrice : priceOf(selectedProduct))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-[#737784] font-bold uppercase tracking-wider">Garantía Óptica</p>
                  <p className="text-xs text-[#111c2d] font-bold">1 Año Rayo Care</p>
                </div>
              </div>

              {/* Final Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="min-h-12 flex-1 text-xs font-bold text-[#737784] hover:bg-[#dee8ff] py-3 rounded-xl border border-[#cbd5e1] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  Cerrar
                </button>
                <a
                  href={getWhatsAppLink(selectedProduct)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-12 flex-1 flex items-center justify-center gap-2 bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113] font-bold text-xs py-3 rounded-xl shadow-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <Phone className="w-4 h-4 text-[#002113] shrink-0" />
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
      <div className="min-h-screen bg-[#f9f9ff] text-[#111c2d] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
        <p className="text-xs text-[#737784] font-black">Cargando catálogo...</p>
      </div>
    }>
      <CatalogContent />
    </Suspense>
  )
}
