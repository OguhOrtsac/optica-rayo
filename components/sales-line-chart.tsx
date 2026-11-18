'use client'

import { useEffect, useState } from 'react'

// Gráfica de línea de ventas (SVG propio, sin librerías), compartida
// por las pantallas de administración que muestran ventas por día
// sobre un rango arbitrario (Reportes). Mismo patrón visual que la
// gráfica de Finanzas «Ventas del mes»: un punto SOLO por cada día
// CON ventas — los días sin actividad no se dibujan y la línea salta
// al siguiente día con ventas en vez de bajar a cero — y el monto
// visible sobre cada punto.
//
// Interactiva: tocar (o pulsar con el teclado) un punto lo resalta y
// una línea de detalle bajo la gráfica nombra ese día, cuántas ventas
// tuvo y su total; al pasar el cursor, el título nativo del punto
// muestra la misma información. Las etiquetas llevan día Y mes, así
// un rango que abarca varios meses se sigue leyendo sin ambigüedad.

export interface SalesChartDay {
  date: string
  total: number
  count?: number
}

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

const moneyCompact = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function formatDayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatDayFull(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SalesLineChart({ days }: { days: SalesChartDay[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  // A new range brings new days: any previous point pick is dropped.
  useEffect(() => {
    setSelected(null)
  }, [days])

  const W = 720
  const H = 280
  const PAD_X = 44
  const TOP = 40
  const BOTTOM = 36
  const max = Math.max(0, ...days.map(d => d.total))

  const xFor = (i: number) =>
    days.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (days.length - 1)
  const yFor = (total: number) =>
    max > 0 ? TOP + (1 - total / max) * (H - TOP - BOTTOM) : (TOP + H - BOTTOM) / 2

  const points = days.map((d, i) => ({ ...d, x: xFor(i), y: yFor(d.total) }))
  const line = points.map(p => `${p.x},${p.y}`).join(' ')
  const selectedDay = days.find(d => d.date === selected) ?? null

  const toggleSelected = (date: string) =>
    setSelected(prev => (prev === date ? null : date))

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Gráfica de ventas por día: ${days
          .map(d => `${formatDayShort(d.date)} ${moneyCompact.format(d.total)}`)
          .join(', ')}`}
      >
        {/* Eje base */}
        <line x1={PAD_X - 16} x2={W - PAD_X + 16} y1={H - BOTTOM} y2={H - BOTTOM} stroke="#cbd5e1" strokeWidth="1.5" />
        {points.length > 1 && (
          <polyline points={line} fill="none" stroke="#00357f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p, i) => {
          const anchor = days.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
          // En pantallas chicas la gráfica se escala y las etiquetas de
          // monto de puntos vecinos se amontonan: con varios puntos se
          // alterna la altura de la etiqueta y se le da un halo blanco
          // para que se lea aunque se acerque a otra.
          const wantedLift = points.length > 3 && i % 2 === 1 ? 32 : 15
          // El punto más alto vive en el borde superior: su etiqueta no
          // puede subir más allá del lienzo.
          const labelLift = p.y - wantedLift < 16 ? 15 : wantedLift
          const isSelected = selected === p.date
          return (
            <g key={p.date}>
              <text
                x={p.x}
                y={p.y - labelLift}
                textAnchor={anchor}
                fontSize="14"
                fontWeight="800"
                fill="#00357f"
                stroke="#ffffff"
                strokeWidth="3.5"
                style={{ paintOrder: 'stroke' }}
              >
                {moneyCompact.format(p.total)}
              </text>
              {isSelected && (
                <circle cx={p.x} cy={p.y} r="11" fill="none" stroke="#0899c9" strokeWidth="2" />
              )}
              <circle cx={p.x} cy={p.y} r="6" fill={isSelected ? '#00357f' : '#0899c9'} stroke="#ffffff" strokeWidth="2.5" />
              {/* Zona de toque amplia e invisible: el punto visible es
                  chico para un dedo, así que el área útil es mayor. */}
              <circle
                cx={p.x}
                cy={p.y}
                r="18"
                fill="transparent"
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Ver detalle del ${formatDayFull(p.date)}: ${money.format(p.total)}`}
                aria-pressed={isSelected}
                onClick={() => toggleSelected(p.date)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleSelected(p.date)
                  }
                }}
              >
                <title>{`${formatDayFull(p.date)} · ${money.format(p.total)}`}</title>
              </circle>
              <text x={p.x} y={H - BOTTOM + 24} textAnchor={anchor} fontSize="12.5" fontWeight="600" fill="#737784">
                {formatDayShort(p.date)}
              </text>
            </g>
          )
        })}
      </svg>

      {selectedDay ? (
        <p className="mt-2 text-xs font-bold text-[#00357f]" role="status">
          <span className="capitalize">{formatDayFull(selectedDay.date)}</span>
          {typeof selectedDay.count === 'number' && (
            <> · {selectedDay.count} {selectedDay.count === 1 ? 'venta' : 'ventas'}</>
          )}
          <> · {money.format(selectedDay.total)}</>
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[#737784] font-semibold">
          Toca un punto para ver el detalle de ese día.
        </p>
      )}
    </div>
  )
}
