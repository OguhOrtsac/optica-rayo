'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getProducts, getSales } from '@/lib/services'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<(Sale & { customer_name?: string; seller_name?: string })[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [productsData, salesData] = await Promise.all([
        getProducts(),
        getSales()
      ])
      setProducts(productsData)
      setSales(salesData)
    } catch (e) {
      showFeedback('error', 'Error al cargar los datos del panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price)
  }

  // Business calculations
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const lowStockCount = products.filter(p => p.stock < 5).length

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 p-4 md:p-8 space-y-8 relative">
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Panel del Dueño
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Gestión integral de clientes, catálogo de inventario, finanzas y personal.
            </p>
          </div>
          
          {/* Quick Stats banner */}
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-400 bg-slate-900/30 border border-slate-900 rounded-xl px-4 py-2">
            <div>
              Ventas: <span className="text-cyan-400 font-bold">{sales.length}</span>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              Ingresos: <span className="text-emerald-400 font-bold">{formatPrice(totalRevenue)}</span>
            </div>
            <div className="w-px bg-slate-800 self-stretch" />
            <div>
              Alerta Stock: <span className={`${lowStockCount > 0 ? 'text-rose-455' : 'text-slate-400'} font-bold`}>{lowStockCount}</span>
            </div>
          </div>
        </div>

        {/* Feedback message */}
        {feedbackMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* Premium Animated Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'summary', label: 'Resumen (General)', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0v-8a2 2 0 00-2-2h-2a2 2 0 00-2 2v8a2 2 0 002 2h2a2 2 0 002-2z', href: '/dashboard/admin', active: true },
            { id: 'customers', label: 'Clientes (Pacientes)', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/dashboard/admin/customers', active: false },
            { id: 'products', label: 'Catálogo (Productos)', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', href: '/dashboard/admin/products', active: false },
            { id: 'users', label: 'Personal (Usuarios)', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', href: '/dashboard/admin/users', active: false }
          ].map(tab => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-300 transform cursor-pointer ${
                tab.active
                  ? 'bg-gradient-to-tr from-cyan-500/15 to-indigo-500/15 border-cyan-500 text-cyan-400 scale-[1.03] shadow-lg shadow-cyan-550/10'
                  : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:scale-[1.02] hover:-translate-y-0.5 text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-6 h-6 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="text-xs font-bold tracking-wide">{tab.label}</span>
            </Link>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-550 border-t-transparent" />
            <p className="text-xs text-slate-500">Recuperando información...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            {/* Inventory stock status card */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Stock del Inventario</h2>
                <span className="text-[10px] text-slate-500 font-bold">{products.length} SKU</span>
              </div>
              <div className="overflow-y-auto max-h-[350px] pr-2 space-y-2.5">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-slate-950/40 border border-slate-900 px-3.5 py-2.5 rounded-xl text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-300 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">
                        {p.category === 'frames' && 'Armazón'}
                        {p.category === 'lenses' && 'Mica'}
                        {p.category === 'contact_lenses' && 'Lente de Contacto'}
                        {p.category === 'accessories' && 'Accesorio'}
                      </p>
                    </div>
                    <div className="text-right pl-3 shrink-0">
                      <p className="font-semibold text-slate-200">{formatPrice(p.price)}</p>
                      <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        p.stock < 5 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {p.stock} pz
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Ledger Card */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Historial de Transacciones</h2>
                <span className="text-[10px] text-slate-500 font-bold">{sales.length} Ventas</span>
              </div>
              <div className="overflow-y-auto max-h-[350px] pr-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500 uppercase font-bold tracking-wider">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Vendedor</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-950">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-350">{s.customer_name || 'Anónimo'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{s.seller_name || 'Staff'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-cyan-400">{formatPrice(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
