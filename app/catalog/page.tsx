'use client'

import { useEffect, useState, useMemo, useRef, useLayoutEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { getProducts, saveProductsOrder, getWishlist, toggleWishlistItem, getMemberDiscountPercent, createLensRequest, getAppSetting, getMessageTemplate } from '@/lib/services'
import { isAdminRole } from '@/lib/roles'
import {
  CATALOG_INQUIRY_TEMPLATE_KEY,
  DEFAULT_CATALOG_INQUIRY_TEMPLATE,
  buildCatalogInquiryMessage,
} from '@/lib/message-templates'
import { getProductLensOptions } from '@/lib/product-lens-options'
import FaceScanner from '@/components/face-scanner'
import type { FaceShape } from '@/lib/face-shape'
import { uploadPrescriptionFile, attachPrescriptionToRequest, validatePrescriptionFile } from '@/lib/catalog-data'
import { effectiveClientPrice } from '@/lib/pricing'
import { getProductDescription, getProductDetails, getProductImageAlt, getProductImages } from '@/lib/product-data'
import { getProfileData, getMyMemberDiscountPercent } from '@/app/auth/actions'
import { Database } from '@/types/database.types'
import useEmblaCarousel from 'embla-carousel-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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
  Heart,
  Eye,
  Activity,
  Layers,
  FileText,
  Upload,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Glasses,
  LayoutGrid,
  GripVertical,
  ScanFace
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

interface ProfileData {
  id: string
  username: string
  fullName: string
  role: string
  email: string
}

// Llave de sessionStorage del aviso emergente de descuento: si el
// visitante lo cierra, no vuelve a salir en la misma sesión.
const MEMBER_POPUP_KEY = 'optica-rayo:member-popup-dismissed'

// Llave de sessionStorage de la tarjeta de ayuda del escáner: si el
// visitante la quita con su X, no vuelve a salir en la misma sesión
// (el acceso al escáner queda en el rostrito junto al buscador).
const HELP_CARD_KEY = 'optica-rayo:scanner-help-dismissed'

function CatalogContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldReduceMotion = useReducedMotion()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  // Face scanner (dictado del dueño 2026-11-18): ayuda junto a la
  // búsqueda que detecta la forma del rostro EN el teléfono del
  // cliente y sugiere armazones del catálogo.
  const [scannerOpen, setScannerOpen] = useState(false)
  // Forma recordada del escáner: si el cliente entra al detalle de un
  // armazón recomendado y lo cierra, vuelve al RESULTADO del escáner
  // (corrección del dueño 2026-11-18: el escáner no debe expulsarlo
  // al catálogo). Solo se abandona con la X del escáner o con «Ver
  // todos los armazones», que limpian esta memoria.
  const [scannerShape, setScannerShape] = useState<FaceShape | null>(null)
  const detailFromScannerRef = useRef(false)
  // Aviso emergente «¿Ya eres cliente?» (corrección 5 del dueño
  // 2026-11-18): ya no vive en el flujo de la página; flota arriba
  // solo para invitados y se controla con este estado.
  const [memberPopupVisible, setMemberPopupVisible] = useState(false)
  // Tarjeta de ayuda del escáner descartable (corrección 6 del dueño
  // 2026-11-18): nace visible; su X la quita por el resto de la
  // sesión. El estado inicial se lee de sessionStorage al montar.
  const [helpCardDismissed, setHelpCardDismissed] = useState(false)
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
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', duration: 30 })
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false)
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  // Fetch URL Parameters (Shallow Routing values)
  const categoryFilter = searchParams.get('category') || 'all'
  const selectedCategories = useMemo(() => {
    if (categoryFilter === 'all') return [] as string[]
    return categoryFilter.split(',').map(c => c.trim()).filter(c => c !== '' && c !== 'all')
  }, [categoryFilter])
  const maxPriceFilter = parseInt(searchParams.get('price') || '10000')
  const searchTerm = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'recommended'
  const onlyPromoFilter = searchParams.get('promo') === 'true'
  // Marca: MULTISELECCIÓN real (corrección del dueño 2026-11-18: el
  // renglón de pastillas de marcas hacía la barra enorme y «tosca»).
  // La URL lleva ?brand=A,B; un enlace viejo con una sola marca
  // (?brand=A) sigue funcionando porque parsea igual.
  const selectedBrands = useMemo(() => {
    const raw = searchParams.get('brand')
    if (!raw) return [] as string[]
    return raw.split(',').map(b => b.trim()).filter(Boolean)
  }, [searchParams])
  const layoutMode = (searchParams.get('layout') as 'grid' | 'list') || 'grid'
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  // Lens Wizard Stepper state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [prescriptionMode, setPrescriptionMode] = useState<'upload' | 'manual'>('upload')

  // Per-product lens options (the owner's model): each frame carries its
  // OWN vision options (single choice) and extras (multiple), seeded from
  // the admin-editable template but independent per product.
  const [productOptions, setProductOptions] = useState<{ vision: any[]; extra: any[] }>({ vision: [], extra: [] })
  const [selectedVisionId, setSelectedVisionId] = useState<string>('')
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])

  // Real prescription file, held until the request is sent (uploaded to
  // the private 'prescriptions' bucket at submit time).
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string>('')

  // Real request submission status (no fake success anywhere).
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [requestNote, setRequestNote] = useState<string>('')

  // Business WhatsApp number from app_settings ('business_whatsapp').
  // Empty string = not configured = every WhatsApp button stays hidden.
  const [businessWhatsapp, setBusinessWhatsapp] = useState<string>('')

  // Inquiry message template from app_settings ('catalog_inquiry_template',
  // edited in Configuración → Mensajes); the built-in default is the text
  // the catalog always used, and it stands until the saved one loads.
  const [catalogTemplate, setCatalogTemplate] = useState<string>(DEFAULT_CATALOG_INQUIRY_TEMPLATE)

  // Units sold per product, from the public aggregate view
  // product_sales_ranking (product + units of REAL sales only, quotes
  // excluded; the view exposes no sales detail, so it is readable by
  // everyone — guests included — and the carousel ranking is the
  // store's true ranking for every visitor). Any read failure leaves
  // the map empty and the carousel on its featured fallback.
  const [soldUnits, setSoldUnits] = useState<Record<string, number>>({})

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

        // Business WhatsApp from editable settings; keep digits only.
        const wa = await getAppSetting('business_whatsapp')
        setBusinessWhatsapp((wa || '').replace(/\D/g, ''))

        // Inquiry message template from the same editable settings.
        const inquiryTemplate = await getMessageTemplate(CATALOG_INQUIRY_TEMPLATE_KEY)
        setCatalogTemplate(inquiryTemplate)

        // Try to fetch profile
        try {
          const profile = await getProfileData()
          if (profile) {
            setUserProfile(profile)
            // Cliente conectado: su % efectivo lo calcula el SERVIDOR
            // (acción getMyMemberDiscountPercent): el general más el
            // extra si es su mes de cumpleaños, leído de SU fecha de
            // nacimiento — la fecha nunca viaja al navegador.
            if (profile.role === 'customer') {
              try {
                setMemberPct(await getMyMemberDiscountPercent())
              } catch (_) {
                // Se queda el % general ya cargado.
              }
            }
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

  // Best sellers aggregate: read the public view (see soldUnits note).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('product_sales_ranking')
          .select('product_id, units_sold')
        if (error || !data) return
        const units: Record<string, number> = {}
        for (const row of data as any[]) {
          if (!row.product_id) continue
          units[row.product_id] = Number(row.units_sold) || 0
        }
        if (!cancelled) setSoldUnits(units)
      } catch (e) {
        console.error('Error loading best sellers:', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Aviso emergente de descuento (corrección 5 del dueño 2026-11-18):
  // aparece al abrir el catálogo, flotando arriba, SOLO para
  // invitados — sin sesión. El cliente ya ve sus precios (y su banda
  // verde en el flujo) y al personal no se le muestra. Si el
  // visitante lo cierra con la X, no vuelve a salir en la misma
  // sesión (sessionStorage); en una visita nueva puede salir otra
  // vez. El texto del descuento es fijo por dictado del dueño
  // («15% o más»); la lógica real de precios no cambia.
  useEffect(() => {
    if (loading || userProfile || memberPct <= 0) return
    let dismissed = false
    try {
      dismissed = window.sessionStorage.getItem(MEMBER_POPUP_KEY) === '1'
    } catch {
      // Almacenamiento no disponible: el aviso se muestra igual.
    }
    if (dismissed) return
    const t = window.setTimeout(() => setMemberPopupVisible(true), 600)
    return () => window.clearTimeout(t)
  }, [loading, userProfile, memberPct])

  const dismissMemberPopup = () => {
    setMemberPopupVisible(false)
    try {
      window.sessionStorage.setItem(MEMBER_POPUP_KEY, '1')
    } catch {
      // Sin almacenamiento, el aviso simplemente se oculta esta vez.
    }
  }

  // La tarjeta de ayuda del escáner recuerda su descarte por sesión.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(HELP_CARD_KEY) === '1') {
        setHelpCardDismissed(true)
      }
    } catch {
      // Sin almacenamiento, la tarjeta se muestra como siempre.
    }
  }, [])

  const dismissHelpCard = () => {
    setHelpCardDismissed(true)
    try {
      window.sessionStorage.setItem(HELP_CARD_KEY, '1')
    } catch {
      // Sin almacenamiento, la tarjeta simplemente se oculta esta vez.
    }
  }

  // Categories definitions
  const categories = [
    { value: 'all', label: 'Todos', icon: LayoutGrid },
    { value: 'frames', label: 'Armazones', icon: Glasses },
    { value: 'lenses', label: 'Micas', icon: Layers },
    { value: 'contact_lenses', label: 'Lentes de Contacto', icon: Eye },
    { value: 'accessories', label: 'Accesorios', icon: Sparkles }
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

  // Brand filter options: the REAL brands present in the loaded
  // products (details.brand), with their product count, ordered by
  // count desc and then A–Z. Products without a captured brand never
  // invent one — they simply don't contribute an option.
  const brandOptions = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach(p => {
      const brand = (getProductDetails(p).brand || '').trim()
      if (!brand) return
      counts.set(brand, (counts.get(brand) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
  }, [products])

  // Filter products for the Hero Carousel (Promos or Featured with images)
  const promoProducts = useMemo(() => {
    return products.filter(p => (p.is_promo || p.is_featured) && getProductImages(p).length > 0)
  }, [products])

  // How many catalog products have real sales behind them.
  const bestSellerCount = useMemo(() => {
    return products.filter(p => (soldUnits[p.id] || 0) > 0).length
  }, [products, soldUnits])

  // Carousel content: «Más vendidos» first — products WITH real sales,
  // ordered by units sold (ties broken by name so the order is stable).
  // Products without sales never enter on their own; only when fewer
  // than 3 products have sales does the featured selection fill the
  // remaining slots, so the carousel is never born empty.
  const carouselProducts = useMemo(() => {
    const sold = products
      .filter(p => (soldUnits[p.id] || 0) > 0)
      .sort((a, b) => (soldUnits[b.id] - soldUnits[a.id]) || a.name.localeCompare(b.name))
    if (sold.length >= 3) return sold.slice(0, 10)
    const soldIds = new Set(sold.map(p => p.id))
    const fill = promoProducts.filter(p => !soldIds.has(p.id))
    return [...sold, ...fill].slice(0, 10)
  }, [products, soldUnits, promoProducts])

  const hasBestSellers = bestSellerCount > 0

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
  }, [emblaApi, carouselProducts])

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

  // Marca multiselección (diseño final del dueño 2026-11-18): vive
  // en la tarjeta «Filtros y Búsqueda Avanzada» y aplica al toque,
  // igual que las categorías. La URL lleva ?brand=A,B (unión); un
  // enlace con una sola marca sigue funcionando.
  const toggleBrandFilter = (brand: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const current = (params.get('brand')?.split(',') || [])
      .map(b => b.trim())
      .filter(Boolean)
    const next = current.includes(brand)
      ? current.filter(b => b !== brand)
      : [...current, brand]
    if (next.length === 0) {
      params.delete('brand')
    } else {
      params.set('brand', next.join(','))
    }
    router.replace(`/catalog?${params.toString()}`, { scroll: false })
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

  // Marca real de un producto ('' si no tiene capturada).
  const brandOf = (p: Product) => (getProductDetails(p).brand || '').trim()

  // Filtrado completo para una combinación dada de categorías y
  // marcas (unión DENTRO de cada grupo, AND entre grupos, como
  // siempre).
  const applyFilters = (cats: string[], brands: string[]) => {
    let result = [...products]

    if (cats.length > 0) {
      result = result.filter(p => cats.includes(p.category))
    }
    if (brands.length > 0) {
      result = result.filter(p => brands.includes(brandOf(p)))
    }

    result = result.filter(p => p.price <= maxPriceFilter)

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase()
      result = result.filter(p => {
        const details = getProductDetails(p)
        return [p.name, details.brand, details.material, details.sku, details.color, details.notes]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(q))
      })
    }

    if (onlyPromoFilter) {
      result = result.filter(p => p.is_promo)
    }

    if (faceShapeFilter !== 'all') {
      result = result.filter(p => isFaceShapeCompatible(p, faceShapeFilter))
    }

    return result
  }

  // Filtered and sorted products
  const processedProducts = useMemo(() => {
    const result = applyFilters(selectedCategories, selectedBrands)

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, selectedCategories, selectedBrands, maxPriceFilter, searchTerm, onlyPromoFilter, faceShapeFilter, sortBy])



  // ——— Reordenar arrastrando (solo administrador, dictado del dueño
  // 2026-11-18) ———
  // El admin/superadmin arrastra las tarjetas desde un asa (pointer
  // events: sirve con dedo y con ratón) y el orden se guarda en
  // products.display_order vía saveProductsOrder; ese orden es el que
  // ven los clientes. Para clientes y público no cambia NADA: sin
  // asas, sin comportamiento nuevo, solo el orden guardado aplicado
  // por getProducts.
  const isAdmin = !!userProfile && isAdminRole(userProfile.role)

  // El arrastre solo tiene sentido sobre la lista COMPLETA y en el
  // orden guardado: con un filtro activo (o un ordenamiento de vista)
  // la vista es parcial y reordenarla corrompería el orden global.
  const hasActiveViewFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    searchTerm.trim() !== '' ||
    faceShapeFilter !== 'all' ||
    onlyPromoFilter ||
    searchParams.get('price') !== null ||
    sortBy !== 'recommended'
  const canReorder = isAdmin && !hasActiveViewFilters && !loading && processedProducts.length > 1

  // Orden local mientras el admin acomoda: los ids en el orden
  // deseado. Vive solo en esta pantalla; al soltar se persiste y, si
  // el guardado falla, se revierte a la foto previa al arrastre.
  const [arrangedIds, setArrangedIds] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderNotice, setOrderNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const noticeTimerRef = useRef<number | null>(null)
  // Tras un arrastre real, el clic sintético que cierra el gesto NO
  // debe abrir el detalle del producto.
  const suppressClickRef = useRef(false)

  interface DragSession {
    id: string
    order: string[]
    snapshot: string[]
    startX: number
    startY: number
    lastX: number
    lastY: number
    baseX: number
    baseY: number
    moved: boolean
    visualRect: DOMRect | null
  }
  const dragRef = useRef<DragSession | null>(null)

  // Si el catálogo se recarga, el orden local deja de representar a
  // los datos y se descarta.
  useEffect(() => {
    setArrangedIds(null)
  }, [products])

  const gridProducts = useMemo(() => {
    if (!arrangedIds) return processedProducts
    const position = new Map(arrangedIds.map((id, i) => [id, i]))
    return [...processedProducts].sort(
      (a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
  }, [processedProducts, arrangedIds])

  const showOrderNotice = (kind: 'ok' | 'error', text: string) => {
    setOrderNotice({ kind, text })
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setOrderNotice(null), 3400)
  }

  // Al reordenar a mitad de arrastre, la tarjeta arrastrada cambia de
  // celda y su posición visual saltaría: se compensa el salto en la
  // base del translate para que siga pegada al dedo/ratón.
  useLayoutEffect(() => {
    const session = dragRef.current
    if (!session || !session.visualRect) return
    const el = cardRefs.current.get(session.id)
    if (!el) return
    const now = el.getBoundingClientRect()
    const jumpX = now.left - session.visualRect.left
    const jumpY = now.top - session.visualRect.top
    session.visualRect = null
    if (jumpX !== 0 || jumpY !== 0) {
      session.baseX -= jumpX
      session.baseY -= jumpY
      el.style.transform = `translate(${session.baseX + session.lastX - session.startX}px, ${session.baseY + session.lastY - session.startY}px) scale(1.03)`
    }
  }, [arrangedIds])

  const startDrag = (e: React.PointerEvent, product: Product) => {
    if (!canReorder || savingOrder) return
    const el = cardRefs.current.get(product.id)
    if (!el) return
    e.preventDefault()
    e.stopPropagation()

    const initialOrder = gridProducts.map(p => p.id)
    const session: DragSession = {
      id: product.id,
      order: initialOrder,
      snapshot: initialOrder,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      baseX: 0,
      baseY: 0,
      moved: false,
      visualRect: null,
    }
    dragRef.current = session
    setDraggingId(product.id)
    el.style.transform = 'translate(0px, 0px) scale(1.03)'

    const onMove = (ev: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      const node = cardRefs.current.get(s.id)
      if (!node) return
      const dx = ev.clientX - s.startX
      const dy = ev.clientY - s.startY
      if (Math.abs(dx) + Math.abs(dy) > 4) s.moved = true
      s.lastX = ev.clientX
      s.lastY = ev.clientY
      node.style.transform = `translate(${s.baseX + dx}px, ${s.baseY + dy}px) scale(1.03)`
      // ¿El puntero entró a otra tarjeta? Esa es la nueva posición:
      // se intercambia en el orden local y el efecto de layout
      // compensa el salto de celda de la tarjeta arrastrada.
      const from = s.order.indexOf(s.id)
      let to = -1
      for (const [pid, sibling] of cardRefs.current) {
        if (pid === s.id) continue
        const r = sibling.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          to = s.order.indexOf(pid)
          break
        }
      }
      if (to >= 0 && to !== from) {
        const next = [...s.order]
        next.splice(from, 1)
        next.splice(to, 0, s.id)
        s.order = next
        s.visualRect = node.getBoundingClientRect()
        setArrangedIds(next)
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }

    const onUp = () => {
      cleanup()
      const s = dragRef.current
      dragRef.current = null
      setDraggingId(null)
      if (!s) return
      const node = cardRefs.current.get(s.id)
      if (node) node.style.transform = ''
      if (!s.moved) return
      // El clic sintético del gesto no debe abrir el detalle; la
      // bandera se consume en el primer clic o caduca sola.
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 350)
      if (s.order.join('|') === s.snapshot.join('|')) return
      // Guardado GLOBAL: los productos fuera de esta vista (p. ej.
      // sobre el tope de precio por defecto) conservan sus lugares;
      // los visibles ocupan las mismas posiciones, ya reordenados.
      const visible = new Set(s.order)
      const merged = products.map(p => p.id)
      const slots = merged.map((id, i) => (visible.has(id) ? i : -1)).filter(i => i >= 0)
      slots.forEach((slot, i) => {
        merged[slot] = s.order[i]
      })
      setSavingOrder(true)
      saveProductsOrder(merged)
        .then(() => showOrderNotice('ok', 'Orden guardado'))
        .catch((err: any) => {
          setArrangedIds(s.snapshot)
          showOrderNotice('error', err?.message || 'No se pudo guardar el orden. Se restauró el anterior.')
        })
        .finally(() => setSavingOrder(false))
    }

    const onCancel = () => {
      cleanup()
      const s = dragRef.current
      dragRef.current = null
      setDraggingId(null)
      if (!s) return
      const node = cardRefs.current.get(s.id)
      if (node) node.style.transform = ''
      setArrangedIds(s.snapshot)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  // Clic de tarjeta: tras un arrastre, el primer clic es el cierre
  // del gesto y se traga; los demás abren el detalle como siempre.
  const handleCardClick = (p: Product) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    handleOpenDetailModal(p)
  }

  // Lens Wizard pricing: frame (with member pricing) + THIS PRODUCT's
  // vision option + the sum of its chosen extras. The options live on the
  // product (product_lens_options); no global list and no constants.
  const selectedVision = productOptions.vision.find(v => v.id === selectedVisionId) || null
  const visionPrice = selectedVision ? Number(selectedVision.price_delta) || 0 : 0
  const selectedExtras = productOptions.extra.filter(x => selectedExtraIds.includes(x.id))
  const extrasPrice = selectedExtras.reduce((sum, x) => sum + (Number(x.price_delta) || 0), 0)

  const totalConfiguredPrice = selectedProduct
    ? priceOf(selectedProduct) + visionPrice + extrasPrice
    : 0

  // "Has graduation" = a vision option beyond the base (first) one is
  // chosen — it gates the prescription step's wording and notes.
  const hasGraduation = selectedVision
    ? productOptions.vision.indexOf(selectedVision) > 0
    : false

  // Load the opened frame's own lens options; preselect its base vision
  // option and clear extras. A read failure leaves both groups empty and
  // the wizard says so — nothing is invented.
  useEffect(() => {
    if (!selectedProduct || selectedProduct.category !== 'frames') return
    let cancelled = false
    getProductLensOptions(selectedProduct.id)
      .then(opts => {
        if (cancelled) return
        setProductOptions(opts)
        setSelectedVisionId(opts.vision.length > 0 ? opts.vision[0].id : '')
        setSelectedExtraIds([])
      })
      .catch(err => {
        console.error('Error loading lens options:', err)
        if (!cancelled) setProductOptions({ vision: [], extra: [] })
      })
    return () => { cancelled = true }
  }, [selectedProduct])

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

  // WhatsApp deep link: built ONLY when the business number is configured
  // in app_settings ('business_whatsapp'). Returns null when it is not, and
  // every WhatsApp button then stays hidden — no placeholder number exists
  // anywhere in the catalog anymore.
  const getWhatsAppLink = (product: Product): string | null => {
    if (!businessWhatsapp) return null

    // The graduation/extras segment: it becomes the {detalle} of the
    // editable inquiry template (empty when nothing was configured).
    let textGraduation = ''

    if (product.category === 'frames' && hasGraduation && selectedVision) {
      textGraduation = `Deseo cotizarlo con la opción: ${selectedVision.name}. `
      if (selectedExtras.length > 0) {
        textGraduation += `Extras solicitados: ${selectedExtras.map(x => x.name).join(', ')}. `
      }
      if (prescriptionMode === 'manual') {
        textGraduation += `Graduación Manual: [OD: Esf ${odSphere}, Cil ${odCylinder}, Eje ${odAxis}] [OI: Esf ${oiSphere}, Cil ${oiCylinder}, Eje ${oiAxis}]. `
      } else if (prescriptionFile) {
        // Truthful wording: the file exists on the customer's phone and can
        // be shared inside the chat — it was NOT uploaded anywhere yet.
        textGraduation += 'Tengo mi receta en archivo (foto/PDF) lista para compartirla por aquí. '
      }
    }

    const fullMsg = buildCatalogInquiryMessage(catalogTemplate, {
      producto: product.name,
      referencia: product.id.slice(0, 5).toUpperCase(),
      detalle: textGraduation,
    })
    return `https://wa.me/${businessWhatsapp}?text=${encodeURIComponent(fullMsg)}`
  }

  // Real prescription picker: validates type/size up front and keeps the
  // File so it can be uploaded to the private bucket when sending.
  const handlePrescriptionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null
    if (!file) return
    const error = validatePrescriptionFile(file)
    if (error) {
      setPrescriptionFile(null)
      setUploadError(error)
      e.target.value = ''
      return
    }
    setUploadError('')
    setPrescriptionFile(file)
  }

  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product)
    setSelectedImageIndex(0)
    setWizardStep(1)
    setSelectedVisionId('')
    setSelectedExtraIds([])
    setPrescriptionFile(null)
    setPrescriptionMode('upload')
    setUploadError('')
    setRequestStatus('idle')
    setRequestNote('')
  }

  const handleCloseModal = () => {
    setSelectedProduct(null)
    setRequestStatus('idle')
    setRequestNote('')
    // Si el detalle se abrió DESDE el resultado del escáner, al
    // cerrarlo el cliente vuelve a ese resultado (con su forma y sus
    // recomendados), las veces que entre y salga de productos. La
    // memoria (scannerShape) se conserva; solo la X del escáner o
    // «Ver todos los armazones» abandonan el flujo.
    if (detailFromScannerRef.current) {
      detailFromScannerRef.current = false
      setScannerOpen(true)
    }
  }

  // REAL submit: creates the lens request in the DB via createLensRequest
  // (frame + material + treatments + notes with graduation, manual Rx and
  // configured total) and, when the customer attached a prescription file,
  // uploads it to the private 'prescriptions' bucket and links its path
  // onto the request row. Any failure is reported as a failure.
  const handleSendRequest = async () => {
    if (!selectedProduct || !userProfile || requestStatus === 'sending') return
    setRequestStatus('sending')
    setRequestNote('')
    try {
      const notesParts: string[] = []
      // Snapshot of the chosen per-product options (names + prices as
      // chosen): options are editable later, the quote must not change.
      if (selectedVision) {
        notesParts.push(`Opción de lente: ${selectedVision.name} (+${formatPrice(visionPrice)})`)
        if (hasGraduation && prescriptionMode === 'manual') {
          notesParts.push(`Receta manual — OD: Esf ${odSphere}, Cil ${odCylinder}, Eje ${odAxis} · OI: Esf ${oiSphere}, Cil ${oiCylinder}, Eje ${oiAxis}`)
        }
      }
      if (selectedExtras.length > 0) {
        notesParts.push(`Extras: ${selectedExtras.map(x => `${x.name} (+${formatPrice(Number(x.price_delta) || 0)})`).join(', ')}`)
      }
      notesParts.push(`Total configurado: ${formatPrice(totalConfiguredPrice)} MXN`)

      const created = await createLensRequest({
        frameId: selectedProduct.id,
        lensMaterialId: undefined,
        treatmentIds: [],
        notes: notesParts.join(' · ')
      })

      // createLensRequest falls back to an in-memory mock (id "req_...") when
      // the DB write cannot be completed — never show that as a sent request.
      if (!created || !created.id || String(created.id).startsWith('req_')) {
        throw new Error('La solicitud no se pudo guardar en el sistema. Inténtalo de nuevo.')
      }

      if (prescriptionMode === 'upload' && prescriptionFile) {
        try {
          const path = await uploadPrescriptionFile(userProfile.id, prescriptionFile)
          await attachPrescriptionToRequest(created.id, path)
        } catch (fileErr) {
          // Honest partial success: the request IS saved; only the file failed.
          setRequestStatus('sent')
          setRequestNote('Tu solicitud quedó registrada, pero tu receta no se pudo subir. Compártela por WhatsApp o llévala a sucursal.')
          return
        }
      }

      setRequestStatus('sent')
    } catch (err: any) {
      setRequestStatus('error')
      setRequestNote(err?.message || 'No se pudo enviar la solicitud. Inténtalo de nuevo.')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // ——— Compact card system (redesign 2026-11-18) ———
  // ONE badge per card, by priority: Agotado (state) → Promo → Más
  // vendido (real sales ranking) → Nuevo (featured) → Quedan N (stock
  // 1–3). No pulsing, no invented data (no stars, no reviews).
  const getCardBadge = (p: Product): { label: string; className: string } | null => {
    if (p.stock === 0) return { label: 'Agotado', className: 'bg-[#ffdad6] text-[#ba1a1a]' }
    if (p.is_promo) return { label: 'Promo', className: 'bg-[#e2f9ee] text-[#00422b]' }
    if ((soldUnits[p.id] || 0) > 0) return { label: 'Más vendido', className: 'bg-[#fef3c7] text-[#92400e]' }
    if (p.is_featured) return { label: 'Nuevo', className: 'bg-[#dee8ff] text-[#00357f]' }
    if (p.stock >= 1 && p.stock <= 3) return { label: `Quedan ${p.stock}`, className: 'bg-[#ffdad6] text-[#ba1a1a]' }
    return null
  }

  const renderBadge = (p: Product, compact = false) => {
    const badge = getCardBadge(p)
    if (!badge) return null
    return (
      <span className={`absolute ${compact ? 'left-1 top-1 px-1.5' : 'left-2 top-2 px-2'} z-20 flex h-5 items-center rounded-full text-[10px] font-semibold ${badge.className}`}>
        {badge.label}
      </span>
    )
  }

  // The compact card face shared by the grid and the «Más vendidos»
  // carousel: floating photo on a flat field (no inner border, no
  // gradient), brand eyebrow ABOVE the name, name 13px, color·material
  // 11px, price 16px as the protagonist. No «Ver» button — the whole
  // card is the action. Built with spans so it is valid inside both a
  // <div> (grid) and a <button> (carousel). `overlay` lets the grid
  // float its wishlist heart over the photo.
  const renderCardFace = (p: Product, overlay?: React.ReactNode) => {
    const details = getProductDetails(p)
    const images = getProductImages(p)
    const soldOut = p.stock === 0
    const colorMaterial = [details.color, details.material].filter(Boolean).join(' · ')
    const discounted = isClient && priceOf(p) < p.price
    return (
      <>
        <span className="relative block aspect-[3/2] w-full shrink-0 overflow-hidden rounded-[14px] bg-[#f8faff]">
          {images.length > 0 ? (
            <img
              src={images[0]}
              alt={getProductImageAlt(p)}
              loading="lazy"
              className={`h-full w-full object-contain p-3 transition duration-[250ms] ease-out group-hover:scale-[1.05] group-active:scale-[1.03] ${soldOut ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <span className={`flex h-full w-full items-center justify-center text-[#00357f]/30 ${soldOut ? 'opacity-60 grayscale' : ''}`}>
              <Eye className="h-9 w-9 stroke-[1.5]" />
            </span>
          )}
          {renderBadge(p)}
          {overlay}
          <span className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 translate-y-1 rounded-full bg-[#00357f]/90 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
            Cotizar
          </span>
        </span>
        <span className="block min-w-0 flex-1 px-0.5 pt-2.5">
          {details.brand && (
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[#00509e] transition-colors group-hover:text-[#00357f]">
              {details.brand}
            </span>
          )}
          <span className="mt-0.5 block text-[13px] leading-[1.25] font-semibold text-[#111c2d] line-clamp-2 transition-colors group-hover:text-[#00357f] sm:text-sm">
            {p.name}
          </span>
          {colorMaterial && (
            <span className="mt-0.5 block truncate text-[11px] text-[#5d606f]">{colorMaterial}</span>
          )}
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-base font-extrabold text-[#00357f] tabular-nums">{formatPrice(priceOf(p))}</span>
            {discounted && (
              <>
                <span className="text-[11px] text-[#737784] line-through tabular-nums">{formatPrice(p.price)}</span>
                <span className="rounded-full bg-[#e2f9ee] px-1.5 py-px text-[10px] font-semibold text-[#00422b]">
                  -{Math.round((1 - priceOf(p) / p.price) * 100)}%
                </span>
              </>
            )}
          </span>
        </span>
      </>
    )
  }

  // Removable chips for every active filter (Baymard pattern): the
  // visitor always sees WHAT is filtering the grid and can undo each
  // filter in place.
  const categoryLabel = (value: string) => categories.find(c => c.value === value)?.label || value
  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (searchTerm.trim() !== '') {
    activeChips.push({ key: 'search', label: `Búsqueda: «${searchTerm.trim()}»`, clear: () => updateFilter('search', null) })
  }
  selectedCategories.forEach(c => {
    activeChips.push({ key: `cat-${c}`, label: categoryLabel(c), clear: () => toggleCategoryFilter(c) })
  })
  selectedBrands.forEach(b => {
    activeChips.push({
      key: `brand-${b}`,
      label: `Marca: ${b}`,
      clear: () => {
        const rest = selectedBrands.filter(x => x !== b)
        updateFilter('brand', rest.length > 0 ? rest.join(',') : null)
      },
    })
  })
  if (faceShapeFilter !== 'all') {
    const shapeLabel = faceShapes.find(s => s.value === faceShapeFilter)?.label || faceShapeFilter
    activeChips.push({ key: 'face', label: `Rostro: ${shapeLabel}`, clear: () => updateFilter('faceShape', null) })
  }
  if (searchParams.get('price')) {
    activeChips.push({ key: 'price', label: `Hasta ${formatPrice(maxPriceFilter)}`, clear: () => updateFilter('price', null) })
  }
  if (onlyPromoFilter) {
    activeChips.push({ key: 'promo', label: 'Solo promociones', clear: () => updateFilter('promo', null) })
  }

  return (
    <main className="min-h-screen text-[#111c2d] px-4 pt-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-[1280px] mx-auto pb-24 md:pb-8 text-left">
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

      {/* Brand strip: SOLO la pastilla, centrada y parpadeante
          (dictado del dueño 2026-11-18: fuera el titular «Ve el mundo
          con claridad», el subtítulo y las pastillas de cifras — la
          banda se compacta a lo que ocupa la pastilla). */}
      <section className="anim-fade-up relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#00357f] via-[#00509e] to-[#00668a] px-4 py-2.5 shadow-[0_16px_36px_-16px_rgba(0,53,127,0.45)] sm:px-6 md:py-4">
        {/* Decorative light glows */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 hidden md:block w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 hidden md:block w-64 h-64 rounded-full bg-[#49da9f]/20 blur-3xl" />

        <div className="relative flex justify-center">
          <p className="anim-blink-pill inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-[11px] font-bold text-white md:text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Óptica Rayo · Catálogo en línea
          </p>
        </div>
      </section>

      {/* Search: THE search field of the page (single-search rule),
          immediately under the hero band and before every filter
          (dictado del dueño 2026-11-18: que no haya que bajar a
          buscarlo). It drives the `search` filter on its own. */}
      <div className="relative z-10 flex items-center gap-2 px-1">
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#00357f]/50 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder="Buscar lentes, marcas…"
            aria-label="Buscar en el catálogo"
            className="w-full rounded-2xl border border-[#cbd5e1]/70 bg-white text-[#111c2d] placeholder-[#737784] text-sm font-medium pl-12 pr-4 py-2.5 sm:py-3.5 shadow-[0_16px_36px_-16px_rgba(0,53,127,0.35)] outline-none focus:border-[#00357f]/40 focus:ring-4 focus:ring-[#00357f]/15 transition min-h-[44px] sm:min-h-[52px]"
          />
        </div>
        {/* Rostrito del escáner (corrección 6 del dueño 2026-11-18):
            acceso permanente y compacto al escáner en la MISMA línea
            del buscador, se haya quitado la tarjeta de ayuda o no. */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label="Descubrir mi forma de rostro"
          title="Descubrir mi forma de rostro"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#00357f] text-white shadow-md shadow-[#00357f]/25 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
        >
          <ScanFace className="h-5 w-5" />
        </button>
      </div>

      {/* Face-shape help card (dictado del dueño 2026-11-18): junto a
          la búsqueda, ofrece el escáner de rostro. El análisis ocurre
          en el teléfono del cliente; ninguna foto se sube ni se
          guarda (el aviso va también dentro del escáner). */}
      {!helpCardDismissed && (
      <section className="anim-fade-up or-shadow-card relative flex flex-col gap-3 rounded-[20px] bg-white p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5" aria-label="Ayuda para elegir lentes">
        {/* X para quitar la tarjeta (corrección 6 del dueño
            2026-11-18): al cerrarla no vuelve en la misma sesión y
            el escáner queda en el rostrito junto al buscador. */}
        <button
          type="button"
          onClick={dismissHelpCard}
          aria-label="Quitar esta ayuda"
          title="Quitar esta ayuda"
          className="absolute top-2.5 right-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#737784] transition hover:bg-[#f0f3ff] hover:text-[#111c2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-8 sm:flex-1 sm:pr-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#dee8ff] text-[#00357f] sm:h-11 sm:w-11">
            <ScanFace className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold tracking-tight text-[#111c2d] sm:text-base">
              ¿Necesita ayuda para saber qué lentes le convienen?
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5d606f] sm:text-[13px]">
              Descubra su forma de rostro con la cámara de su teléfono y le sugerimos los
              armazones de nuestro catálogo que mejor le quedan. Sin subir ninguna foto.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="min-h-[44px] shrink-0 cursor-pointer rounded-2xl bg-[#00357f] px-5 text-sm font-bold text-white shadow-md shadow-[#00357f]/25 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2 sm:mr-9 sm:min-h-[48px]"
        >
          Descubrir mi forma de rostro
        </button>
      </section>
      )}

      {/* TOP: compact carousel — mobile-first pattern: peek the next card
          so the swipe is obvious, user-controlled (no auto-rotation),
          low horizontal cards: photo, name, price. Content is the real
          «Más vendidos» ranking when sales data is readable (staff
          sessions); otherwise the featured/promo selection takes over. */}
      {carouselProducts.length > 0 && (
        <section className="anim-fade-up space-y-2 sm:space-y-3" aria-label={hasBestSellers ? 'Más vendidos' : 'Destacados y promociones'}>
          <div className="flex items-center justify-between gap-3 px-0.5">
            <h2 className="text-base font-extrabold tracking-tight text-[#111c2d] flex items-center gap-2">
              {hasBestSellers ? (
                <><TrendingUp className="w-5 h-5 text-[#00357f]" /> Más vendidos</>
              ) : (
                <><Sparkles className="w-5 h-5 text-[#00357f]" /> Destacados y promociones</>
              )}
            </h2>
            <div className="hidden md:flex gap-2">
              <button
                onClick={scrollPrev}
                disabled={!prevBtnEnabled}
                aria-label={hasBestSellers ? 'Más vendido anterior' : 'Destacado anterior'}
                className="w-11 h-11 rounded-full bg-white border border-[#cbd5e1] flex items-center justify-center text-[#737784] hover:text-[#111c2d] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!nextBtnEnabled}
                aria-label={hasBestSellers ? 'Más vendido siguiente' : 'Destacado siguiente'}
                className="w-11 h-11 rounded-full bg-white border border-[#cbd5e1] flex items-center justify-center text-[#737784] hover:text-[#111c2d] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {carouselProducts.map((p) => (
                <div key={p.id} className="flex-[0_0_72%] min-[420px]:flex-[0_0_44%] sm:flex-[0_0_31%] lg:flex-[0_0_23%] min-w-0 pr-3">
                  <button
                    type="button"
                    onClick={() => handleOpenDetailModal(p)}
                    aria-label={`Ver ${p.name}`}
                    className="group or-shadow-card flex h-full w-full flex-col rounded-[20px] bg-white p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,53,127,0.06),0_20px_44px_-18px_rgba(0,53,127,0.3)] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] sm:p-3"
                  >
                    {renderCardFace(p)}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {scrollSnaps.length > 1 && (
            <div className="flex justify-center">
              {scrollSnaps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={hasBestSellers ? `Ir al más vendido ${i + 1}` : `Ir al destacado ${i + 1}`}
                  className="flex h-9 w-9 sm:h-11 sm:w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  <span className={`block h-1.5 rounded-full transition-all ${i === selectedIndex ? 'w-6 bg-[#00357f]' : 'w-1.5 bg-[#cbd5e1]'}`} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Member pricing banner: la banda de INVITADO salió del flujo
          (corrección 5 del dueño 2026-11-18) y ahora es el aviso
          emergente flotante de más abajo. Aquí solo queda la banda
          verde del cliente con sesión, como siempre. */}
      {!loading && isClient && (
        <div className="flex flex-wrap items-center gap-2 bg-[#e2f9ee] border border-[#49da9f]/40 rounded-xl px-4 py-3">
          <Tag className="w-4 h-4 text-[#00422b]" />
          <p className="text-xs font-bold text-[#00422b]">
            Estás viendo tus precios de cliente: {memberPct}% de descuento general aplicado, y precio especial en los productos marcados.
          </p>
        </div>
      )}


      {/* LAYOUT: FILTERS & PRODUCT GRID */}
      <div className="flex flex-col gap-4 sm:gap-6 items-start w-full">

        {/* 1. COLLAPSIBLE TOP FILTERS — el ÚNICO sistema de filtros
            (diseño final del dueño 2026-11-18: fuera la barra
            pegajosa de pastillas, que duplicaba a esta tarjeta y se
            comía la pantalla). Fuente un escalón menor en todo el
            interior, por dictado suyo («más ordenadito»). */}
        <div className="w-full bg-white border border-[#cbd5e1] rounded-2xl p-3 sm:p-6 shadow-sm">
          <div
            className="flex justify-between items-center cursor-pointer select-none group"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00357f] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros y Búsqueda Avanzada
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); handleResetFilters(); }}
                className="text-[9px] font-black text-[#00357f] hover:underline cursor-pointer uppercase"
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
                <div className="pt-4 mt-3 border-t border-[#f0f3ff] space-y-5">

                  {/* Category Filter (Horizontal, Multi-select) */}
                  <div className="space-y-2.5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-[#737784]">Categorías (Selecciona una o varias)</label>
                    <div className="flex flex-wrap gap-1.5">
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
                            aria-pressed={isSelected}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-200 active:scale-95 cursor-pointer min-h-[34px] ${
                              isSelected
                                ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f] shadow-sm scale-102 font-black'
                                : 'bg-[#f0f3ff] border-[#cbd5e1]/40 text-[#434653] hover:bg-[#dee8ff]/30 hover:border-[#cbd5e1]'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className="text-[8px] opacity-60">({count})</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Brand Filter (Multi-select, unión): la sección
                      «Marca» vive AQUÍ, en la única tarjeta de
                      filtros, con el mismo estilo seleccionado
                      verdecito de las categorías. */}
                  {brandOptions.length >= 2 && (
                    <div className="space-y-2.5">
                      <label className="block text-[8px] font-bold uppercase tracking-wider text-[#737784]">Marca (Selecciona una o varias)</label>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por marca">
                        {brandOptions.map(({ brand, count }) => {
                          const isSelected = selectedBrands.includes(brand)
                          return (
                            <button
                              key={brand}
                              type="button"
                              onClick={() => toggleBrandFilter(brand)}
                              aria-pressed={isSelected}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-200 active:scale-95 cursor-pointer min-h-[34px] ${
                                isSelected
                                  ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f] shadow-sm scale-102 font-black'
                                  : 'bg-[#f0f3ff] border-[#cbd5e1]/40 text-[#434653] hover:bg-[#dee8ff]/30 hover:border-[#cbd5e1]'
                              }`}
                            >
                              <span>{brand}</span>
                              <span className="text-[8px] opacity-60">({count})</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Other Filters Grid (3 Columns) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-[#f0f3ff]">

                    {/* Face Shape */}
                    <div className="space-y-2.5">
                      <label className="block text-[8px] font-bold uppercase tracking-wider text-[#737784]">Forma de Rostro</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {faceShapes.map(shape => {
                          const isSelected = faceShapeFilter === shape.value
                          return (
                            <button
                              key={shape.value}
                              onClick={() => updateFilter('faceShape', shape.value)}
                              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border text-center transition-all active:scale-95 cursor-pointer min-h-[34px] uppercase tracking-wider ${
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
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider text-[#737784]">
                        <label>Rango de Precio</label>
                        <span className="text-[#00357f] text-[11px] font-black">
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
                      <div className="flex justify-between text-[8px] text-[#737784] font-bold">
                        <span>Min: $0</span>
                        <span>Máx: {formatPrice(absoluteMaxPrice || 10000)}</span>
                      </div>
                    </div>

                    {/* Toggle Promos */}
                    <div className="space-y-2.5 flex flex-col justify-center">
                      <div className="flex items-center justify-between p-3 bg-[#f0f3ff] border border-[#cbd5e1]/40 rounded-xl h-[44px] mt-auto">
                        <span className="text-[11px] font-bold text-[#434653]">Solo Promociones</span>
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
        <div className="w-full space-y-4 sm:space-y-6">

          {/* Controls Bar */}
          <div className="bg-white border border-[#cbd5e1] rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">

            {/* Results count (the only search field is the floating one
                above the brand strip — no duplicate field here). */}
            <p className="text-xs font-bold text-[#434653] w-full sm:w-auto">
              {processedProducts.length} {processedProducts.length === 1 ? 'producto' : 'productos'}
              {searchTerm.trim() !== '' && (
                <span className="text-[#737784] font-medium"> para «{searchTerm.trim()}»</span>
              )}
            </p>

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
                  className={`p-2 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
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
                  className={`p-2 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] ${
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

          {/* Active filter chips: every applied filter, removable in
              place, with a clear-all shortcut. */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[#434653]">Filtros activos:</span>
              {activeChips.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  aria-label={`Quitar filtro: ${chip.label}`}
                  className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-[#dee8ff] px-3.5 text-xs font-semibold text-[#00357f] transition hover:bg-[#c9d8ff] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] cursor-pointer rounded-full px-2 text-xs font-bold text-[#00357f] underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {/* Reorder hint for the admin: how to drag when it is
              available, and why it is off while filters are on. */}
          {isAdmin && !loading && processedProducts.length > 1 && (
            canReorder ? (
              <p className="text-[11px] font-medium text-[#737784]">
                Arrastra las tarjetas desde el asa para reordenar el catálogo; el orden se guarda al soltar y es el que ven los clientes.
              </p>
            ) : (
              <p className="text-[11px] font-medium text-[#737784]">Quita los filtros para reordenar</p>
            )
          )}

          {/* Results display */}
          {loading ? (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5"
              role="status"
              aria-label="Cargando catálogo"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="or-shadow-card rounded-[20px] bg-white p-2.5 sm:p-3">
                  <div className="skeleton-shimmer w-full aspect-[3/2] rounded-[14px]" />
                  <div className="space-y-2 px-0.5 pt-2.5">
                    <div className="skeleton-shimmer h-2.5 rounded-full w-1/3" />
                    <div className="skeleton-shimmer h-3 rounded-full w-2/3" />
                    <div className="skeleton-shimmer h-4 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Cargando catálogo...</span>
            </div>
          ) : processedProducts.length === 0 ? (
            <div className="text-center py-20 bg-white border border-[#cbd5e1] rounded-[20px] space-y-3 shadow-[0_8px_24px_-12px_rgba(0,53,127,0.18)] p-6">
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
                  ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5"
                  : "flex flex-col gap-3"
              }
            >
              <AnimatePresence mode="popLayout">
                {gridProducts.map((p, index) => {
                  const isFaved = wishlist.includes(p.id)
                  const details = getProductDetails(p)
                  const images = getProductImages(p)
                  const soldOut = p.stock === 0
                  const discounted = isClient && priceOf(p) < p.price
                  const enterStyle = { '--enter-delay': `${Math.min(index, 7) * 30}ms` } as React.CSSProperties

                  // Wishlist heart: 36px visual inside a 44px touch
                  // target; the icon pops with a spring when faved.
                  const heartButton = (
                    <button
                      type="button"
                      onClick={(e) => handleToggleWishlist(p.id, e)}
                      aria-label={isFaved ? `Quitar ${p.name} de favoritos` : `Añadir ${p.name} a favoritos`}
                      title={isFaved ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                      className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm">
                        <motion.span
                          key={isFaved ? 'fav' : 'plain'}
                          initial={{ scale: isFaved ? 0.6 : 1 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          className="flex"
                        >
                          <Heart className={`h-4 w-4 ${isFaved ? 'fill-rose-500 text-rose-500' : 'text-[#737784]'}`} />
                        </motion.span>
                      </span>
                    </button>
                  )

                  // Asa de arrastre (solo admin, solo con la lista
                  // completa sin filtros): el arrastre nace AQUÍ, con
                  // pointer events (dedo y ratón); tocar cualquier
                  // otra parte de la tarjeta —corazón incluido— sigue
                  // haciendo lo de siempre.
                  const dragHandle = canReorder ? (
                    <button
                      type="button"
                      aria-label={`Arrastrar ${p.name} para reordenar`}
                      title="Arrastra para reordenar"
                      onPointerDown={(e) => startDrag(e, p)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-white/95 text-[#00357f] shadow-md ring-1 ring-[#00357f]/15 transition active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  ) : null
                  const isDraggingThis = draggingId === p.id
                  const cardRef = (node: HTMLDivElement | null) => {
                    if (node) cardRefs.current.set(p.id, node)
                    else cardRefs.current.delete(p.id)
                  }

                  // OJO apilamiento: la raíz de la tarjeta lleva
                  // `isolate` + z-0 (z-40 solo mientras se arrastra).
                  // Sin ese contexto propio, el z-30 interno del
                  // corazón y del asa se escapaba al contexto de la
                  // página, empataba con la barra pegajosa de filtros
                  // y la tapaba al hacer scroll (foto del dueño,
                  // 2026-11-18). No quitar el `isolate`.
                  if (layoutMode === 'list') {
                    const colorMaterial = [details.color, details.material].filter(Boolean).join(' · ')
                    return (
                      <motion.div
                        ref={cardRef}
                        layout={!draggingId}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                        transition={{ duration: 0.25 }}
                        key={p.id}
                        onClick={() => handleCardClick(p)}
                        style={enterStyle}
                        className={`anim-stagger-item or-shadow-card group relative isolate flex cursor-pointer items-center gap-3 rounded-[20px] bg-white p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,53,127,0.06),0_20px_44px_-18px_rgba(0,53,127,0.3)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] sm:p-3 ${isDraggingThis ? 'z-40 shadow-[0_24px_48px_-12px_rgba(0,53,127,0.45)]' : 'z-0'}`}
                      >
                        {dragHandle}
                        <span className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-[#f8faff]">
                          {images.length > 0 ? (
                            <img
                              src={images[0]}
                              alt={getProductImageAlt(p)}
                              loading="lazy"
                              className={`h-full w-full object-contain p-1.5 transition duration-[250ms] ease-out group-hover:scale-[1.05] group-active:scale-[1.03] ${soldOut ? 'opacity-60 grayscale' : ''}`}
                            />
                          ) : (
                            <span className={`flex h-full w-full items-center justify-center text-[#00357f]/30 ${soldOut ? 'opacity-60 grayscale' : ''}`}>
                              <Eye className="h-6 w-6 stroke-[1.5]" />
                            </span>
                          )}
                          {renderBadge(p, true)}
                        </span>
                        <span className="block min-w-0 flex-1">
                          {details.brand && (
                            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[#00509e] transition-colors group-hover:text-[#00357f]">
                              {details.brand}
                            </span>
                          )}
                          <span className="mt-0.5 block text-[13px] leading-[1.25] font-semibold text-[#111c2d] line-clamp-2 transition-colors group-hover:text-[#00357f]">
                            {p.name}
                          </span>
                          {colorMaterial && (
                            <span className="mt-0.5 block truncate text-[11px] text-[#5d606f]">{colorMaterial}</span>
                          )}
                        </span>
                        <span className="block shrink-0 text-right">
                          <span className="block text-[15px] font-extrabold text-[#00357f] tabular-nums">{formatPrice(priceOf(p))}</span>
                          {discounted && (
                            <span className="mt-0.5 flex items-center justify-end gap-1.5">
                              <span className="text-[11px] text-[#737784] line-through tabular-nums">{formatPrice(p.price)}</span>
                              <span className="rounded-full bg-[#e2f9ee] px-1.5 py-px text-[10px] font-semibold text-[#00422b]">
                                -{Math.round((1 - priceOf(p) / p.price) * 100)}%
                              </span>
                            </span>
                          )}
                        </span>
                        {heartButton}
                      </motion.div>
                    )
                  }

                  return (
                    <motion.div
                      ref={cardRef}
                      layout={!draggingId}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                      transition={{ duration: 0.25 }}
                      key={p.id}
                      onClick={() => handleCardClick(p)}
                      style={enterStyle}
                      className={`anim-stagger-item or-shadow-card group relative isolate flex cursor-pointer flex-col rounded-[20px] bg-white p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,53,127,0.06),0_20px_44px_-18px_rgba(0,53,127,0.3)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] sm:p-3 ${isDraggingThis ? 'z-40 shadow-[0_24px_48px_-12px_rgba(0,53,127,0.45)]' : 'z-0'}`}
                    >
                      {renderCardFace(p, (
                        <>
                          {dragHandle && (
                            <span className="absolute bottom-1.5 left-1.5 z-30">
                              {dragHandle}
                            </span>
                          )}
                          <span className="absolute top-1.5 right-1.5 z-30">
                            {heartButton}
                          </span>
                        </>
                      ))}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}

        </div>

      </div>

      {/* Aviso emergente de descuento para INVITADOS (corrección 5
          del dueño 2026-11-18): flota arriba al abrir el catálogo —
          la banda «¿Ya eres cliente?» ya no ocupa un renglón del
          flujo. La pastilla del descuento parpadea como la del
          héroe. Dos salidas: «Iniciar sesión» o la X (que lo apaga
          por el resto de la sesión). El texto del descuento es fijo
          por dictado del dueño («15% o más»); los precios reales no
          cambian. */}
      {memberPopupVisible && (
        <div
          role="dialog"
          aria-label="Descuento para clientes de Óptica Rayo"
          className="anim-fade-up fixed inset-x-4 top-[70px] z-[45] mx-auto max-w-md rounded-3xl border border-[#00357f]/15 bg-white/95 p-4 shadow-[0_24px_48px_-16px_rgba(0,53,127,0.45)] backdrop-blur-md sm:top-[76px]"
        >
          <button
            type="button"
            onClick={dismissMemberPopup}
            aria-label="Cerrar el aviso"
            className="absolute top-2.5 right-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#737784] transition hover:bg-[#f0f3ff] hover:text-[#111c2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-7">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#dee8ff] text-[#00357f]">
              <Tag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight text-[#111c2d]">
                ¿Ya eres cliente de Óptica Rayo?
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#434653]">
                Nuestros clientes tienen{' '}
                <span className="anim-blink-pill inline-flex items-center rounded-full bg-[#e2f9ee] px-2 py-0.5 font-black text-[#00422b]">
                  15% o más de descuento
                </span>{' '}
                en el catálogo, además de precios especiales por producto.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-2xl bg-[#00357f] px-4 text-sm font-bold text-white shadow-md shadow-[#00357f]/25 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
          >
            Iniciar sesión
          </Link>
        </div>
      )}

      {/* Escáner de rostro: modal en portal; al tocar un armazón
          sugerido se cierra y se abre el detalle de ese producto.
          Al cerrar ESE detalle, el cliente vuelve al resultado del
          escáner (resumeShape), las veces que entre y salga; solo
          la X del escáner o «Ver todos los armazones» abandonan el
          flujo y limpian la forma recordada. */}
      <FaceScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false)
          setScannerShape(null)
          detailFromScannerRef.current = false
        }}
        products={products}
        priceOf={priceOf}
        resumeShape={scannerShape}
        onShapeResolved={setScannerShape}
        onPickProduct={(p) => {
          detailFromScannerRef.current = true
          setScannerOpen(false)
          handleOpenDetailModal(p)
        }}
        onShowAllFrames={() => {
          setScannerOpen(false)
          setScannerShape(null)
          detailFromScannerRef.current = false
          updateFilter('category', 'frames')
        }}
      />

      {/* Aviso discreto del guardado del orden (solo lo ve el admin
          que acaba de arrastrar). */}
      {orderNotice && (
        <div
          role="status"
          className={`fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-xs font-bold whitespace-nowrap shadow-lg md:bottom-8 ${
            orderNotice.kind === 'ok' ? 'bg-[#00422b] text-white' : 'bg-[#ba1a1a] text-white'
          }`}
        >
          {orderNotice.text}
        </div>
      )}

      {/* ========================================================
         MODAL: LENS WIZARD STEPPER CONFIGURATOR
         ======================================================== */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/35 backdrop-blur-sm">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="w-full max-w-lg bg-white border border-[#cbd5e1] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[94dvh] sm:max-h-[90vh] relative"
            >
              {/* Close trigger */}
              <button
                onClick={handleCloseModal}
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
                    <motion.img
                      key={selectedImageIndex}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
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
                    <span className={wizardStep === 1 ? 'text-[#00357f]' : 'text-emerald-600'}>1. Lente</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 2 ? 'text-[#00357f]' : wizardStep > 2 ? 'text-emerald-600' : ''}>2. Extras</span>
                    <span className="opacity-40 font-normal">→</span>
                    <span className={wizardStep === 3 ? 'text-[#00357f]' : ''}>3. Receta</span>
                  </div>

                  {/* STEP 1: VISION OPTION — the options OF THIS PRODUCT
                      (seeded from the admin template, owned by the product) */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-[#434653] flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-[#00357f]" />
                          Paso 1: Elige el tipo de lente
                        </p>

                        {productOptions.vision.length === 0 ? (
                          <p className="text-xs text-[#737784] font-medium bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl px-4 py-3">
                            Este armazón aún no tiene opciones de lente configuradas; la óptica te cotiza en sucursal.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {productOptions.vision.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedVisionId(opt.id)}
                                className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[44px] ${
                                  selectedVisionId === opt.id
                                    ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f]'
                                    : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#f0f3ff]'
                                }`}
                              >
                                <span>{opt.name}</span>
                                <span className="text-[10px] text-[#00357f] shrink-0 font-mono">
                                  {Number(opt.price_delta) > 0 ? `+${formatPrice(Number(opt.price_delta))}` : 'Incluido'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}



                  {/* STEP 2: EXTRA OPTIONS — also this product's own options */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-[#434653] flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#00357f]" />
                        Paso 2: Extras para tu lente (puedes elegir varios)
                      </p>

                      {productOptions.extra.length === 0 ? (
                        <p className="text-xs text-[#737784] font-medium bg-[#f9f9ff] border border-[#cbd5e1]/40 rounded-xl px-4 py-3">
                          Este armazón no tiene extras configurados.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {productOptions.extra.map(opt => {
                            const isSelected = selectedExtraIds.includes(opt.id)
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedExtraIds(selectedExtraIds.filter(x => x !== opt.id))
                                  } else {
                                    setSelectedExtraIds([...selectedExtraIds, opt.id])
                                  }
                                }}
                                className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left min-h-[44px] ${
                                  isSelected
                                    ? 'bg-[#dee8ff] border-[#00357f] text-[#00357f]'
                                    : 'bg-white border-[#cbd5e1] text-[#737784] hover:bg-[#f0f3ff]'
                                }`}
                              >
                                <span>{opt.name}</span>
                                <span className="text-[10px] text-[#00357f] shrink-0 font-mono">+{formatPrice(Number(opt.price_delta) || 0)}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
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
                        <div className="space-y-2">
                          <div className="border-2 border-dashed border-[#cbd5e1] hover:border-[#00357f] p-6 rounded-xl bg-[#f9f9ff] text-center transition-all relative">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.pdf"
                              onChange={handlePrescriptionFile}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="space-y-2 flex flex-col items-center">
                              <Upload className="w-8 h-8 text-[#00357f]" />
                              {prescriptionFile ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{prescriptionFile.name}</span>
                                  </div>
                                  <p className="text-[10px] text-[#737784] font-medium">
                                    Se subirá de forma segura al enviar tu solicitud.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs font-bold text-[#111c2d]">Arrastra tu receta o haz clic aquí</p>
                                  <p className="text-[10px] text-[#737784]">Formatos JPG, PNG, WebP o PDF · Máx. 5 MB</p>
                                </>
                              )}
                            </div>
                          </div>
                          {uploadError && (
                            <p className="text-[11px] font-bold text-[#ba1a1a] bg-[#ffdad6]/60 border border-[#ba1a1a]/25 rounded-lg px-3 py-2">
                              {uploadError}
                            </p>
                          )}
                          {!userProfile && (
                            <p className="text-[11px] text-[#737784] font-medium">
                              Para enviar tu solicitud con la receta necesitas <a href="/login" className="text-[#00357f] font-bold underline">iniciar sesión</a>: así la óptica la recibe ligada a tu cuenta.
                            </p>
                          )}
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
                        className="ml-auto text-xs font-bold text-white bg-[#00357f] hover:bg-[#004aad] px-5 py-2 rounded-lg cursor-pointer transition-all active:scale-95"
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
                    {hasGraduation || selectedExtraIds.length > 0 ? 'Total Configurado' : 'Precio Sugerido'}
                  </p>
                  <p className="text-xl font-black text-[#00357f] font-mono">
                    {formatPrice(selectedProduct.category === 'frames' ? totalConfiguredPrice : priceOf(selectedProduct))}
                  </p>
                  {selectedProduct.category === 'frames' && (visionPrice > 0 || extrasPrice > 0) && (
                    <p className="text-[10px] text-[#737784] font-medium mt-0.5">
                      Armazón {formatPrice(priceOf(selectedProduct))} · Lente {formatPrice(visionPrice)} · Extras {formatPrice(extrasPrice)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-[#737784] font-bold uppercase tracking-wider">Garantía Óptica</p>
                  <p className="text-xs text-[#111c2d] font-bold">1 Año Rayo Care</p>
                </div>
              </div>

              {/* Final Actions */}
              <div className="space-y-3 pt-2">
                {requestStatus === 'sent' && (
                  <div className="flex items-start gap-2 bg-[#e2f9ee] border border-[#49da9f]/50 rounded-xl px-4 py-3 text-left">
                    <CheckCircle className="w-4 h-4 text-[#00422b] shrink-0 mt-px" />
                    <div>
                      <p className="text-xs font-bold text-[#00422b]">
                        ¡Solicitud enviada! La óptica ya la recibió y te contactará para confirmar tu cotización.
                      </p>
                      {requestNote && (
                        <p className="text-[11px] text-[#00422b]/80 font-medium mt-0.5">{requestNote}</p>
                      )}
                    </div>
                  </div>
                )}

                {requestStatus === 'error' && (
                  <div className="bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl px-4 py-3 text-left">
                    <p className="text-xs font-bold text-[#ba1a1a]">
                      {requestNote || 'No se pudo enviar la solicitud. Inténtalo de nuevo.'}
                    </p>
                  </div>
                )}

                {/* Guests cannot create a real request (lens_requests needs an
                    account): invite them to log in instead of faking a send. */}
                {!userProfile && requestStatus !== 'sent' && selectedProduct.category === 'frames' && (
                  <p className="text-[11px] text-[#737784] font-medium text-left bg-[#f0f3ff] border border-[#cbd5e1]/50 rounded-xl px-4 py-3">
                    ¿Quieres enviar esta cotización con tu receta?{' '}
                    <a href="/login" className="text-[#00357f] font-bold underline">Inicia sesión</a>{' '}
                    o crea tu cuenta: tu solicitud llega directo a la óptica.
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="min-h-12 flex-1 text-xs font-bold text-[#737784] hover:bg-[#dee8ff] py-3 rounded-xl border border-[#cbd5e1] cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                  >
                    Cerrar
                  </button>

                  {userProfile && selectedProduct.category === 'frames' && requestStatus !== 'sent' && (
                    <button
                      type="button"
                      onClick={handleSendRequest}
                      disabled={requestStatus === 'sending'}
                      className="min-h-12 flex-1 flex items-center justify-center gap-2 bg-[#00357f] hover:bg-[#004aad] disabled:opacity-60 disabled:cursor-wait text-white font-bold text-xs py-3 rounded-xl shadow-sm cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      {requestStatus === 'sending' ? 'Enviando…' : 'Enviar solicitud'}
                    </button>
                  )}

                  {getWhatsAppLink(selectedProduct) && (
                    <a
                      href={getWhatsAppLink(selectedProduct) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-12 flex-1 flex items-center justify-center gap-2 bg-[#49da9f] hover:bg-[#3bc48b] text-[#002113] font-bold text-xs py-3 rounded-xl shadow-sm cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    >
                      <Phone className="w-4 h-4 text-[#002113] shrink-0" />
                      {selectedProduct.category === 'frames' && hasGraduation ? 'Comprar Lentes' : 'Consultar Disponibilidad'}
                    </a>
                  )}
                </div>
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
      <div className="min-h-screen text-[#111c2d] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
        <p className="text-xs text-[#737784] font-black">Cargando catálogo...</p>
      </div>
    }>
      <CatalogContent />
    </Suspense>
  )
}
