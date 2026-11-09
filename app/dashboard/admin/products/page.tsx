'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  uploadProductImages,
  getMemberDiscountPercent,
  saveMemberDiscountPercent
} from '@/lib/services'
import { Database } from '@/types/database.types'
import LensOptionsEditor from './lens-options-editor'
import {
  getLensOptionTemplates,
  getActiveLensOptionTemplates,
  templatesToDrafts,
  syncLensOptionTemplates,
  getProductLensOptionRows,
  productOptionsToDrafts,
  syncProductLensOptions,
  seedProductOptionsFromTemplates,
  type LensOptionDraft,
  type LensOptionTemplate
} from '@/lib/product-lens-options'
import { FRAME_SHAPE_OPTIONS, getProductDetails, type FrameShape } from '@/lib/product-data'
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_GALLERY_FILES,
  PRODUCT_IMAGE_RECOMMENDED,
  validateProductImageFile,
} from '@/lib/product-images'
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowLeft,
  X,
  Sparkles,
  AlertCircle,
  Package,
  CheckCircle,
  SlidersHorizontal,
  Tag,
  Settings,
  ChevronDown
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

// Compatibility adapter: new rows use real columns; older rows may still
// carry the legacy JSON description, which getProductDetails can read.
function parseProductDescription(product: Product) {
  return getProductDetails(product)
}

