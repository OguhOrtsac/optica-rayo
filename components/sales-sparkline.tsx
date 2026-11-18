/**
 * Mini gráfica de línea para la tarjeta «Ventas del mes» del panel:
 * una vista previa CHIQUITA, sin ejes ni etiquetas, de las ventas del
 * mes en curso — línea fina VIOLETA con puntitos en los días con
 * venta, colocados según su día del mes (corrección del dueño,
 * 2026-11-18: la previa va DENTRO de la misma tarjeta, a un ladito,
 * sin hacerla más grande). La serie es la de `getMonthSales` (solo
 * días CON ventas, como la gráfica completa de Finanzas → Ventas del
 * mes, que es a donde lleva la tarjeta).
 *
 * Sin ventas todavía (serie vacía) dibuja solo la línea en cero:
 * un estado vacío discreto, jamás datos inventados.
 */

export interface MonthSparklineDay {
  /** YYYY-MM-DD local. */
  date: string
  total: number
}

const VIOLET = '#7c3aed'

export default function MonthSparkline({ days }: { days: MonthSparklineDay[] }) {
  const W = 96
  const H = 28
  const PAD_X = 4
  const TOP = 4
  const BOTTOM = 24

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const max = Math.max(0, ...sorted.map(d => d.total))

  // El eje x es el mes completo: cada punto cae en su día del mes.
  const [firstYear = 1970, firstMonth = 1] = (sorted[0]?.date ?? '').split('-').map(Number)
  const daysInMonth = new Date(firstYear, firstMonth, 0).getDate() || 30
  const xFor = (date: string) => {
    const day = Number(date.slice(8, 10)) || 1
    return daysInMonth <= 1
      ? W / 2
      : PAD_X + ((day - 1) * (W - PAD_X * 2)) / (daysInMonth - 1)
  }
  const yFor = (total: number) =>
    max > 0 ? BOTTOM - (total / max) * (BOTTOM - TOP) : BOTTOM

  const points = sorted.map(d => ({ ...d, x: xFor(d.date), y: yFor(d.total) }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      role="img"
      aria-label="Vista previa de las ventas del mes"
    >
      {points.length === 0 ? (
        /* Mes sin ventas aún: la línea en cero, discreta. */
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={BOTTOM}
          y2={BOTTOM}
          stroke={VIOLET}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      ) : (
        <>
          {points.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke={VIOLET}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map(p => (
            <circle key={p.date} cx={p.x} cy={p.y} r="2" fill={VIOLET} />
          ))}
        </>
      )}
    </svg>
  )
}
