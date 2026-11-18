/**
 * Mini gráfica de línea para la vista previa «Ventas de la semana»
 * del panel — estilo de la referencia del dueño (2026-11-18): línea
 * VIOLETA viva con puntos huecos de borde grueso, el monto compacto
 * sobre cada punto con venta y las iniciales de los días debajo.
 *
 * SVG propio, sin interacción: es una previa; el detalle completo
 * vive en Finanzas → Ventas del mes. A diferencia de la gráfica del
 * mes (que salta los días sin actividad), la semana se dibuja
 * COMPLETA: los días sin ventas bajan a cero, como en la foto.
 */

export interface SparklineDay {
  /** YYYY-MM-DD local. */
  date: string
  total: number
}

const VIOLET = '#7c3aed'
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

/** $749 · $1.8k · $12k — compacto para que quepa sobre el punto. */
function formatCompactAmount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, '')
    return `$${label}k`
  }
  return `$${Math.round(n)}`
}

function weekdayInitial(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const wd = new Date(y || 1970, (m || 1) - 1, d || 1).getDay()
  return WEEKDAY_INITIALS[wd] ?? ''
}

export default function SalesSparkline({ days }: { days: SparklineDay[] }) {
  const W = 320
  const H = 96
  const PAD_X = 18
  const CHART_TOP = 24
  const CHART_BOTTOM = 64
  const LABELS_Y = 88

  const n = days.length
  const max = Math.max(0, ...days.map(d => d.total))
  const xFor = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1))
  const yFor = (total: number) =>
    max > 0 ? CHART_BOTTOM - (total / max) * (CHART_BOTTOM - CHART_TOP) : CHART_BOTTOM

  const points = days.map((d, i) => ({ ...d, x: xFor(i), y: yFor(d.total) }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full h-auto"
      role="img"
      aria-label={`Ventas de los últimos ${n} días: total ${formatCompactAmount(
        days.reduce((sum, d) => sum + d.total, 0)
      )}`}
    >
      {/* Línea base tenue sobre las iniciales, como en la referencia */}
      <line x1={PAD_X - 6} x2={W - PAD_X + 6} y1={74} y2={74} stroke="#e3e9f4" strokeWidth="1" />
      {points.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke={VIOLET}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map(p => (
        <g key={p.date}>
          {p.total > 0 && (
            <text
              x={p.x}
              y={Math.max(11, p.y - 10)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={VIOLET}
            >
              {formatCompactAmount(p.total)}
            </text>
          )}
          <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke={VIOLET} strokeWidth="2.5" />
          <text
            x={p.x}
            y={LABELS_Y}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#737784"
          >
            {weekdayInitial(p.date)}
          </text>
        </g>
      ))}
    </svg>
  )
}