// Template rows keep their id in the editor (they are real DB rows);
// product prefills use templatesToDrafts() instead, which drops the id
// because the copy lives in a different table.
function templatesToEditorDrafts(rows: LensOptionTemplate[]): LensOptionDraft[] {
  return rows.map(t => ({
    id: t.id,
    grp: t.grp,
    name: t.name,
    price_delta: t.price_delta,
    sort_order: t.sort_order,
    is_active: t.is_active
  }))
}

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  
  // Search & Filter states
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all')
  const [productBrandFilter, setProductBrandFilter] = useState<string>('all')
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Product Add Form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [pName, setPName] = useState('')
  const [pDescription, setPDescription] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pStock, setPStock] = useState('')
  const [pCategory, setPCategory] = useState<'frames' | 'lenses' | 'contact_lenses' | 'accessories'>('frames')
  const [pBrand, setPBrand] = useState('')
  const [pMaterial, setPMaterial] = useState('')
  const [pSku, setPSku] = useState('')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [pImagePreview, setPImagePreview] = useState<string>('')
  const [pImageUrl, setPImageUrl] = useState('')
  const [pGalleryFiles, setPGalleryFiles] = useState<File[]>([])
  const [pGalleryPreviews, setPGalleryPreviews] = useState<string[]>([])
  const [pPhotoMessage, setPPhotoMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null)
  const [pColor, setPColor] = useState('')
  const [pFrameShape, setPFrameShape] = useState<FrameShape | ''>('')
  const [pImageAlt, setPImageAlt] = useState('')
  const [pIsPromo, setPIsPromo] = useState(false)
  const [pIsFeatured, setPIsFeatured] = useState(false)
  const [pClientPrice, setPClientPrice] = useState('')

  // General member discount percent (logged-in customers)
  const [memberPct, setMemberPct] = useState(20)
  // «Configuración» section (discount + templates): collapsed by default
  // so the product grid leads the page.
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [submittingProduct, setSubmittingProduct] = useState(false)

  // Lens option templates (editable defaults) + per-product option drafts.
  const [templateDrafts, setTemplateDrafts] = useState<LensOptionDraft[]>([])
  const [savingTemplates, setSavingTemplates] = useState(false)
  const [createOptionDrafts, setCreateOptionDrafts] = useState<LensOptionDraft[]>([])
  const [editOptionDrafts, setEditOptionDrafts] = useState<LensOptionDraft[]>([])
  const [editOptionsLoadedFor, setEditOptionsLoadedFor] = useState<string | null>(null)

  // Edit / Delete states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // States for Editing forms
  const [eBrand, setEBrand] = useState('')
  const [eMaterial, setEMaterial] = useState('')
  const [eSku, setESku] = useState('')
  const [eNotes, setENotes] = useState('')
  const [eColor, setEColor] = useState('')
  const [eFrameShape, setEFrameShape] = useState<FrameShape | ''>('')
  const [eImageAlt, setEImageAlt] = useState('')
  const [eImageFile, setEImageFile] = useState<File | null>(null)
  const [eImagePreview, setEImagePreview] = useState('')
  const [eGalleryUrls, setEGalleryUrls] = useState<string[]>([])
  const [eGalleryFiles, setEGalleryFiles] = useState<File[]>([])
  const [eGalleryPreviews, setEGalleryPreviews] = useState<string[]>([])
  const [ePhotoMessage, setEPhotoMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null)

  const loadProductsData = async () => {
    try {
      setLoading(true)
      const data = await getProducts()
      setProducts(data)
      const pct = await getMemberDiscountPercent()
      setMemberPct(pct)
      try {
        const templates = await getLensOptionTemplates()
        setTemplateDrafts(templatesToEditorDrafts(templates))
      } catch {
        // Templates are an auxiliary editor: if that read fails the
        // inventory still loads; saving templates will surface the error.
        setTemplateDrafts([])
      }
    } catch (e) {
      showFeedback('error', 'Error al cargar los productos del inventario.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplates = async () => {
    setSavingTemplates(true)
    try {
      const fresh = await syncLensOptionTemplates(templateDrafts)
      setTemplateDrafts(templatesToEditorDrafts(fresh))
      showFeedback('success', 'Plantillas de opciones guardadas. Los productos ya creados NO cambiaron: cada uno guarda sus propias opciones.')
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Error al guardar las plantillas de opciones.')
    } finally {
      setSavingTemplates(false)
    }
  }

  // Every time the create modal opens, the product's lens options start
  // as a fresh copy of the active template (the owner can edit them
  // before saving; they are stored per product, never linked back).
  useEffect(() => {
    if (!isCreateModalOpen) return
    let cancelled = false
    getActiveLensOptionTemplates()
      .then(t => { if (!cancelled) setCreateOptionDrafts(templatesToDrafts(t)) })
      .catch(() => { if (!cancelled) setCreateOptionDrafts([]) })
    return () => { cancelled = true }
  }, [isCreateModalOpen])

  // Load the edited product's OWN lens options (including inactive).
  const editingProductId = editingProduct?.id ?? null
  useEffect(() => {
    if (!editingProductId) {
      setEditOptionDrafts([])
      setEditOptionsLoadedFor(null)
      return
    }
    let cancelled = false
    getProductLensOptionRows(editingProductId, { includeInactive: true })
      .then(rows => {
        if (!cancelled) {
          setEditOptionDrafts(productOptionsToDrafts(rows))
          setEditOptionsLoadedFor(editingProductId)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditOptionDrafts([])
          setEditOptionsLoadedFor(editingProductId)
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProductId])

  const handleSaveMemberPct = async () => {
    await saveMemberDiscountPercent(memberPct)
    showFeedback('success', `Descuento general a clientes guardado: ${memberPct}% sobre el precio de vitrina.`)
  }

  useEffect(() => {
    loadProductsData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Handle Product image select with the shared photo standard.
  const handleProductImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = await validateProductImageFile(file)
    if (!validation.valid) {
      setPImageFile(null)
      setPImagePreview('')
      setPPhotoMessage({ type: 'error', text: validation.errors.join(' ') })
      e.target.value = ''
      return
    }
    if (pImagePreview.startsWith('blob:')) URL.revokeObjectURL(pImagePreview)
    setPImageFile(file)
    setPImagePreview(URL.createObjectURL(file))
    setPPhotoMessage(validation.warnings.length > 0
      ? { type: 'warning', text: validation.warnings.join(' ') }
      : null)
  }

  const handleGalleryImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'create' | 'edit'
  ) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    const currentCount = mode === 'create'
      ? pGalleryFiles.length
      : eGalleryUrls.length + eGalleryFiles.length
    const available = PRODUCT_IMAGE_MAX_GALLERY_FILES - currentCount
    if (available <= 0) {
      const message = { type: 'error' as const, text: `La galería admite hasta ${PRODUCT_IMAGE_MAX_GALLERY_FILES} fotos adicionales.` }
      mode === 'create' ? setPPhotoMessage(message) : setEPhotoMessage(message)
      e.target.value = ''
      return
    }

    const accepted: File[] = []
    const messages: string[] = []
    for (const file of selected.slice(0, available)) {
      const validation = await validateProductImageFile(file)
      if (!validation.valid) messages.push(`${file.name}: ${validation.errors.join(' ')}`)
      else {
        accepted.push(file)
        messages.push(...validation.warnings.map(w => `${file.name}: ${w}`))
      }
    }
    if (selected.length > available) {
      messages.push(`Solo se agregaron ${available} foto(s); ya alcanzaste el límite de galería.`)
    }

    if (mode === 'create') {
      setPGalleryFiles(prev => [...prev, ...accepted])
      setPGalleryPreviews(prev => [...prev, ...accepted.map(file => URL.createObjectURL(file))])
      setPPhotoMessage(messages.length > 0 ? { type: 'warning', text: messages.join(' ') } : null)
    } else {
      setEGalleryFiles(prev => [...prev, ...accepted])
      setEGalleryPreviews(prev => [...prev, ...accepted.map(file => URL.createObjectURL(file))])
      setEPhotoMessage(messages.length > 0 ? { type: 'warning', text: messages.join(' ') } : null)
    }
    e.target.value = ''
  }

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = await validateProductImageFile(file)
    if (!validation.valid) {
      setEImageFile(null)
      setEPhotoMessage({ type: 'error', text: validation.errors.join(' ') })
      e.target.value = ''
      return
    }
    if (eImagePreview.startsWith('blob:')) URL.revokeObjectURL(eImagePreview)
    setEImageFile(file)
    setEImagePreview(URL.createObjectURL(file))
    setEPhotoMessage(validation.warnings.length > 0
      ? { type: 'warning', text: validation.warnings.join(' ') }
      : null)
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
      let imageUrl = pImageUrl.trim() || null
      if (pImageFile) {
        imageUrl = await uploadProductImage(pImageFile)
      }
      const galleryUrls = await uploadProductImages(pGalleryFiles)

      // Structured product data: attributes live in their own columns and
      // description remains the public, human-readable note only.
      const created = await createProduct({
        name: pName.trim(),
        description: pDescription.trim() || null,
        price: parseFloat(pPrice),
        client_price: pClientPrice ? parseFloat(pClientPrice) : null,
        stock: parseInt(pStock),
        category: pCategory,
        image_url: imageUrl,
        brand: pBrand.trim() || null,
        material: pMaterial.trim() || null,
        sku: pSku.trim().toUpperCase(),
        frame_shape: pFrameShape || null,
        color: pColor.trim() || null,
        gallery_urls: galleryUrls,
        image_alt: pImageAlt.trim() || null,
        is_promo: pIsPromo,
        is_featured: pIsFeatured
      })

      // Lens options are stored PER PRODUCT: they start from the
      // template copy edited in this form and evolve independently.
      if (pCategory === 'frames' || pCategory === 'lenses') {
        if (createOptionDrafts.length > 0) {
          await syncProductLensOptions(created.id, createOptionDrafts)
        } else {
          await seedProductOptionsFromTemplates(created.id)
        }
      }

      showFeedback('success', '¡Producto añadido exitosamente al catálogo!')
      setPName('')
      setPDescription('')
      setPPrice('')
      setPStock('')
      setPCategory('frames')
      setPBrand('')
      setPMaterial('')
      setPSku('')
      setPImageFile(null)
      setPImagePreview('')
      setPImageUrl('')
      setPGalleryFiles([])
      setPGalleryPreviews([])
      setPPhotoMessage(null)
      setPColor('')
      setPFrameShape('')
      setPImageAlt('')
      setPIsPromo(false)
      setPIsFeatured(false)
      setPClientPrice('')
      setCreateOptionDrafts([])
      setIsCreateModalOpen(false)
      await loadProductsData()
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Error al registrar el producto.')
    } finally {
      setSubmittingProduct(false)
    }
  }

  // Set initial edit state when product is selected
  useEffect(() => {
    if (editingProduct) {
      const parsed = parseProductDescription(editingProduct)
      setEBrand(parsed.brand)
      setEMaterial(parsed.material)
      setESku(parsed.sku)
      setENotes(parsed.notes)
      setEColor(parsed.color)
      setEFrameShape(parsed.frameShape || '')
      setEImageAlt(editingProduct.image_alt || '')
      setEImageFile(null)
      setEImagePreview(editingProduct.image_url || '')
      setEGalleryUrls(editingProduct.gallery_urls || [])
      setEGalleryFiles([])
      setEGalleryPreviews([])
      setEPhotoMessage(null)
    } else {
      setEBrand('')
      setEMaterial('')
      setESku('')
      setENotes('')
      setEColor('')
      setEFrameShape('')
      setEImageAlt('')
      setEImageFile(null)
      setEImagePreview('')
      setEGalleryUrls([])
      setEGalleryFiles([])
      setEGalleryPreviews([])
      setEPhotoMessage(null)
    }
  }, [editingProduct])

  // Update Product Submit
  const handleUpdateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    try {
      let finalImageUrl = editingProduct.image_url
      if (eImageFile) {
        finalImageUrl = await uploadProductImage(eImageFile)
      }
      const uploadedGalleryUrls = await uploadProductImages(eGalleryFiles)
      const finalGalleryUrls = [...eGalleryUrls, ...uploadedGalleryUrls]

      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: eNotes.trim() || null,
        price: editingProduct.price,
        client_price: editingProduct.client_price ?? null,
        stock: editingProduct.stock,
        category: editingProduct.category,
        image_url: finalImageUrl,
        brand: eBrand.trim() || null,
        material: eMaterial.trim() || null,
        sku: eSku.trim().toUpperCase(),
        frame_shape: eFrameShape || null,
        color: eColor.trim() || null,
        gallery_urls: finalGalleryUrls,
        image_alt: eImageAlt.trim() || null,
        is_promo: editingProduct.is_promo,
        is_featured: editingProduct.is_featured
      })

      // Save this product's OWN lens options (never the template's and
      // never another product's). Skipped when the options never loaded
      // or when the category does not use the quote wizard.
      if (
        (editingProduct.category === 'frames' || editingProduct.category === 'lenses') &&
        editOptionsLoadedFor === editingProduct.id
      ) {
        await syncProductLensOptions(editingProduct.id, editOptionDrafts)
      }

      showFeedback('success', 'Producto actualizado correctamente.')
      setEditingProduct(null)
      await loadProductsData()
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Fallo al actualizar el producto.')
    }
  }

  // Delete Product
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return
    try {
      const ok = await deleteProduct(deletingProduct.id)
      if (ok) {
        showFeedback('success', 'Producto eliminado del catálogo.')
      } else {
        throw new Error()
      }
      setDeletingProduct(null)
      await loadProductsData()
    } catch (e) {
      showFeedback('error', 'Error al eliminar el producto.')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Extract list of all unique brands present in DB products for filter dropdown
  const uniqueBrandsList = useMemo(() => {
    const list = new Set<string>()
    products.forEach(p => {
      const parsed = parseProductDescription(p)
      if (parsed.brand) {
        list.add(parsed.brand)
      }
    })
    return Array.from(list).sort()
  }, [products])

  // Filter calculations
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const parsed = parseProductDescription(p)
      
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            parsed.notes.toLowerCase().includes(productSearch.toLowerCase()) ||
                            parsed.sku.toLowerCase().includes(productSearch.toLowerCase())
      
      const matchesCat = productCategoryFilter === 'all' || p.category === productCategoryFilter
      
      const matchesBrand = productBrandFilter === 'all' || parsed.brand.toLowerCase() === productBrandFilter.toLowerCase()

      let matchesStock = true
      if (stockStatusFilter === 'in_stock') {
        matchesStock = p.stock > 4
      } else if (stockStatusFilter === 'low_stock') {
        matchesStock = p.stock > 0 && p.stock < 5
      } else if (stockStatusFilter === 'out_of_stock') {
        matchesStock = p.stock === 0
      }

      return matchesSearch && matchesCat && matchesBrand && matchesStock
    })
  }, [products, productSearch, productCategoryFilter, productBrandFilter, stockStatusFilter])

  return (
    <main className="min-h-screen bg-[#f9f9ff] text-[#111c2d] p-4 md:p-8 space-y-6 max-w-[1440px] mx-auto pb-24 md:pb-8 text-left animate-in fade-in duration-200">
      
      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors shrink-0">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <Package className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Inventario y Productos</h1>
            <p className="text-sm text-[#434653] mt-1 font-medium">Gestione su catálogo de armazones, lentes y accesorios.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#00357f] hover:bg-[#004aad] text-white px-5 py-2.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Subir Producto
        </button>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
        }`}>
          {feedbackMsg.text}
        </div>
      )}

      {/* Configuración: member pricing + lens option templates live in ONE
          collapsible section, closed by default, so the product grid is
          the protagonist of the page. Both blocks keep their exact fields
          and save handlers — only the visual container changed. */}
      <section className="bg-white rounded-2xl border border-[#cbd5e1] shadow-sm" aria-label="Configuración">
        <button
          type="button"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          aria-expanded={isConfigOpen}
          className="w-full flex items-center gap-3 p-4 text-left cursor-pointer min-h-[56px] rounded-2xl"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#dee8ff] text-[#00357f] shrink-0" aria-hidden="true">
            <Settings className="w-4.5 h-4.5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-[#111c2d]">Configuración</span>
            <span className="block text-xs text-[#737784] font-medium">Descuento a clientes y plantillas de opciones de lente</span>
          </span>
          <ChevronDown className={`w-5 h-5 text-[#737784] shrink-0 transition-transform duration-300 ${isConfigOpen ? 'rotate-180' : ''}`} />
        </button>

        {isConfigOpen && (
          <div className="px-4 pb-4 pt-4 space-y-6 border-t border-[#f0f3ff]">

      {/* Member pricing configuration */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#00357f]">
          Descuento general a clientes logueados
        </span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            value={memberPct}
            onChange={(e) => setMemberPct(Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10) || 0)))}
            className="w-20 bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs font-bold text-[#111c2d] focus:border-[#00357f] outline-none"
          />
          <span className="text-xs font-bold text-[#434653]">% sobre el precio de vitrina</span>
        </div>
        <span className="text-[10px] text-[#737784] font-medium">
          Aplica cuando el producto no tiene precio especial propio. El visitante nunca ve este descuento.
        </span>
        <button
          onClick={handleSaveMemberPct}
          className="ml-auto bg-[#00357f] hover:bg-[#004aad] text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
        >
          Guardar
        </button>
      </div>

      {/* Lens option templates: the editable defaults for the quote assistant */}
      <div className="space-y-4 border-t border-[#e7eeff] pt-4" aria-label="Plantillas de opciones de lente">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Plantillas de opciones de lente</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#737784] font-medium">
            Estos son los recargos que el asistente de cotización ofrece al armar unos lentes
            (tipo de visión y extras). Puede renombrarlos, cambiar su precio, agregar nuevos,
            desactivarlos o quitarlos.
          </p>
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-700">
            Importante: la plantilla solo es el punto de partida de los productos NUEVOS.
            Editarla NO cambia las opciones de los productos que ya existen — cada producto
            guarda las suyas y se editan desde su propio formulario de edición.
          </p>
        </div>

        <LensOptionsEditor value={templateDrafts} onChange={setTemplateDrafts} />

        <div className="flex justify-end">
          <button
            onClick={handleSaveTemplates}
            disabled={savingTemplates}
            className="bg-[#00357f] hover:bg-[#004aad] text-white text-[11px] font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer min-h-[40px]"
          >
            {savingTemplates ? 'Guardando...' : 'Guardar plantillas'}
          </button>
        </div>
      </div>

          </div>
        )}
      </section>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-[#cbd5e1] shadow-sm">
        <div>
          <label className="block text-[10px] font-bold text-[#737784] uppercase tracking-wider mb-1">Categoría</label>
          <select 
            value={productCategoryFilter}
            onChange={(e) => setProductCategoryFilter(e.target.value)}
            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none cursor-pointer font-semibold text-[#111c2d]"
          >
            <option value="all">Todas</option>
            <option value="frames">Armazones</option>
            <option value="lenses">Micas</option>
            <option value="contact_lenses">Lentes de Contacto</option>
            <option value="accessories">Accesorios</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#737784] uppercase tracking-wider mb-1">Marca</label>
          <select 
            value={productBrandFilter}
            onChange={(e) => setProductBrandFilter(e.target.value)}
            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none cursor-pointer font-semibold text-[#111c2d]"
          >
            <option value="all">Todas</option>
            {uniqueBrandsList.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#737784] uppercase tracking-wider mb-1">Estado Stock</label>
          <select 
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none cursor-pointer font-semibold text-[#111c2d]"
          >
            <option value="all">Todos</option>
            <option value="in_stock">En Stock (&gt;4 pz)</option>
            <option value="low_stock">Stock Bajo (1-4 pz)</option>
            <option value="out_of_stock">Agotado (0 pz)</option>
          </select>
        </div>
        <div className="flex items-end">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737784]" />
            <input 
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg py-2 pl-10 pr-3 text-xs focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none text-[#111c2d]" 
              placeholder="Buscar por nombre, nota o SKU..." 
              type="text"
            />
          </div>
        </div>
      </div>

      {/* Products Bento Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-xs text-[#737784] font-bold">Cargando catálogo...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white border border-[#cbd5e1] rounded-2xl text-[#737784] text-xs font-bold shadow-sm">
          No se encontraron productos en el inventario.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(p => {
            const parsed = parseProductDescription(p)
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-[#cbd5e1] shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow text-left">
                <div className="h-48 bg-[#f9f9ff] relative flex items-center justify-center border-b border-[#cbd5e1]/30 p-4">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name}
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <Package className="w-12 h-12 text-[#cbd5e1]" />
                  )}
                  
                  {/* Stock Tag */}
                  <div className={`absolute top-3 right-3 font-bold text-[9px] px-2.5 py-0.5 rounded-full border uppercase ${
                    p.stock === 0 
                      ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffdad6]' 
                      : p.stock < 5 
                      ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffdad6] animate-pulse' 
                      : 'bg-[#49da9f]/20 text-[#00422b] border-[#49da9f]/30'
                  }`}>
                    {p.stock === 0 ? 'Agotado' : p.stock < 5 ? `Stock Bajo: ${p.stock}` : `Stock: ${p.stock}`}
                  </div>

                  {/* Promo Badge */}
                  {p.is_promo && (
                    <div className="absolute bottom-3 left-3 bg-[#00668a] text-white font-bold text-[9px] px-2.5 py-0.5 rounded flex items-center gap-1 shadow-sm uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" /> Promoción
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-[9px] font-black uppercase text-[#00668a] tracking-wider">
                          {p.category === 'frames' && 'Armazones'}
                          {p.category === 'lenses' && 'Micas'}
                          {p.category === 'contact_lenses' && 'Contacto'}
                          {p.category === 'accessories' && 'Accesorios'}
                          {parsed.brand && ` · ${parsed.brand}`}
                        </span>
                        <h3 className="font-bold text-sm text-[#111c2d] truncate mt-0.5" title={p.name}>{p.name}</h3>
                      </div>
                      <span className="font-black text-sm text-[#00357f] font-mono shrink-0 pl-2">{formatPrice(p.price)}</span>
                    </div>
                    
                    {parsed.sku && (
                      <p className="text-[9px] font-mono font-bold text-[#737784] uppercase">SKU: {parsed.sku}</p>
                    )}

                    <p className="text-[#434653] text-xs leading-normal line-clamp-2 min-h-[32px] font-medium pt-1">
                      {parsed.notes || 'Sin descripción disponible.'}
                      {parsed.material && ` (Material: ${parsed.material})`}
                    </p>
                  </div>

                  <div className="flex gap-2 border-t border-[#f0f3ff] pt-3 mt-4">
                    <button 
                      onClick={() => setEditingProduct(p)}
                      className="flex-1 bg-[#dee8ff] hover:bg-[#dee8ff]/80 text-[#00357f] py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button 
                      onClick={() => setDeletingProduct(p)}
                      className="flex-1 border border-[#ba1a1a]/30 hover:bg-[#ffdad6] text-[#ba1a1a] py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================
         MODAL: CREATE PRODUCT
         ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#cbd5e1] flex flex-col max-h-[90vh] text-left">
            <div className="px-6 py-4 border-b border-[#cbd5e1] flex justify-between items-center bg-[#f9f9ff]">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Subir Nuevo Producto</h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#737784] hover:text-[#111c2d] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Product photos: one standard for file, preview and database */}
              <section className="space-y-3 rounded-2xl border border-[#cbd5e1] bg-[#f9f9ff] p-4" aria-label="Fotos del producto">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Fotos del producto</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#737784]">
                    Foto principal + hasta {PRODUCT_IMAGE_MAX_GALLERY_FILES} de galería. Formatos JPG, PNG, WebP o AVIF,
                    máximo 5 MB por foto. Recomendado: {PRODUCT_IMAGE_RECOMMENDED.width}×{PRODUCT_IMAGE_RECOMMENDED.height}px,
                    horizontal {PRODUCT_IMAGE_RECOMMENDED.aspectLabel}, fondo claro y armazón completo.
                  </p>
                </div>

                <div className="relative flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white p-4 text-center transition hover:border-[#00357f] hover:bg-[#dee8ff]/30">
                  <input
                    type="file"
                    accept={PRODUCT_IMAGE_ACCEPT}
                    onChange={handleProductImageSelect}
                    aria-label="Seleccionar foto principal del producto"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  {pImagePreview ? (
                    <img src={pImagePreview} alt="Vista previa de la foto principal" className="max-h-[112px] rounded-lg object-contain" />
                  ) : (
                    <>
                      <Package className="mb-1.5 h-8 w-8 text-[#737784]" />
                      <p className="text-xs font-bold text-[#737784]">Toca o haz clic para elegir la foto principal</p>
                      <p className="mt-1 text-[10px] text-[#737784]">También puedes pegar una URL en el campo siguiente.</p>
                    </>
                  )}
                </div>

                {pPhotoMessage && (
                  <p role={pPhotoMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${pPhotoMessage.type === 'error' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {pPhotoMessage.text}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="create-product-image-url" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">URL de foto principal (opcional)</label>
                    <input id="create-product-image-url" type="url" value={pImageUrl} onChange={(e) => setPImageUrl(e.target.value)} placeholder="https://…" className="min-h-11 w-full rounded-lg border border-[#cbd5e1] bg-white p-2.5 text-xs text-[#111c2d] outline-none focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f]" />
                  </div>
                  <div>
                    <label htmlFor="create-product-image-alt" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">Texto alternativo de la foto</label>
                    <input id="create-product-image-alt" type="text" value={pImageAlt} onChange={(e) => setPImageAlt(e.target.value)} placeholder="Ej. Armazón negro de frente" className="min-h-11 w-full rounded-lg border border-[#cbd5e1] bg-white p-2.5 text-xs text-[#111c2d] outline-none focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f]" />
                  </div>
                </div>

                <div>
                  <label htmlFor="create-product-gallery" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">Fotos de galería (lado, patillas, estuche…)</label>
                  <input id="create-product-gallery" type="file" accept={PRODUCT_IMAGE_ACCEPT} multiple onChange={(e) => handleGalleryImageSelect(e, 'create')} className="w-full cursor-pointer text-xs text-[#737784] file:mr-2 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#dee8ff] file:px-3.5 file:text-xs file:font-bold file:text-[#00357f] hover:file:bg-[#c9d8ff]" />
                  {pGalleryPreviews.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pGalleryPreviews.map((preview, index) => (
                        <div key={preview} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#cbd5e1] bg-white">
                          <img src={preview} alt={`Vista previa de galería ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" aria-label={`Quitar foto de galería ${index + 1}`} onClick={() => {
                            URL.revokeObjectURL(preview)
                            setPGalleryFiles(prev => prev.filter((_, i) => i !== index))
                            setPGalleryPreviews(prev => prev.filter((_, i) => i !== index))
                          }} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#ba1a1a] shadow">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Nombre del Producto *</label>
                  <input 
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                    placeholder="Ej. Ray-Ban Aviator Classic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Marca</label>
                  <input 
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                    placeholder="Ej. Ray-Ban"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Material</label>
                  <input 
                    value={pMaterial}
                    onChange={(e) => setPMaterial(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                    placeholder="Ej. Titanio / Acetato"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Código SKU *</label>
                  <input 
                    required
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px] font-mono uppercase"
                    type="text"
                    placeholder="Ej. OPT-RAY5154"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Categoría *</label>
                  <select 
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value as any)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px] cursor-pointer"
                  >
                    <option value="frames">Armazones</option>
                    <option value="lenses">Micas</option>
                    <option value="contact_lenses">Lentes de Contacto</option>
                    <option value="accessories">Accesorios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Color</label>
                  <input value={pColor} onChange={(e) => setPColor(e.target.value)} className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" type="text" placeholder="Ej. Negro mate" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Forma del armazón</label>
                  <select value={pFrameShape} onChange={(e) => setPFrameShape(e.target.value as FrameShape | '')} className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] cursor-pointer">
                    <option value="">Sin clasificar</option>
                    {FRAME_SHAPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Precio ($) *</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Precio especial a clientes ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pClientPrice}
                    onChange={(e) => setPClientPrice(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    placeholder="Opcional — solo logueados"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Stock Inicial *</label>
                  <input 
                    required
                    type="number"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Descripción / Observaciones</label>
                  <textarea 
                    value={pDescription}
                    onChange={(e) => setPDescription(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] placeholder-[#737784]/60 focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[60px] resize-none"
                    placeholder="Detalles sobre color, estuche, puente visual..."
                  />
                </div>
              </div>

              {/* Lens options for THIS product: born as a template copy,
                  stored per product (frames/lenses only). */}
              {(pCategory === 'frames' || pCategory === 'lenses') && (
                <section className="space-y-3 rounded-2xl border border-[#cbd5e1] bg-[#f9f9ff] p-4" aria-label="Opciones de este lente">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Opciones de este lente</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#737784]">
                      Se precargaron desde la plantilla. Ajústelas a este producto si lo necesita:
                      quedan guardadas SOLO para este lente, sin tocar la plantilla ni otros productos.
                    </p>
                  </div>
                  <LensOptionsEditor value={createOptionDrafts} onChange={setCreateOptionDrafts} />
                </section>
              )}

              {/* Promo Section */}
              <div className="border-t border-[#cbd5e1] pt-4 mt-2 text-xs">
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    type="checkbox"
                    id="hasPromo"
                    checked={pIsPromo}
                    onChange={e => setPIsPromo(e.target.checked)}
                    className="rounded text-[#00357f] focus:ring-[#00357f] cursor-pointer"
                  />
                  <label className="text-xs font-bold text-[#111c2d] cursor-pointer select-none" htmlFor="hasPromo">
                    Habilitar descuento / promoción especial
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isFeatured" checked={pIsFeatured} onChange={e => setPIsFeatured(e.target.checked)} className="rounded text-[#00357f] focus:ring-[#00357f] cursor-pointer" />
                  <label className="text-xs font-bold text-[#111c2d] cursor-pointer select-none" htmlFor="isFeatured">
                    Mostrar en destacados del catálogo
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="min-h-11 px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submittingProduct}
                  className="min-h-11 px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submittingProduct ? 'Añadiendo...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: EDIT PRODUCT
         ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#cbd5e1] flex flex-col max-h-[90vh] text-left">
            <div className="px-6 py-4 border-b border-[#cbd5e1] flex justify-between items-center bg-[#f9f9ff]">
              <h2 className="font-bold text-sm text-[#00357f] uppercase tracking-wider">Modificar Producto</h2>
              <button 
                onClick={() => setEditingProduct(null)}
                className="text-[#737784] hover:text-[#111c2d] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProductSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Nombre del Producto</label>
                  <input 
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Marca</label>
                  <input 
                    value={eBrand}
                    onChange={(e) => setEBrand(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Material</label>
                  <input 
                    value={eMaterial}
                    onChange={(e) => setEMaterial(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Código SKU</label>
                  <input 
                    required
                    value={eSku}
                    onChange={(e) => setESku(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px] font-mono uppercase"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Categoría</label>
                  <select 
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as any })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px] cursor-pointer"
                  >
                    <option value="frames">Armazones</option>
                    <option value="lenses">Micas</option>
                    <option value="contact_lenses">Lentes de Contacto</option>
                    <option value="accessories">Accesorios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Color</label>
                  <input value={eColor} onChange={(e) => setEColor(e.target.value)} className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px]" type="text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Forma del armazón</label>
                  <select value={eFrameShape} onChange={(e) => setEFrameShape(e.target.value as FrameShape | '')} className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[44px] cursor-pointer">
                    <option value="">Sin clasificar</option>
                    {FRAME_SHAPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Precio ($)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Precio especial a clientes ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.client_price ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, client_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                    placeholder="Opcional — solo logueados"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Stock</label>
                  <input 
                    required
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[40px]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Descripción / Observaciones</label>
                  <textarea 
                    value={eNotes}
                    onChange={(e) => setENotes(e.target.value)}
                    className="w-full bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2.5 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[60px] resize-none"
                  />
                </div>
                <div className="md:col-span-2 rounded-2xl border border-[#cbd5e1] bg-[#f9f9ff] p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Fotos del producto</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#737784]">JPG, PNG, WebP o AVIF · máximo 5 MB · recomendado {PRODUCT_IMAGE_RECOMMENDED.width}×{PRODUCT_IMAGE_RECOMMENDED.height}px.</p>
                  </div>
                  {eImagePreview && (
                    <img src={eImagePreview} alt="Foto principal actual" className="h-28 w-full rounded-xl border border-[#cbd5e1] bg-white object-contain p-2" />
                  )}
                  {ePhotoMessage && (
                    <p role={ePhotoMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${ePhotoMessage.type === 'error' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{ePhotoMessage.text}</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="edit-product-file" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">Reemplazar foto principal</label>
                      <input type="file" id="edit-product-file" accept={PRODUCT_IMAGE_ACCEPT} onChange={handleEditImageSelect} className="w-full cursor-pointer text-xs text-[#737784] file:mr-2 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#dee8ff] file:px-3.5 file:text-xs file:font-bold file:text-[#00357f] hover:file:bg-[#c9d8ff]" />
                    </div>
                    <div>
                      <label htmlFor="edit-product-image-alt" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">Texto alternativo</label>
                      <input id="edit-product-image-alt" type="text" value={eImageAlt} onChange={(e) => setEImageAlt(e.target.value)} className="min-h-11 w-full rounded-lg border border-[#cbd5e1] bg-white p-2.5 text-xs text-[#111c2d] outline-none focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f]" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-product-gallery" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#434653]">Agregar fotos a la galería</label>
                    <input id="edit-product-gallery" type="file" accept={PRODUCT_IMAGE_ACCEPT} multiple onChange={(e) => handleGalleryImageSelect(e, 'edit')} className="w-full cursor-pointer text-xs text-[#737784] file:mr-2 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#dee8ff] file:px-3.5 file:text-xs file:font-bold file:text-[#00357f] hover:file:bg-[#c9d8ff]" />
                    {(eGalleryUrls.length > 0 || eGalleryPreviews.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {eGalleryUrls.map((url, index) => (
                          <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#cbd5e1] bg-white">
                            <img src={url} alt={`Foto de galería ${index + 1}`} className="h-full w-full object-cover" />
                            <button type="button" aria-label={`Quitar foto guardada ${index + 1}`} onClick={() => setEGalleryUrls(prev => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#ba1a1a] shadow"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                        {eGalleryPreviews.map((preview, index) => (
                          <div key={preview} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#00357f]/40 bg-white">
                            <img src={preview} alt={`Nueva foto de galería ${index + 1}`} className="h-full w-full object-cover" />
                            <button type="button" aria-label={`Quitar nueva foto ${index + 1}`} onClick={() => {
                              URL.revokeObjectURL(preview)
                              setEGalleryFiles(prev => prev.filter((_, i) => i !== index))
                              setEGalleryPreviews(prev => prev.filter((_, i) => i !== index))
                            }} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#ba1a1a] shadow"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lens options of THIS product only (frames/lenses). */}
              {(editingProduct.category === 'frames' || editingProduct.category === 'lenses') && (
                <section className="space-y-3 rounded-2xl border border-[#cbd5e1] bg-[#f9f9ff] p-4" aria-label="Opciones de este lente">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#00357f]">Opciones de este lente</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#737784]">
                      Estas opciones son SOLO de este producto: cambiarlas no modifica la plantilla
                      ni los demás lentes. Son las que el asistente de cotización ofrece al venderlo.
                    </p>
                  </div>
                  {editOptionsLoadedFor !== editingProduct.id ? (
                    <p className="text-[11px] font-medium text-[#737784]">Cargando opciones del producto...</p>
                  ) : (
                    <>
                      {editOptionDrafts.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setEditOptionDrafts(
                            templateDrafts
                              .filter(t => t.is_active)
                              .map(t => ({ grp: t.grp, name: t.name, price_delta: t.price_delta, sort_order: t.sort_order, is_active: true }))
                          )}
                          className="text-[11px] font-bold text-[#00357f] bg-[#dee8ff] hover:bg-[#c9d8ff] px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                        >
                          Cargar opciones desde la plantilla
                        </button>
                      )}
                      <LensOptionsEditor value={editOptionDrafts} onChange={setEditOptionDrafts} />
                    </>
                  )}
                </section>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-[#cbd5e1] mt-4 text-xs">
                <input
                  type="checkbox"
                  id="editHasPromo"
                  checked={editingProduct.is_promo}
                  onChange={e => setEditingProduct({ ...editingProduct, is_promo: e.target.checked })}
                  className="rounded text-[#00357f] focus:ring-[#00357f] cursor-pointer"
                />
                <label className="text-xs font-bold text-[#111c2d] cursor-pointer select-none" htmlFor="editHasPromo">
                  Producto en promoción especial
                </label>
                <input type="checkbox" id="editIsFeatured" checked={editingProduct.is_featured} onChange={e => setEditingProduct({ ...editingProduct, is_featured: e.target.checked })} className="ml-4 rounded text-[#00357f] focus:ring-[#00357f] cursor-pointer" />
                <label className="text-xs font-bold text-[#111c2d] cursor-pointer select-none" htmlFor="editIsFeatured">
                  Destacado
                </label>
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="min-h-11 px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="min-h-11 px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors shadow-sm cursor-pointer"
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
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-[#cbd5e1] rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 bg-rose-100 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#111c2d] uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-[#434653] leading-normal font-medium">
                ¿Estás seguro de que deseas eliminar <strong>{deletingProduct.name}</strong> del catálogo de la óptica?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 text-xs font-bold text-[#737784] hover:bg-[#dee8ff] py-2.5 rounded-xl border border-[#cbd5e1] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteProduct}
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
