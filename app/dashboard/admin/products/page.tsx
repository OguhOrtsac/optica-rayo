'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage
} from '@/lib/services'
import { Database } from '@/types/database.types'
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
  Tag
} from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

// Helper to parse description JSON structure safely
function parseProductDescription(desc: string | null) {
  const result = {
    brand: '',
    material: '',
    sku: '',
    notes: ''
  }
  if (!desc) return result
  const trimmed = desc.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      return {
        brand: parsed.brand || '',
        material: parsed.material || '',
        sku: parsed.sku || '',
        notes: parsed.notes || ''
      }
    } catch (_) {
      // Ignore JSON error and treat as plain text
    }
  }
  result.notes = desc
  return result
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
  const [pIsPromo, setPIsPromo] = useState(false)
  const [pIsFeatured, setPIsFeatured] = useState(false)
  const [submittingProduct, setSubmittingProduct] = useState(false)

  // Edit / Delete states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // States for Editing forms
  const [eBrand, setEBrand] = useState('')
  const [eMaterial, setEMaterial] = useState('')
  const [eSku, setESku] = useState('')
  const [eNotes, setENotes] = useState('')

  const loadProductsData = async () => {
    try {
      setLoading(true)
      const data = await getProducts()
      setProducts(data)
    } catch (e) {
      showFeedback('error', 'Error al cargar los productos del inventario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProductsData()
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
        pImagePreview && URL.revokeObjectURL(pImagePreview)
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

      // Serialize brand, material, sku, notes inside the description
      const serializedDescription = JSON.stringify({
        brand: pBrand.trim(),
        material: pMaterial.trim(),
        sku: pSku.trim(),
        notes: pDescription.trim()
      })

      await createProduct({
        name: pName,
        description: serializedDescription,
        price: parseFloat(pPrice),
        stock: parseInt(pStock),
        category: pCategory,
        image_url: imageUrl,
        is_promo: pIsPromo,
        is_featured: pIsFeatured
      })

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
      setPIsPromo(false)
      setPIsFeatured(false)
      setIsCreateModalOpen(false)
      await loadProductsData()
    } catch (e) {
      showFeedback('error', 'Error al registrar el producto.')
    } finally {
      setSubmittingProduct(false)
    }
  }

  // Set initial edit state when product is selected
  useEffect(() => {
    if (editingProduct) {
      const parsed = parseProductDescription(editingProduct.description)
      setEBrand(parsed.brand)
      setEMaterial(parsed.material)
      setESku(parsed.sku)
      setENotes(parsed.notes)
    } else {
      setEBrand('')
      setEMaterial('')
      setESku('')
      setENotes('')
    }
  }, [editingProduct])

  // Update Product Submit
  const handleUpdateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    try {
      let finalImageUrl = editingProduct.image_url
      const fileInput = document.getElementById('edit-product-file') as HTMLInputElement
      if (fileInput && fileInput.files && fileInput.files[0]) {
        finalImageUrl = await uploadProductImage(fileInput.files[0])
      }

      // Serialize edit fields inside description
      const serializedDescription = JSON.stringify({
        brand: eBrand.trim(),
        material: eMaterial.trim(),
        sku: eSku.trim(),
        notes: eNotes.trim()
      })

      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: serializedDescription,
        price: editingProduct.price,
        stock: editingProduct.stock,
        category: editingProduct.category,
        image_url: finalImageUrl,
        is_promo: editingProduct.is_promo,
        is_featured: editingProduct.is_featured
      })

      showFeedback('success', 'Producto actualizado correctamente.')
      setEditingProduct(null)
      await loadProductsData()
    } catch (e) {
      showFeedback('error', 'Fallo al actualizar el producto.')
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
      const parsed = parseProductDescription(p.description)
      if (parsed.brand) {
        list.add(parsed.brand)
      }
    })
    return Array.from(list).sort()
  }, [products])

  // Filter calculations
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const parsed = parseProductDescription(p.description)
      
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e7eeff] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-[#dee8ff] text-[#434653] transition-colors">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#00357f] tracking-tight">Inventario y Productos</h1>
          </div>
          <p className="text-sm text-[#434653] mt-1 font-medium pl-9">Gestione su catálogo de armazones, lentes y accesorios.</p>
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
            const parsed = parseProductDescription(p.description)
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
              {/* Image Upload Preview */}
              <div className="border-2 border-dashed border-[#cbd5e1] rounded-xl p-4 flex flex-col items-center justify-center bg-[#f0f3ff] hover:bg-[#dee8ff]/40 transition-colors cursor-pointer relative min-h-[120px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {pImagePreview ? (
                  <img 
                    src={pImagePreview} 
                    alt="Preview" 
                    className="max-h-[100px] object-contain rounded-lg"
                  />
                ) : (
                  <>
                    <Package className="w-8 h-8 text-[#737784] mb-1.5" />
                    <p className="text-xs text-[#737784] text-center font-bold">
                      Haga clic o arrastre una imagen aquí<br/>
                      <span className="text-[10px] text-slate-400 font-normal">JPG, PNG, WebP (Max 5MB)</span>
                    </p>
                  </>
                )}
              </div>

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
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#737784] hover:bg-[#dee8ff] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submittingProduct}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#00357f] hover:bg-[#004aad] text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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
                <div>
                  <label className="block text-xs font-bold text-[#434653] uppercase tracking-wider mb-2">Actualizar Foto del Producto</label>
                  <input 
                    type="file"
                    id="edit-product-file"
                    accept="image/*"
                    className="w-full text-xs text-[#737784] file:mr-2 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#dee8ff] file:text-[#00357f] hover:file:bg-[#dee8ff]/80 cursor-pointer"
                  />
                </div>
              </div>

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
              </div>

              <div className="px-6 py-4 border-t border-[#cbd5e1] flex justify-end gap-2 bg-[#f9f9ff] -mx-6 -mb-6">
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
