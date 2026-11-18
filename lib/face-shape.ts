/**
 * Forma del rostro y recomendación de armazones — lógica PURA.
 *
 * Sin dependencias de UI ni de MediaPipe: recibe los landmarks ya
 * detectados (468 puntos del Face Landmarker) y clasifica la forma
 * del rostro con proporciones medidas entre puntos clave. El escáner
 * (components/face-scanner.tsx) es quien captura y alimenta esto.
 *
 * CONTRATO DE COORDENADAS: los puntos deben venir en un espacio
 * UNIFORME (misma escala en X y en Y). MediaPipe entrega coordenadas
 * normalizadas por eje (x sobre el ancho, y sobre el alto del video),
 * así que quien llama debe corregir el aspecto antes de clasificar
 * (el escáner multiplica x por videoWidth/videoHeight). Sin esa
 * corrección, la razón largo/ancho saldría deformada.
 *
 * Landmarks usados (índices del Face Mesh de MediaPipe):
 *   10  parte alta de la frente (nacimiento del cabello)
 *   152 mentón
 *   234 / 454 pómulos (izquierdo / derecho)
 *   172 / 397 mandíbula (izquierdo / derecho)
 *   71  / 301 frente (izquierdo / derecho)
 */

export type FaceShape =
  | 'ovalada'
  | 'redonda'
  | 'cuadrada'
  | 'corazon'
  | 'diamante'
  | 'alargada'

/**
 * Formas de armazón en el vocabulario de ESTA lógica (español).
 * OJO: la columna products.frame_shape vive desde la migración
 * 20261109 con vocabulario en inglés ('round', 'square', ...) y un
 * CHECK en la base que lo impone; el puente entre ambos vocabularios
 * es PRODUCT_FRAME_SHAPE_VALUE, más abajo — es el ÚNICO lugar donde
 * se traducen.
 */
export type FrameShape =
  | 'rectangular'
  | 'cuadrado'
  | 'redondo'
  | 'ovalado'
  | 'aviador'
  | 'ojo_de_gato'

export interface LandmarkPoint {
  x: number
  y: number
}

export const FRAME_SHAPE_LABELS: Record<FrameShape, string> = {
  rectangular: 'Rectangular',
  cuadrado: 'Cuadrado',
  redondo: 'Redondo',
  ovalado: 'Ovalado',
  aviador: 'Aviador',
  ojo_de_gato: 'Ojo de gato',
}

const LM = {
  top: 10,
  chin: 152,
  cheekL: 234,
  cheekR: 454,
  jawL: 172,
  jawR: 397,
  foreheadL: 71,
  foreheadR: 301,
} as const

