'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { isAdminRole, normalizeRole, type AccessRole } from '@/lib/roles'
import BusinessSettingsCard from '@/components/business-settings-card'

// «Datos de la óptica» — su propia página dentro del grupo
// Configuración (dictado del dueño, 2026-11-19: la tarjeta SALIÓ del
// Perfil — «eso quítalo de ahí, y mándalo a Configuración» — y la
// tarjeta misma no cambió: «ese cuadro está bien»).
//
// Solo administrador (owner / super_admin), como siempre: el proxy ya
// cierra /dashboard/admin a esos roles y esta página vuelve a
// resolver el rol de quien mira antes de pintar la tarjeta, con la
// fila de `profiles` como fuente (la misma que lee get_my_role()) y
// la metadata como respaldo. En modo demo no hay sesión que resolver:
// el visor demo es el administrador, como en la Agenda y Productos.

export default function DatosOpticaPage() {
  const [loading, setLoading] = useState(true)
  const [viewerRole, setViewerRole] = useState<AccessRole | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let resolved: AccessRole = 'guest'
      try {
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          let roleValue: string | null = user.user_metadata?.role || null
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()
            if (profile?.role) roleValue = profile.role
          } catch {
            // keep the metadata fallback
          }
          resolved = normalizeRole(roleValue)
        } else if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ) {
          resolved = 'owner'
        }
      } catch {
        // stays 'guest': no business card is painted
      }
      if (!cancelled) {
        setViewerRole(resolved)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-h-screen text-[#111c2d] p-4 md:p-8 space-y-4 max-w-3xl mx-auto pb-24 md:pb-8 text-left">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-2 min-h-[44px] text-[13px] font-semibold text-[#434653] hover:text-[#00357f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel Principal
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00357f] border-t-transparent" />
          <p className="text-[13px] text-[#737784] font-medium">Cargando datos de la óptica...</p>
        </div>
      ) : isAdminRole(viewerRole) ? (
        <BusinessSettingsCard role={viewerRole as string} />
      ) : (
        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] shrink-0" aria-hidden="true">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111c2d]">Sin acceso</h2>
            <p className="text-sm text-[#434653] mt-1 leading-relaxed">
              Los datos de la óptica los modifica <strong>solo el administrador</strong> (dueño).
              Si necesitas cambiar un dato, pídelo al administrador.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
