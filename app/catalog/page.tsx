'use client'

import { useEffect, useState } from 'react'
import { getProducts } from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    async function loadProducts() {
      const data = await getProducts()
      setProducts(data)
      setLoading(false)
    }
    loadProducts()
  }, [])

  // Filter products by search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'frames', label: 'Armazones' },
    { value: 'lenses', label: 'Micas' },
    { value: 'contact_lenses', label: 'Lentes de Contacto' },
    { value: 'accessories', label: 'Accesorios' }
  ]

  // Formatter for prices
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Stock status styling helper
  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Sin Stock
        </span>
      )
    }
    if (stock < 5) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Stock Bajo ({stock})
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Disponible ({stock})
      </span>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Catálogo de Optometría
          </h1>
          <p className="text-sm text-slate-400">
            Descubre nuestra variedad de armazones, micas de alta tecnología y accesorios para tu vista.
          </p>
        </div>

        {/* Search and Filters Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/40 backdrop-blur border border-slate-900 rounded-2xl p-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar armazones, micas o tratamientos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide border transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat.value
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 border-transparent text-slate-950 font-bold shadow shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Grid View */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
            <p className="text-sm text-slate-500 font-medium">Cargando productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/25 border border-dashed border-slate-900 rounded-2xl">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-bold text-slate-400">No se encontraron productos</h3>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/5 group"
              >
                <div className="space-y-4">
                  {/* Category & Stock */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                      {product.category === 'frames' && 'Armazón'}
                      {product.category === 'lenses' && 'Mica'}
                      {product.category === 'contact_lenses' && 'Lente de Contacto'}
                      {product.category === 'accessories' && 'Accesorio'}
                    </span>
                    {getStockBadge(product.stock)}
                  </div>

                  {/* Name and Description */}
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {product.description || 'Sin descripción disponible.'}
                    </p>
                  </div>
                </div>

                {/* Price Label */}
                <div className="mt-6 pt-4 border-t border-slate-950 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Precio</span>
                  <span className="text-xl font-extrabold text-slate-100">
                    {formatPrice(product.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
