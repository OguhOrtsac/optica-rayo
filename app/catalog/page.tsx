'use client'

import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  // Advanced Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [priceLimit, setPriceLimit] = useState<number>(10000)
  const [sortBy, setSortBy] = useState<string>('recommended')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid')
  
  // Selected product for detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true)
        const data = await getProducts()
        setProducts(data)
        
        // Dynamically set price limit to the max product price
        if (data.length > 0) {
          const maxP = Math.max(...data.map(p => p.price))
          setPriceLimit(Math.ceil(maxP))
        }
      } catch (e) {
        console.error('Error loading products:', e)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  // Categories definition
  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'frames', label: 'Armazones' },
    { value: 'lenses', label: 'Micas' },
    { value: 'contact_lenses', label: 'Lentes de Contacto' },
    { value: 'accessories', label: 'Accesorios' }
  ]

  // Calculate dynamic maximum price in catalog
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

  // Reset all filters to default
  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setPriceLimit(absoluteMaxPrice)
    setSortBy('recommended')
    setOnlyAvailable(false)
  }

  // Filter and Sort execution
  const processedProducts = useMemo(() => {
    let result = products.filter(product => {
      // Search term match
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (product.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      // Category match
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
      
      // Price limit match
      const matchesPrice = product.price <= priceLimit
      
      // Availability match
      const matchesAvailability = !onlyAvailable || product.stock > 0

      return matchesSearch && matchesCategory && matchesPrice && matchesAvailability
    })

    // Sort match
    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [products, searchTerm, selectedCategory, priceLimit, sortBy, onlyAvailable])

  // Format price helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // WhatsApp Link Helper
  const getWhatsAppLink = (product: Product) => {
    const phoneNumber = '521234567890' // Mock WhatsApp Business Number
    const message = encodeURIComponent(
      `¡Hola! Estoy interesado en el producto del catálogo:\n\n*Nombre:* ${product.name}\n*Precio:* ${formatPrice(product.price)}\n*Categoría:* ${
        product.category === 'frames' ? 'Armazón' : product.category === 'lenses' ? 'Micas' : product.category === 'contact_lenses' ? 'Lentes de Contacto' : 'Accesorio'
      }\n\n¿Tienen disponibilidad para una prueba o cita de examen de vista?`
    )
    return `https://wa.me/${phoneNumber}?text=${message}`
  }

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 relative">
      {/* Visual background glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative">
        
        {/* Banner de Bienvenida */}
        <div className="bg-gradient-to-r from-slate-900/60 to-indigo-950/20 border border-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Catálogo de Especialidades Ópticas
            </h1>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Explora nuestra gama premium de lentes oftálmicos, armazones de marcas de diseñador, micas antirreflejantes de última tecnología y soluciones de contacto.
            </p>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 text-center shrink-0">
            <p className="text-[10px] uppercase font-black text-cyan-400 tracking-widest mb-1">Examen de Vista Gratis</p>
            <p className="text-xs text-slate-300 font-medium">Al adquirir tus lentes graduados</p>
          </div>
        </div>

        {/* Layout Grid (Filtros Sidebar + Listado) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* 1. Sidebar de Filtros (Mobile Colapsable u Horizontal en pantallas pequeñas) */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 space-y-6 lg:sticky lg:top-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-950">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">Filtros de Búsqueda</h2>
              <button
                onClick={handleResetFilters}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Limpiar Todo
              </button>
            </div>

            {/* Categorías */}
            <div className="space-y-3">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-450">Categoría</label>
              <div className="flex flex-col gap-1.5">
                {categories.map(cat => {
                  const count = categoryCounts[cat.value] || 0
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`flex justify-between items-center px-3.5 py-2 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                        selectedCategory === cat.value
                          ? 'bg-gradient-to-tr from-cyan-500/15 to-indigo-500/15 border-cyan-500 text-cyan-400'
                          : 'bg-slate-950/40 border-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[10px] opacity-60">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Rango de Precios */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-450">
                <label>Precio Máximo</label>
                <span className="text-cyan-400 text-xs font-black">{formatPrice(priceLimit)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={absoluteMaxPrice}
                step="100"
                value={priceLimit}
                onChange={e => setPriceLimit(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                <span>$0</span>
                <span>{formatPrice(absoluteMaxPrice)}</span>
              </div>
            </div>

            {/* Disponibilidad Checkbox */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-950 rounded-xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-300">Solo Disponibles</p>
                <p className="text-[9px] text-slate-500">Ocultar artículos sin stock</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={e => setOnlyAvailable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-955"></div>
              </label>
            </div>
          </div>

          {/* 2. Sección Principal de Resultados */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Barra superior de Búsqueda, Orden y Layout */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              
              {/* Buscador */}
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar por nombre, marca, material..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-655 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Controles del listado */}
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                
                {/* Selector de Orden */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="recommended">Recomendados</option>
                  <option value="price_asc">Precio: Menor a Mayor</option>
                  <option value="price_desc">Precio: Mayor a Menor</option>
                  <option value="name_asc">Nombre: A-Z</option>
                </select>

                {/* Alternador de Layout Grid/List */}
                <div className="flex bg-slate-955 border border-slate-900 rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => setLayoutMode('grid')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      layoutMode === 'grid'
                        ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Vista Cuadrícula"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setLayoutMode('list')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      layoutMode === 'list'
                        ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Vista Lista"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>

              </div>
            </div>

            {/* Resultados / Spinner */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-550 border-t-transparent" />
                <p className="text-xs text-slate-500">Recuperando catálogo...</p>
              </div>
            ) : processedProducts.length === 0 ? (
              <div className="text-center py-28 bg-slate-900/15 border border-slate-900 rounded-3xl space-y-3">
                <div className="w-12 h-12 bg-slate-950 border border-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-300">No se encontraron artículos</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-normal">
                    Prueba a limpiar tus filtros o ingresa un término de búsqueda diferente.
                  </p>
                </div>
              </div>
            ) : layoutMode === 'grid' ? (
              
              /* GRID LAYOUT */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                {processedProducts.map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-900/30 border border-slate-900/60 hover:border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/5 group relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      {/* Product Image / Category Icon */}
                      {p.image_url ? (
                        <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-955 border border-slate-900 shrink-0 relative">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-40 rounded-xl bg-slate-955 border border-slate-900 shrink-0 flex items-center justify-center text-slate-655 relative">
                          <svg className="w-12 h-12 opacity-40 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      )}

                      {/* Header tags */}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider">
                          {p.category === 'frames' && 'Armazón'}
                          {p.category === 'lenses' && 'Mica'}
                          {p.category === 'contact_lenses' && 'Lente de Contacto'}
                          {p.category === 'accessories' && 'Accesorio'}
                        </span>
                        
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                          p.stock === 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          p.stock < 5 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {p.stock === 0 ? 'Agotado' : p.stock < 5 ? `Pocas pz (${p.stock})` : 'Disponible'}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                          {p.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                          {p.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-950 pt-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Precio</p>
                        <p className="font-black text-slate-100 text-sm">{formatPrice(p.price)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                        >
                          Ver Detalle
                        </button>
                        <a
                          href={getWhatsAppLink(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-400 hover:to-teal-500 text-slate-955 font-bold text-[10px] px-3.5 py-2 rounded-xl shadow cursor-pointer whitespace-nowrap"
                        >
                          📞 Consultar
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              
              /* LIST LAYOUT */
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                {processedProducts.map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-900/30 border border-slate-900/60 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between hover:border-cyan-500/20 transition-all group"
                  >
                    <div className="flex gap-4 items-center w-full sm:w-auto">
                      {p.image_url ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-955 border border-slate-900 shrink-0">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-955 border border-slate-900 shrink-0 flex items-center justify-center text-slate-655">
                          <svg className="w-7 h-7 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-black uppercase text-cyan-400 tracking-wider">
                            {p.category === 'frames' && 'Armazón'}
                            {p.category === 'lenses' && 'Mica'}
                            {p.category === 'contact_lenses' && 'Lente de Contacto'}
                            {p.category === 'accessories' && 'Accesorio'}
                          </span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            p.stock === 0 ? 'bg-rose-500/10 text-rose-455 border border-rose-500/20' :
                            p.stock < 5 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {p.stock === 0 ? 'Agotado' : p.stock < 5 ? `Pocas pz (${p.stock})` : 'Disponible'}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors truncate mt-1">
                          {p.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 line-clamp-1 leading-normal">
                          {p.description || 'Sin descripción.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-slate-950 pt-3 sm:pt-0 shrink-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Precio</p>
                        <p className="font-black text-cyan-455 text-sm sm:text-base">{formatPrice(p.price)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                        >
                          Ver Detalle
                        </button>
                        <a
                          href={getWhatsAppLink(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-400 hover:to-teal-500 text-slate-955 font-bold text-[10px] px-3.5 py-2 rounded-xl shadow cursor-pointer"
                        >
                          📞 Consultar
                        </a>
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
         MODAL: DETALLE DEL PRODUCTO (QUICK VIEW)
         ======================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            
            {/* Modal Image Header */}
            {selectedProduct.image_url ? (
              <div className="w-full h-56 rounded-2xl overflow-hidden bg-slate-955 border border-slate-950 relative">
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-44 rounded-2xl bg-slate-955 border border-slate-950 flex items-center justify-center text-slate-655">
                <svg className="w-14 h-14 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            )}

            {/* Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest bg-slate-955 px-2.5 py-1 rounded border border-slate-950">
                  {selectedProduct.category === 'frames' ? 'Armazón Oftálmico' :
                   selectedProduct.category === 'lenses' ? 'Mica Graduada' :
                   selectedProduct.category === 'contact_lenses' ? 'Lente de Contacto' : 'Accesorio'}
                </span>
                
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded ${
                  selectedProduct.stock === 0 ? 'bg-rose-500/10 text-rose-455 border border-rose-500/20' :
                  selectedProduct.stock < 5 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {selectedProduct.stock === 0 ? 'Agotado Temporalmente' :
                   selectedProduct.stock < 5 ? `Últimas Piezas (${selectedProduct.stock})` : 'En Existencia'}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-100">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-450 leading-relaxed bg-slate-955/50 border border-slate-950/40 p-4 rounded-2xl whitespace-pre-wrap">
                  {selectedProduct.description || 'Este artículo premium de optometría no cuenta con una descripción detallada en este momento. Si deseas conocer especificaciones sobre graduación, materiales o tratamientos, por favor consulta directamente.'}
                </p>
              </div>

              {/* Price & Action Row */}
              <div className="flex justify-between items-center bg-slate-955/50 border border-slate-950/40 p-4 rounded-2xl">
                <div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Precio Sugerido</p>
                  <p className="text-2xl font-black text-cyan-455">{formatPrice(selectedProduct.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Garantía Óptica</p>
                  <p className="text-xs text-slate-300 font-semibold">1 Año de Fábrica</p>
                </div>
              </div>
            </div>

            {/* Actions buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-955 border border-slate-900 py-3 rounded-xl cursor-pointer"
              >
                Cerrar Detalle
              </button>
              <a
                href={getWhatsAppLink(selectedProduct)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-400 hover:to-teal-500 text-slate-955 font-bold text-xs py-3 rounded-xl shadow cursor-pointer"
              >
                📞 Preguntar Disponibilidad
              </a>
            </div>

          </div>
        </div>
      )}

    </main>
  )
}
