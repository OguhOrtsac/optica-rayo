'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage
} from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  
  // Search & Filter states
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all')
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Product Add Form states
  const [pName, setPName] = useState('')
  const [pDescription, setPDescription] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pStock, setPStock] = useState('')
  const [pCategory, setPCategory] = useState<'frames' | 'lenses' | 'contact_lenses' | 'accessories'>('frames')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [pImagePreview, setPImagePreview] = useState<string>('')
  const [submittingProduct, setSubmittingProduct] = useState(false)

  // Edit / Delete states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

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
      await loadProductsData()
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
      // Check if there is a new image selected
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

  // Formatter for prices
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Filter calculations
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.description || '').toLowerCase().includes(productSearch.toLowerCase())
    const matchesCat = productCategoryFilter === 'all' || p.category === productCategoryFilter
    return matchesSearch && matchesCat
  })

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 space-y-6 relative">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        
        {/* Back and Header */}
        <div className="space-y-4">
          <Link
            href="/dashboard/admin"
            className="text-xs font-bold text-slate-500 hover:text-slate-355 transition-colors flex items-center gap-1.5 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel Principal
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Control de Inventario y Catálogo
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Agrega, modifica, ajusta stock y controla las imágenes de los productos en tu catálogo general de óptica.
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
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
                  <div className="mt-3 relative w-16 h-16 rounded-lg overflow-hidden border border-slate-900 bg-slate-955">
                    <img
                      src={pImagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => { setPImageFile(null); setPImagePreview('') }}
                      className="absolute top-0.5 right-0.5 bg-slate-900/80 hover:bg-slate-955 text-rose-450 p-0.5 rounded-full"
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

          {/* Right: Products List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-655 focus:outline-none focus:ring-1 focus:ring-cyan-500 flex-1"
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

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
                <p className="text-xs text-slate-500">Cargando catálogo...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
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
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-955 border border-slate-900 shrink-0">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-955 border border-slate-900 shrink-0 flex items-center justify-center text-slate-600">
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
                        p.stock < 5 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-955 text-slate-500'
                      }`}>
                        Stock: {p.stock} pz
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeletingProduct(p)}
                          className="text-[10px] font-bold text-rose-450 hover:text-rose-400 bg-rose-50/5 border border-rose-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
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

      </div>

      {/* ========================================================
         MODAL: EDIT PRODUCT
         ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
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
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-slate-955 bg-gradient-to-r from-cyan-500 to-indigo-650 hover:from-cyan-400 hover:to-indigo-500 px-5 py-2.5 rounded-xl shadow cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Confirmar Eliminación</h3>
              <p className="text-xs text-slate-400 leading-normal">
                ¿Estás seguro de que deseas eliminar <strong>{deletingProduct.name}</strong> del catálogo de la óptica?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                className="flex-1 text-xs font-bold text-slate-955 bg-gradient-to-r from-rose-500 to-red-650 hover:from-rose-400 hover:to-red-500 py-2.5 rounded-xl shadow cursor-pointer"
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
