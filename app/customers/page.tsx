'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { searchCustomers } from '@/lib/services'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    const data = await searchCustomers(q)
    setCustomers(data)
    setLoading(false)
  }, [])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    const timer = setTimeout(() => load(query), 350)
    return () => clearTimeout(timer)
  }, [query, load])

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const getVisitStatus = (customer: any) => {
    // Check reminders or last exam - simplified check
    return { overdue: false, label: 'Sin examen' }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Background */}
      <div className="fixed top-20 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-10 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-6 relative">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Pacientes
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Busca, consulta y gestiona el expediente de tus clientes.
            </p>
          </div>
          <Link
            href="/customers/new"
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/10 transition-all w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </Link>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
          />
          {loading && (
            <span className="absolute inset-y-0 right-4 flex items-center">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>

        {/* Customer List */}
        {!loading && customers.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              {query ? `No se encontraron clientes con "${query}"` : 'No hay clientes registrados aún.'}
            </p>
            <Link href="/customers/new" className="inline-block text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              Registrar primer cliente →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map(c => {
              const cp = c.customer_profiles
              const dob = cp?.date_of_birth
              const age = dob
                ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                : null

              return (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="flex items-center gap-4 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/60 hover:border-cyan-500/20 rounded-2xl p-4 transition-all group"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-full flex items-center justify-center shrink-0 shadow shadow-cyan-500/10 group-hover:scale-105 transition-transform">
                    <span className="text-xs font-black text-slate-950 select-none">
                      {getInitials(c.full_name)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate group-hover:text-cyan-400 transition-colors">
                      {c.full_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      @{c.email?.replace('@opticarayo.com', '')}
                      {age !== null && ` · ${age} años`}
                      {cp?.phone && ` · ${cp.phone}`}
                    </p>
                  </div>

                  {/* Registered date */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[10px] text-slate-600 font-medium">Registrado</p>
                    <p className="text-xs text-slate-400 font-semibold">{formatDate(c.created_at)}</p>
                  </div>

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-700 pb-4">
          {customers.length} cliente{customers.length !== 1 ? 's' : ''} encontrado{customers.length !== 1 ? 's' : ''}
        </p>
      </div>
    </main>
  )
}
