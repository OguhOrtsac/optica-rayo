'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCustomerById } from '@/lib/services'
import ClinicalExamForm from '@/components/clinical-exam-form'
import PageHeader from '@/components/page-header'

interface PageProps {
  params: Promise<{ id: string }>
}

// Exam-from-the-file flow: the customer comes from the route and the
// shared ClinicalExamForm (components/clinical-exam-form.tsx) captures
// and saves the exam, redirecting back here on success. The same form
// powers the bottom-bar quick access (/dashboard/exams/new), where the
// customer is picked first — do not fork the form.
export default function NewExamPage({ params }: PageProps) {
  const { id: customerId } = React.use(params)
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCustomer() {
      try {
        const custData = await getCustomerById(customerId)
        setCustomer(custData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadCustomer()
  }, [customerId])

  if (loading) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#00357f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#737784] font-medium">Cargando expediente del cliente...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen text-[#111c2d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6 text-center py-20">
          <div className="w-16 h-16 bg-[#ffdad6] rounded-full flex items-center justify-center mx-auto text-[#ba1a1a]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#111c2d]">El cliente no fue encontrado</h2>
          <Link href="/customers" className="inline-flex items-center justify-center min-h-[44px] text-sm font-bold text-[#00357f] hover:text-[#00509e] transition-colors">
            Volver a clientes
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header: en móvil solo la etiqueta + volver, y el cliente
            como línea compacta de contexto (PageHeader) */}
        <PageHeader
          title="Nuevo examen"
          mobileActions={
            <Link href={`/customers/${customerId}`} aria-label="Volver a la ficha del cliente" className="w-10 h-10 shrink-0 bg-white hover:bg-[#dee8ff]/30 border border-[#dee8ff] rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-[#434653]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          }
          mobileExtra={
            <p className="text-xs text-[#737784] mt-2.5 font-medium">Cliente: <strong className="text-[#111c2d] font-semibold">{customer.full_name}</strong></p>
          }
        >
          <div className="flex items-center gap-4">
            <Link href={`/customers/${customerId}`} className="w-11 h-11 shrink-0 bg-white hover:bg-[#dee8ff]/30 border border-[#dee8ff] rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-[#434653]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#111c2d]">Nuevo Examen Clínico</h1>
              <p className="text-sm text-[#737784] mt-0.5">Cliente: <strong className="text-[#111c2d] font-semibold">{customer.full_name}</strong></p>
            </div>
          </div>
        </PageHeader>

        <ClinicalExamForm customerId={customerId} />
      </div>
    </main>
  )
}