function dist(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export interface FaceMeasurements {
  /** Largo del rostro (10 → 152). */
  length: number
  /** Ancho en pómulos (234 → 454) — la referencia (denominador). */
  cheekWidth: number
  /** Ancho de mandíbula (172 → 397). */
  jawWidth: number
  /** Ancho de frente (71 → 301). */
  foreheadWidth: number
  /** largo / pómulos */
  lengthRatio: number
  /** mandíbula / pómulos */
  jawRatio: number
  /** frente / pómulos */
  foreheadRatio: number
}

/** Mide las proporciones del rostro a partir de los landmarks. */
export function measureFaceShape(points: ArrayLike<LandmarkPoint>): FaceMeasurements {
  const length = dist(points[LM.top], points[LM.chin])
  const cheekWidth = dist(points[LM.cheekL], points[LM.cheekR])
  const jawWidth = dist(points[LM.jawL], points[LM.jawR])
  const foreheadWidth = dist(points[LM.foreheadL], points[LM.foreheadR])
  const safeCheek = cheekWidth > 0 ? cheekWidth : 1
  return {
    length,
    cheekWidth,
    jawWidth,
    foreheadWidth,
    lengthRatio: length / safeCheek,
    jawRatio: jawWidth / safeCheek,
    foreheadRatio: foreheadWidth / safeCheek,
  }
}

/**
 * Clasifica la forma del rostro. Las reglas se evalúan EN ORDEN —
 * las formas más distintivas primero — y el respaldo es 'ovalada'
 * (la forma equilibrada: ninguna proporción se sale del rango).
 *
 *   1. alargada: el rostro es mucho más largo que ancho
 *      (largo/ancho ≥ 1.45).
 *   2. corazon: la frente es la parte más ancha (frente/pómulos
 *      ≥ 0.98) y la mandíbula es estrecha (mandíbula/pómulos ≤ 0.78):
 *      mucho arriba, poco abajo.
 *   3. diamante: los pómulos mandan — frente Y mandíbula estrechas
 *      (ambas ≤ 0.82 de los pómulos).
 *   4. cuadrada: mandíbula casi tan ancha como los pómulos
 *      (≥ 0.88) en un rostro no muy largo (largo/ancho ≤ 1.30):
 *      ángulos marcados arriba y abajo.
 *   5. redonda: rostro corto (largo/ancho ≤ 1.18) sin mandíbula
 *      estrecha (≥ 0.80): curvas parejas, sin ángulos.
 *   6. ovalada: proporciones equilibradas, ningún extremo anterior.
 */
export function classifyFaceShape(points: ArrayLike<LandmarkPoint>): FaceShape {
  const m = measureFaceShape(points)

  if (m.lengthRatio >= 1.45) return 'alargada'
  if (m.foreheadRatio >= 0.98 && m.jawRatio <= 0.78) return 'corazon'
  if (m.foreheadRatio <= 0.82 && m.jawRatio <= 0.82) return 'diamante'
  if (m.jawRatio >= 0.88 && m.lengthRatio <= 1.3) return 'cuadrada'
  if (m.lengthRatio <= 1.18 && m.jawRatio >= 0.8) return 'redonda'
  return 'ovalada'
}

export interface FaceShapeInfo {
  /** Nombre visible: «Ovalada», «Redonda», … */
  label: string
  /** Una frase corta que describe la forma. */
  description: string
  /** Formas de armazón recomendadas para esta forma de rostro. */
  recommendedFrames: FrameShape[]
  /** Una frase de consejo para el cliente. */
  tip: string
}

export const FACE_SHAPE_INFO: Record<FaceShape, FaceShapeInfo> = {
  ovalada: {
    label: 'Ovalada',
    description: 'Proporciones equilibradas: ni muy larga ni muy ancha, con la mandíbula suave.',
    recommendedFrames: ['rectangular', 'cuadrado', 'aviador', 'ojo_de_gato'],
    tip: 'Casi todo le queda: es la forma más versátil. Solo evite armazones demasiado grandes que rompan el equilibrio.',
  },
  redonda: {
    label: 'Redonda',
    description: 'Rostro corto y de curvas suaves, con mejillas llenas y sin ángulos marcados.',
    recommendedFrames: ['rectangular', 'cuadrado'],
    tip: 'Los armazones con ángulos le dan definición y hacen que el rostro se vea más estilizado.',
  },
  cuadrada: {
    label: 'Cuadrada',
    description: 'Frente y mandíbula anchas y marcadas: un rostro de ángulos fuertes.',
    recommendedFrames: ['redondo', 'ovalado', 'aviador'],
    tip: 'Las formas redondeadas suavizan la mandíbula y equilibran los ángulos de su rostro.',
  },
  corazon: {
    label: 'Corazón',
    description: 'Frente ancha que se va estrechando hasta un mentón fino y delicado.',
    recommendedFrames: ['aviador', 'ojo_de_gato', 'redondo'],
    tip: 'Los armazones con peso visual en la parte baja equilibran la frente y acompañan su mentón.',
  },
  diamante: {
    label: 'Diamante',
    description: 'Pómulos anchos y marcados, con la frente y la mandíbula más estrechas.',
    recommendedFrames: ['ovalado', 'ojo_de_gato', 'aviador'],
    tip: 'Las formas suaves destacan sus pómulos sin competir con ellos; evite armazones muy angostos.',
  },
  alargada: {
    label: 'Alargada',
    description: 'Rostro notablemente más largo que ancho, de líneas parejas.',
    recommendedFrames: ['aviador', 'cuadrado', 'redondo'],
    tip: 'Los armazones anchos y altos acortan visualmente el rostro y le dan proporción.',
  },
}

/** Orden estable para mostrar las 6 formas (selector manual). */
export const FACE_SHAPES: FaceShape[] = [
  'ovalada',
  'redonda',
  'cuadrada',
  'corazon',
  'diamante',
  'alargada',
]

/**
 * Puente al vocabulario REAL de la columna products.frame_shape
 * (inglés, fijado por la migración 20261109 y su CHECK en la base).
 * La lógica de recomendación habla español; la base, inglés. Esta
 * tabla es el único lugar donde se cruzan.
 */
export const PRODUCT_FRAME_SHAPE_VALUE: Record<FrameShape, string> = {
  rectangular: 'rectangular',
  cuadrado: 'square',
  redondo: 'round',
  ovalado: 'oval',
  aviador: 'aviator',
  ojo_de_gato: 'cat_eye',
}

/** Valores de products.frame_shape recomendados para una forma de rostro. */
export function recommendedProductFrameValues(shape: FaceShape): string[] {
  return FACE_SHAPE_INFO[shape].recommendedFrames.map(fs => PRODUCT_FRAME_SHAPE_VALUE[fs])
}

/**
 * ¿El frame_shape guardado de un producto (vocabulario de la base)
 * está entre los recomendados para esta forma de rostro?
 */
export function productFrameMatchesShape(
  productFrameShape: string | null | undefined,
  shape: FaceShape,
): boolean {
  if (!productFrameShape) return false
  return recommendedProductFrameValues(shape).includes(productFrameShape)
}
