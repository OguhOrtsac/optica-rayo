import type { ReactNode } from 'react'

/**
 * Encabezado de página — dictado del dueño (2026-11-18, con foto):
 * en MÓVIL el bloque grande de título + descripción robaba mucho alto
 * en TODAS las ventanas, así que desaparece y en su lugar queda solo
 * una etiqueta chiquita en la esquina superior derecha del contenido
 * con el nombre de la ventana, parpadeando suave para distinguirse.
 * En ESCRITORIO (md:) el encabezado se pinta EXACTAMENTE como antes:
 * los `children` son el bloque original de cada página, sin tocar.
 *
 * Uso:
 *   <PageHeader title="Realizar Venta" mobileActions={...}>
 *     { bloque de encabezado de escritorio, tal cual estaba }
 *   </PageHeader>
 *
 * - `mobileActions`: elementos que en escritorio viven dentro del
 *   encabezado y en móvil deben seguir accesibles (enlace de volver,
 *   etc.). Se pintan compactos a la izquierda de la etiqueta.
 * - `mobileExtra`: contenido compacto bajo la etiqueta en móvil
 *   (botones de acción de la página, líneas de contexto como
 *   «Cliente: …»).
 * - `mobileClassName`: clases extra del contenedor móvil (p. ej. el
 *   margen inferior que el encabezado daba al contenido cuando el
 *   padre no usa space-y).
 *
 * La etiqueta va EN EL FLUJO (no fija): al hacer scroll se va con el
 * contenido, no flota encima. La animación se apaga con
 * `prefers-reduced-motion` (regla global en globals.css).
 */
interface PageHeaderProps {
  title: string
  mobileActions?: ReactNode
  mobileExtra?: ReactNode
  mobileClassName?: string
  children: ReactNode
}

export default function PageHeader({
  title,
  mobileActions,
  mobileExtra,
  mobileClassName = '',
  children
}: PageHeaderProps) {
  return (
    <>
      {/* Móvil: etiqueta chiquita arriba a la derecha + accesos compactos */}
      <div className={`md:hidden ${mobileClassName}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">{mobileActions}</div>
          <span className="anim-blink-soft inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#00357f]/10 bg-[#dee8ff] px-2.5 py-1 text-[11px] font-bold leading-none text-[#00357f] shadow-sm">
            <span
              aria-hidden="true"
              className="anim-pulse-soft h-1.5 w-1.5 shrink-0 rounded-full bg-[#0899c9]"
            />
            {title}
          </span>
        </div>
        {mobileExtra}
      </div>

      {/* Escritorio: el encabezado original, intacto */}
      <div className="hidden md:block">{children}</div>
    </>
  )
}
