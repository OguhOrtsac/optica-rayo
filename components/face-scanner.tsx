'use client'

/**
 * Escáner de forma de rostro (dictado del dueño, 2026-11-18).
 *
 * Flujo: intro → cámara (MediaPipe Face Landmarker, carga DINÁMICA
 * solo cuando el cliente elige «Usar la cámara») → resultado con los
 * armazones del catálogo que le quedan. Alternativa sin cámara:
 * elección manual de la forma con dibujos.
 *
 * PRIVACIDAD: todo el análisis ocurre EN EL TELÉFONO del cliente.
 * Ninguna foto ni ningún landmark sale del dispositivo ni se guarda:
 * el video vive en memoria, se procesa cuadro a cuadro y al cerrar
 * se detiene la cámara. El modelo se descarga de los CDN oficiales
 * (MediaPipe/Google), pero la imagen jamás se sube.
 *
 * La clasificación vive en lib/face-shape.ts (lógica pura, probada
 * con caras sintéticas); aquí solo se captura, se guía al cliente
 * (posición/frontalidad) y se promedian los cuadros estables para
 * que una sola detección ruidosa no decida el resultado.
 *
 * PRESENTACIÓN POR FASES (dictado del dueño, 2026-11-18): para que
 * el cliente SIENTA el proceso, la ruta de cámara se presenta en
 * tres fases (~9 s en total): ESCANEO (~4 s — es la ventana real de
 * captura y promediado: los puntos reales aparecen poco a poco sobre
 * el video, con un barrido), ANÁLISIS (~4 s — la forma ya salió del
 * promedio real, pero la tarjeta se retiene mientras las medidas se
 * resaltan por turnos) y REVELADO (~1 s — palomita de marca) antes
 * de mostrar el resultado. La elección manual espera ~2.5 s con un
 * «buscando armazones». El teatro va SOBRE la captura real, nunca
 * la sustituye; con movimiento reducido todo se acorta al mínimo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  CheckCircle2,
  Eye,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import {
  FACE_SHAPES,
  FACE_SHAPE_INFO,
  FRAME_SHAPE_LABELS,
  classifyFaceShape,
  productFrameMatchesShape,
  type FaceShape,
  type LandmarkPoint,
} from '@/lib/face-shape'
import { getProductImages, type Product } from '@/lib/product-data'

// Versión EXACTA de @mediapipe/tasks-vision instalada (package.json):
// la WASM debe ser de la misma versión que el JS que la carga.
const MEDIAPIPE_VERSION = '1.2.3'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// Índices que promedia la captura (los mismos que mide el clasificador).
const KEY_INDICES = [10, 152, 234, 454, 172, 397, 71, 301] as const
const MIN_SAMPLES = 20

// Tiempos de la presentación por fases. La ventana de escaneo ES la
// ventana real de promediado de cuadros (antes 1 s; ahora ~4 s, así
// el promedio incluso sale de más cuadros). Con movimiento reducido
// las fases se acortan a lo mínimo y no hay barridos.
const SCAN_MS = 4000
const ANALYSIS_MS = 4000
const REVEAL_MS = 1000
const SCAN_MS_REDUCED = 1000
const ANALYSIS_MS_REDUCED = 800
const REVEAL_MS_REDUCED = 300
const MANUAL_WAIT_MS = 2500
const MANUAL_WAIT_MS_REDUCED = 400

const SCAN_TEXTS = ['Detectando su rostro…', 'Marcando puntos de referencia…'] as const
const ANALYSIS_TEXTS = [
  'Midiendo el ancho de sus pómulos…',
  'Analizando su mandíbula…',
  'Midiendo su frente…',
  'Calculando las proporciones…',
] as const
// Líneas de medida que se resaltan por turnos durante el análisis,
// en el mismo orden que ANALYSIS_TEXTS.
const MEASURE_LINES = [
  [234, 454],
  [172, 397],
  [71, 301],
  [10, 152],
] as const

// Contorno del rostro (anillo oval de MediaPipe, en orden) y puntos
// visibles del escaneo: ~71 landmarks de contorno, cejas, ojos, nariz,
// labios y los puntos de medida del clasificador.
const OVAL_POINTS = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67,
  109,
]
const FEATURE_POINTS = [
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 33, 133, 159, 145, 263, 362, 386, 374,
  168, 197, 195, 5, 4, 1, 94, 2, 61, 291, 78, 308, 13, 14, 17, 71, 301,
]
const DRAW_POINTS = Array.from(new Set([...OVAL_POINTS, ...FEATURE_POINTS]))

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Step =
  | 'intro'
  | 'loading'
  | 'camera'
  | 'manual'
  | 'manualWait'
  | 'result'
  | 'error'
type LiveStatus = 'searching' | 'tooFar' | 'tooClose' | 'offCenter' | 'turned' | 'perfect'
type CamPhase = 'guide' | 'scan' | 'analysis' | 'reveal'

const STATUS_TEXT: Record<LiveStatus, string> = {
  searching: 'Buscando su rostro…',
  tooFar: 'Acérquese un poco más',
  tooClose: 'Aléjese un poco',
  offCenter: 'Centre su rostro dentro del óvalo',
  turned: 'Mire de frente a la cámara',
  perfect: '¡Perfecto! Manténgase así…',
}

export interface FaceScannerProps {
  open: boolean
  onClose: () => void
  /** Productos del catálogo, ya en el orden de exhibición. */
  products: Product[]
  /** Precio a mostrar por producto (la página pasa su priceOf). */
  priceOf?: (p: Product) => number
  /** Al tocar un sugerido: la página cierra el escáner y abre su detalle. */
  onPickProduct: (p: Product) => void
  /** «Ver todos los armazones» cuando ningún producto coincide. */
  onShowAllFrames?: () => void
  /**
   * Forma a la que VOLVER: si el escáner se abre con una forma
   * recordada, entra directo al paso de resultado con ella, sin
   * repetir escaneo ni esperas (la página la pasa cuando el cliente
   * cierra el detalle de un armazón sugerido).
   */
  resumeShape?: FaceShape | null
  /** Avisa a la página cada vez que un resultado se muestra. */
  onShapeResolved?: (shape: FaceShape) => void
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

/** Contorno simple de cada forma, para la elección manual. */
function FaceOutline({ shape }: { shape: FaceShape }) {
  const common = {
    fill: 'none',
    stroke: '#00357f',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
  }
  return (
    <svg viewBox="0 0 100 120" className="h-16 w-14" aria-hidden="true">
      {shape === 'ovalada' && <ellipse cx="50" cy="60" rx="33" ry="47" {...common} />}
      {shape === 'redonda' && <ellipse cx="50" cy="60" rx="40" ry="40" {...common} />}
      {shape === 'cuadrada' && (
        <path d="M22 16 H78 V60 Q78 96 58 102 H42 Q22 96 22 60 Z" {...common} />
      )}
      {shape === 'corazon' && (
        <path d="M15 28 Q50 6 85 28 Q88 54 66 76 Q57 86 50 102 Q43 86 34 76 Q12 54 15 28 Z" {...common} />
      )}
      {shape === 'diamante' && (
        <path d="M50 8 Q79 32 83 58 Q79 86 50 112 Q21 86 17 58 Q21 32 50 8 Z" {...common} />
      )}
      {shape === 'alargada' && <ellipse cx="50" cy="60" rx="26" ry="50" {...common} />}
    </svg>
  )
}

export default function FaceScanner({
  open,
  onClose,
  products,
  priceOf,
  onPickProduct,
  onShowAllFrames,
  resumeShape,
  onShapeResolved,
}: FaceScannerProps) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('intro')
  const [resultShape, setResultShape] = useState<FaceShape | null>(null)
  const [errorText, setErrorText] = useState('')
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('searching')
  const [progress, setProgress] = useState(0)
  const [camPhase, setCamPhase] = useState<CamPhase>('guide')
  const [phaseText, setPhaseText] = useState<string | null>(null)
  const [percent, setPercent] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  // Token de sesión: cada arranque lo incrementa; las continuaciones
  // asíncronas de una sesión vieja (cerrada o reemplazada) se abortan.
  const sessionRef = useRef(0)
  const samplesRef = useRef<LandmarkPoint[][]>([])
  const stableSinceRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const statusRef = useRef<LiveStatus>('searching')
  const progressRef = useRef(0)
  const detectErrorsRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const latestLandmarksRef = useRef<LandmarkPoint[] | null>(null)
  const camPhaseRef = useRef<CamPhase>('guide')
  const phaseStartRef = useRef(0)
  const analysisSegRef = useRef(0)
  const pendingShapeRef = useRef<FaceShape | null>(null)
  const reducedMotionRef = useRef(false)
  const scanMsRef = useRef(SCAN_MS)
  const analysisMsRef = useRef(ANALYSIS_MS)
  const revealMsRef = useRef(REVEAL_MS)
  const manualTimerRef = useRef<number | null>(null)
  const lastPhaseTextRef = useRef<string | null>(null)
  const lastPercentRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  // El bucle de detección corre a ~60 cuadros por segundo: el texto y
  // el porcentaje de la fase solo tocan el estado cuando cambian.
  const setPhaseTextThrottled = useCallback((text: string | null) => {
    if (lastPhaseTextRef.current !== text) {
      lastPhaseTextRef.current = text
      setPhaseText(text)
    }
  }, [])

  const setPercentThrottled = useCallback((value: number) => {
    if (lastPercentRef.current !== value) {
      lastPercentRef.current = value
      setPercent(value)
    }
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const stopCamera = useCallback(() => {
    sessionRef.current += 1
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close()
      } catch {
        // Cierre best-effort: si la WASM ya murió, no hay nada que salvar.
      }
      landmarkerRef.current = null
    }
    samplesRef.current = []
    stableSinceRef.current = null
    lastVideoTimeRef.current = -1
    // La presentación por fases también se cancela entera: sin
    // temporizadores vivos ni puntos fantasma al reabrir.
    camPhaseRef.current = 'guide'
    setCamPhase('guide')
    lastPhaseTextRef.current = null
    setPhaseText(null)
    lastPercentRef.current = 0
    setPercent(0)
    progressRef.current = 0
    pendingShapeRef.current = null
    latestLandmarksRef.current = null
    if (manualTimerRef.current !== null) {
      window.clearTimeout(manualTimerRef.current)
      manualTimerRef.current = null
    }
    clearCanvas()
  }, [clearCanvas])

  // Al cerrar el modal (o desmontar), la cámara se detiene SIEMPRE y
  // el flujo vuelve a la intro para la próxima apertura.
  useEffect(() => {
    if (!open) {
      stopCamera()
      setStep('intro')
      setResultShape(null)
      setProgress(0)
      statusRef.current = 'searching'
      setLiveStatus('searching')
    } else if (resumeShape) {
      // Reapertura con forma recordada (el cliente cerró el detalle
      // de un sugerido): directo al resultado, sin escaneo ni
      // esperas. La cámara ya venía detenida.
      setResultShape(resumeShape)
      setStep('result')
    }
  }, [open, stopCamera, resumeShape])

  // Avisa a la página cada vez que un resultado se muestra, para que
  // recuerde la forma (vía ref: la identidad del callback no debe
  // disparar el efecto).
  const shapeResolvedRef = useRef(onShapeResolved)
  shapeResolvedRef.current = onShapeResolved
  const lastNotifiedShapeRef = useRef<FaceShape | null>(null)
  useEffect(() => {
    if (step === 'result' && resultShape) {
      if (lastNotifiedShapeRef.current !== resultShape) {
        lastNotifiedShapeRef.current = resultShape
        shapeResolvedRef.current?.(resultShape)
      }
    } else if (step === 'intro') {
      lastNotifiedShapeRef.current = null
    }
  }, [step, resultShape])

  useEffect(() => stopCamera, [stopCamera])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  const failWith = useCallback(
    (text: string) => {
      stopCamera()
      setErrorText(text)
      setStep('error')
    },
    [stopCamera],
  )

  // La clasificación de siempre: promedio punto a punto de los
  // cuadros estables capturados y el clasificador puro. Sin efectos:
  // quien llama decide cuándo se muestra el resultado.
  const computeShape = useCallback((samples: LandmarkPoint[][]): FaceShape => {
    const averaged = KEY_INDICES.map((_, k) => {
      let x = 0
      let y = 0
      for (const s of samples) {
        x += s[k].x
        y += s[k].y
      }
      return { x: x / samples.length, y: y / samples.length }
    })
    const center = {
      x: averaged.reduce((a, p) => a + p.x, 0) / averaged.length,
      y: averaged.reduce((a, p) => a + p.y, 0) / averaged.length,
    }
    const points: LandmarkPoint[] = Array.from({ length: 468 }, () => center)
    KEY_INDICES.forEach((idx, k) => {
      points[idx] = averaged[k]
    })
    return classifyFaceShape(points)
  }, [])

  // Dibuja los landmarks REALES del último cuadro sobre el video (el
  // canvas lleva el mismo espejo que el <video>). En escaneo los
  // puntos aparecen de arriba hacia abajo en proporción al avance y
  // baja una línea de barrido; en análisis quedan todos, pulsando,
  // con la medida del turno resaltada; en revelado se tiñen de marca.
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (!cw || !ch) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const pw = Math.round(cw * dpr)
    const ph = Math.round(ch * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    const phase = camPhaseRef.current
    if (phase === 'guide') return
    const lm = latestLandmarksRef.current
    if (!lm || lm.length < 468) return
    // Mapeo del cuadro de video al contenedor con object-cover.
    const vw = video.videoWidth > 0 ? video.videoWidth : cw
    const vh = video.videoHeight > 0 ? video.videoHeight : ch
    const scale = Math.max(cw / vw, ch / vh)
    const dw = vw * scale
    const dh = vh * scale
    const ox = (cw - dw) / 2
    const oy = (ch - dh) / 2
    const P = (i: number) => ({ x: ox + lm[i].x * dw, y: oy + lm[i].y * dh })
    const reduced = reducedMotionRef.current

    if (phase === 'scan') {
      const p = progressRef.current
      const sorted = [...DRAW_POINTS].sort((a, b) => lm[a].y - lm[b].y)
      const revealCount = reduced
        ? sorted.length
        : Math.min(sorted.length, Math.ceil(p * sorted.length))
      const rank = new Map<number, number>()
      sorted.forEach((idx, r) => rank.set(idx, r))
      const visible = (i: number) => (rank.get(i) ?? 0) < revealCount

      if (!reduced && p > 0) {
        const top = P(10).y
        const bottom = P(152).y
        const sy = top + p * (bottom - top)
        const left = Math.min(P(234).x, P(454).x) - 14
        const width = Math.abs(P(454).x - P(234).x) + 28
        const grad = ctx.createLinearGradient(0, sy - 30, 0, sy + 30)
        grad.addColorStop(0, 'rgba(34,197,94,0)')
        grad.addColorStop(0.5, 'rgba(34,197,94,0.16)')
        grad.addColorStop(1, 'rgba(34,197,94,0)')
        ctx.fillStyle = grad
        ctx.fillRect(left, sy - 30, width, 60)
        ctx.strokeStyle = 'rgba(34,197,94,0.75)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(left, sy)
        ctx.lineTo(left + width, sy)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(34,197,94,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 0; k < OVAL_POINTS.length; k++) {
        const a = OVAL_POINTS[k]
        const b = OVAL_POINTS[(k + 1) % OVAL_POINTS.length]
        if (!visible(a) || !visible(b)) continue
        const pa = P(a)
        const pb = P(b)
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
      }
      ctx.stroke()

      ctx.fillStyle = '#22c55e'
      for (const idx of DRAW_POINTS) {
        if (!visible(idx)) continue
        const q = P(idx)
        ctx.beginPath()
        ctx.arc(q.x, q.y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }

    // Análisis y revelado: la malla completa sobre el rostro.
    const radius =
      phase === 'reveal' || reduced ? 2.2 : 2.2 + 0.7 * Math.sin(performance.now() / 280)
    ctx.strokeStyle =
      phase === 'reveal' ? 'rgba(8,153,201,0.45)' : 'rgba(34,197,94,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let k = 0; k < OVAL_POINTS.length; k++) {
      const pa = P(OVAL_POINTS[k])
      const pb = P(OVAL_POINTS[(k + 1) % OVAL_POINTS.length])
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
    }
    ctx.stroke()

    if (phase === 'analysis') {
      MEASURE_LINES.forEach((line, i) => {
        const pa = P(line[0])
        const pb = P(line[1])
        if (i === analysisSegRef.current) {
          ctx.strokeStyle = 'rgba(34,197,94,0.35)'
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
        }
      })
    }

    ctx.fillStyle = phase === 'reveal' ? '#0899c9' : '#22c55e'
    for (const idx of DRAW_POINTS) {
      const q = P(idx)
      ctx.beginPath()
      ctx.arc(q.x, q.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  // Avanza las fases de análisis y revelado según el reloj. La forma
  // ya se calculó del promedio real al cerrar el escaneo; aquí solo
  // se presenta y, al final, se entrega la tarjeta de resultado.
  const advancePhase = useCallback(
    (now: number) => {
      if (camPhaseRef.current === 'analysis') {
        const total = analysisMsRef.current
        const elapsed = now - phaseStartRef.current
        const seg = Math.min(
          ANALYSIS_TEXTS.length - 1,
          Math.floor(elapsed / (total / ANALYSIS_TEXTS.length)),
        )
        analysisSegRef.current = seg
        setPhaseTextThrottled(ANALYSIS_TEXTS[seg] ?? ANALYSIS_TEXTS[0])
        setPercentThrottled(50 + Math.round(Math.min(1, elapsed / total) * 50))
        if (elapsed >= total) {
          camPhaseRef.current = 'reveal'
          phaseStartRef.current = now
          setCamPhase('reveal')
          setPhaseTextThrottled(null)
          setPercentThrottled(100)
        }
      } else if (camPhaseRef.current === 'reveal') {
        if (now - phaseStartRef.current >= revealMsRef.current) {
          const shape = pendingShapeRef.current
          pendingShapeRef.current = null
          stopCamera()
          if (shape) {
            setResultShape(shape)
            setStep('result')
          }
        }
      }
    },
    [setPercentThrottled, setPhaseTextThrottled, stopCamera],
  )

  const runLoop = useCallback(
    (session: number) => {
      const tick = () => {
        if (sessionRef.current !== session) return
        rafRef.current = requestAnimationFrame(tick)
        const video = videoRef.current
        const landmarker = landmarkerRef.current
        if (!video || !landmarker || video.readyState < 2) return
        if (video.currentTime === lastVideoTimeRef.current) return
        lastVideoTimeRef.current = video.currentTime

        let landmarks: LandmarkPoint[] | undefined
        try {
          const result = landmarker.detectForVideo(video, performance.now())
          landmarks = result.faceLandmarks?.[0] as LandmarkPoint[] | undefined
          detectErrorsRef.current = 0
        } catch {
          detectErrorsRef.current += 1
          if (camPhaseRef.current === 'analysis' || camPhaseRef.current === 'reveal') {
            // La forma ya salió del promedio real: un fallo de
            // detección aquí no cancela la presentación.
            advancePhase(performance.now())
            drawOverlay()
            return
          }
          if (detectErrorsRef.current >= 10) {
            failWith(
              'La detección se interrumpió en su teléfono. Puede elegir su forma de rostro manualmente.',
            )
          }
          return
        }

        const setStatus = (s: LiveStatus) => {
          if (statusRef.current !== s) {
            statusRef.current = s
            setLiveStatus(s)
          }
          if (s !== 'perfect') {
            samplesRef.current = []
            stableSinceRef.current = null
            if (progressRef.current !== 0) {
              progressRef.current = 0
              setProgress(0)
            }
            // El rostro se perdió: el escaneo se cancela y se vuelve
            // a la guía, sin forzar la presentación sobre nadie.
            if (camPhaseRef.current === 'scan') {
              camPhaseRef.current = 'guide'
              setCamPhase('guide')
            }
            setPhaseTextThrottled(null)
            setPercentThrottled(0)
            clearCanvas()
          }
        }

        if (!landmarks || landmarks.length < 468) {
          if (camPhaseRef.current === 'analysis' || camPhaseRef.current === 'reveal') {
            // Se conserva la última malla conocida y la fase sigue.
            advancePhase(performance.now())
            drawOverlay()
            return
          }
          setStatus('searching')
          return
        }
        latestLandmarksRef.current = landmarks

        // Con el escaneo completo, la guía ya no manda: solo corre
        // la presentación (análisis y revelado) sobre el video vivo.
        if (camPhaseRef.current === 'analysis' || camPhaseRef.current === 'reveal') {
          advancePhase(performance.now())
          drawOverlay()
          return
        }

        // Espacio uniforme: x corregida por el aspecto del video,
        // como exige el contrato de lib/face-shape.ts.
        const aspect =
          video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : 1
        const pt = (i: number): LandmarkPoint => ({
          x: landmarks[i].x * aspect,
          y: landmarks[i].y,
        })

        // Tamaño: ancho de pómulos como fracción del ancho del cuadro
        // (en coordenadas crudas, sin corregir: es una fracción).
        const cheekFraction = Math.abs(landmarks[454].x - landmarks[234].x)
        if (cheekFraction < 0.26) {
          setStatus('tooFar')
          return
        }
        if (cheekFraction > 0.74) {
          setStatus('tooClose')
          return
        }

        // Centrado del rostro en el cuadro.
        const faceCx = (landmarks[234].x + landmarks[454].x) / 2
        const faceCy = (landmarks[10].y + landmarks[152].y) / 2
        if (Math.abs(faceCx - 0.5) > 0.16 || Math.abs(faceCy - 0.5) > 0.2) {
          setStatus('offCenter')
          return
        }

        // Frontalidad: la nariz (1) debe caer sobre el centro entre
        // los ojos (33 y 263) y la línea de ojos, casi horizontal.
        const eyeL = pt(33)
        const eyeR = pt(263)
        const nose = pt(1)
        const eyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y) || 1
        const noseDeviation = Math.abs(nose.x - (eyeL.x + eyeR.x) / 2) / eyeDist
        const eyeTilt = Math.abs(eyeR.y - eyeL.y) / eyeDist
        if (noseDeviation > 0.22 || eyeTilt > 0.15) {
          setStatus('turned')
          return
        }

        // De frente y estable: acumular la muestra de este cuadro.
        // Esta ventana ES la fase de escaneo: los puntos reales se
        // van dibujando en proporción al avance del promediado.
        setStatus('perfect')
        const now = performance.now()
        if (stableSinceRef.current === null) stableSinceRef.current = now
        if (camPhaseRef.current === 'guide') {
          camPhaseRef.current = 'scan'
          setCamPhase('scan')
        }
        samplesRef.current.push(KEY_INDICES.map(i => pt(i)))
        const elapsed = now - stableSinceRef.current
        const p = Math.min(1, elapsed / scanMsRef.current)
        if (Math.abs(p - progressRef.current) >= 0.05 || p === 1) {
          progressRef.current = p
          setProgress(p)
        }
        setPhaseTextThrottled(elapsed < scanMsRef.current / 2 ? SCAN_TEXTS[0] : SCAN_TEXTS[1])
        setPercentThrottled(Math.round(p * 50))
        drawOverlay()
        if (elapsed >= scanMsRef.current && samplesRef.current.length >= MIN_SAMPLES) {
          const samples = samplesRef.current
          samplesRef.current = []
          stableSinceRef.current = null
          // La forma se calcula AHORA, del promedio real; la tarjeta
          // se retiene mientras corren el análisis y el revelado.
          pendingShapeRef.current = computeShape(samples)
          camPhaseRef.current = 'analysis'
          phaseStartRef.current = now
          analysisSegRef.current = 0
          setCamPhase('analysis')
          setPhaseTextThrottled(ANALYSIS_TEXTS[0])
          setPercentThrottled(50)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [
      advancePhase,
      clearCanvas,
      computeShape,
      drawOverlay,
      failWith,
      setPercentThrottled,
      setPhaseTextThrottled,
    ],
  )

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      failWith(
        'Su navegador no permite usar la cámara en esta página. Puede elegir su forma de rostro manualmente.',
      )
      return
    }
    setStep('loading')
    const session = sessionRef.current + 1
    sessionRef.current = session
    detectErrorsRef.current = 0
    samplesRef.current = []
    stableSinceRef.current = null
    const reduced = prefersReducedMotion()
    reducedMotionRef.current = reduced
    scanMsRef.current = reduced ? SCAN_MS_REDUCED : SCAN_MS
    analysisMsRef.current = reduced ? ANALYSIS_MS_REDUCED : ANALYSIS_MS
    revealMsRef.current = reduced ? REVEAL_MS_REDUCED : REVEAL_MS
    camPhaseRef.current = 'guide'
    setCamPhase('guide')

    // 1) Modelo de detección (carga dinámica: solo paga quien escanea).
    let landmarker: FaceLandmarker
    try {
      const vision = await import('@mediapipe/tasks-vision')
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL)
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 1,
      })
      try {
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('GPU'))
      } catch {
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('CPU'))
      }
    } catch {
      if (sessionRef.current !== session) return
      failWith(
        'No se pudo cargar el detector de rostro. Revise su conexión e inténtelo de nuevo, o elija su forma manualmente.',
      )
      return
    }
    if (sessionRef.current !== session) {
      try {
        landmarker.close()
      } catch {
        // Sesión ya reemplazada: se descarta el detector recién creado.
      }
      return
    }
    landmarkerRef.current = landmarker

    // 2) Cámara frontal.
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
    } catch (err) {
      if (sessionRef.current !== session) return
      const name = (err as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        failWith(
          'No se dio permiso para usar la cámara. Sin cámara también funciona: elija su forma de rostro manualmente.',
        )
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        failWith(
          'No se encontró una cámara en este dispositivo. Puede elegir su forma de rostro manualmente.',
        )
      } else {
        failWith(
          'La cámara no pudo iniciarse. Puede elegir su forma de rostro manualmente.',
        )
      }
      return
    }
    if (sessionRef.current !== session) {
      stream.getTracks().forEach(t => t.stop())
      return
    }
    streamRef.current = stream

    // El <video> se monta al pasar al paso 'loading': si la carga fue
    // muy rápida, puede no existir aún en el primer intento.
    let video = videoRef.current
    for (let i = 0; !video && i < 10; i++) {
      await new Promise(r => setTimeout(r, 50))
      if (sessionRef.current !== session) return
      video = videoRef.current
    }
    if (!video) {
      failWith('Algo salió mal al preparar la cámara. Inténtelo de nuevo.')
      return
    }
    video.srcObject = stream
    try {
      await video.play()
    } catch {
      if (sessionRef.current !== session) return
      failWith('La cámara no pudo iniciarse. Puede elegir su forma de rostro manualmente.')
      return
    }
    if (sessionRef.current !== session) return
    statusRef.current = 'searching'
    setLiveStatus('searching')
    setStep('camera')
    runLoop(session)
  }, [failWith, runLoop])

  const pickManualShape = useCallback(
    (shape: FaceShape) => {
      stopCamera()
      setResultShape(shape)
      setStep('manualWait')
      // Espera breve para que la elección también se sienta buscada;
      // cerrar el modal la cancela (stopCamera limpia el temporizador).
      const wait = prefersReducedMotion() ? MANUAL_WAIT_MS_REDUCED : MANUAL_WAIT_MS
      manualTimerRef.current = window.setTimeout(() => {
        manualTimerRef.current = null
        setStep('result')
      }, wait)
    },
    [stopCamera],
  )

  const suggested = useMemo(() => {
    if (!resultShape) return []
    return products.filter(
      p => p.category === 'frames' && productFrameMatchesShape(p.frame_shape, resultShape),
    )
  }, [products, resultShape])

  if (!mounted || !open) return null

  const info = resultShape ? FACE_SHAPE_INFO[resultShape] : null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0b1526]/50 sm:items-center sm:p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) handleClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Descubrir mi forma de rostro"
        className="anim-fade-up relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar el escáner"
          className="absolute top-4 right-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#f0f3ff] text-[#434653] transition hover:text-[#111c2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ——— INTRO ——— */}
        {step === 'intro' && (
          <div className="space-y-4 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dee8ff] text-[#00357f]">
              <ScanFace className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold tracking-tight text-[#111c2d]">
                Descubra su forma de rostro
              </h3>
              <p className="text-sm leading-relaxed text-[#434653]">
                Con la cámara de su teléfono medimos las proporciones de su rostro y le
                sugerimos los armazones de nuestro catálogo que mejor le quedan. Toma
                unos segundos.
              </p>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-[#e2f9ee] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#00422b]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Su foto no sale de su teléfono: el análisis se hace aquí mismo, en su
              dispositivo, y no se guarda ninguna imagen.
            </p>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#00357f] px-4 text-sm font-bold text-white shadow-md shadow-[#00357f]/25 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
              >
                <Camera className="h-5 w-5" /> Usar la cámara
              </button>
              <button
                type="button"
                onClick={() => setStep('manual')}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#00357f] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                Elegir mi forma manualmente
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#737784]">
              Es una guía de estilo basada en proporciones, no una medición exacta: la
              sugerencia final siempre la confirma usted frente al espejo.
            </p>
          </div>
        )}

        {/* ——— CÁMARA (carga + en vivo) ——— */}
        {(step === 'loading' || step === 'camera') && (
          <div className="space-y-4">
            <h3 className="pr-10 text-base font-extrabold tracking-tight text-[#111c2d]">
              {step === 'camera' && camPhase === 'analysis'
                ? 'Analizando su rostro'
                : step === 'camera' && camPhase === 'reveal'
                  ? '¡Listo!'
                  : 'Centre su rostro en el óvalo'}
            </h3>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                aria-label="Vista de la cámara"
              />
              {/* Malla de puntos reales del escaneo (mismo espejo que el video) */}
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
                aria-hidden="true"
              />
              {/* Óvalo guía */}
              <svg
                viewBox="0 0 300 400"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <ellipse
                  cx="150"
                  cy="190"
                  rx="105"
                  ry="140"
                  fill="none"
                  stroke={liveStatus === 'perfect' ? '#49da9f' : 'rgba(255,255,255,0.85)'}
                  strokeWidth="3"
                  strokeDasharray="10 8"
                />
              </svg>
              {step === 'camera' && camPhase === 'reveal' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="anim-fade-up flex h-20 w-20 items-center justify-center rounded-full bg-[#0899c9] text-white shadow-2xl">
                    <Check className="h-10 w-10" strokeWidth={3} />
                  </span>
                </div>
              )}
              {step === 'loading' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
                  <span className="skeleton-shimmer h-10 w-10 rounded-full" />
                  <p className="text-sm font-bold text-white">Preparando la cámara…</p>
                  <p className="text-xs text-white/70">
                    Descargando el detector de rostro (solo la primera vez).
                  </p>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                  <p
                    role="status"
                    className={`mx-auto flex w-fit max-w-full items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white ${
                      liveStatus === 'perfect' ? 'bg-[#00422b]/90' : 'bg-black/65'
                    }`}
                  >
                    {liveStatus === 'perfect' && camPhase === 'guide' && (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    )}
                    {phaseText ?? STATUS_TEXT[liveStatus]}
                    {camPhase !== 'guide' && (
                      <span className="tabular-nums opacity-90">{percent}%</span>
                    )}
                  </p>
                  {(liveStatus === 'perfect' || camPhase !== 'guide') && (
                    <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-[#49da9f] transition-[width] duration-100"
                        style={{
                          width: `${camPhase === 'guide' ? Math.round(progress * 100) : percent}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                stopCamera()
                setStep('intro')
              }}
              className="min-h-[48px] w-full cursor-pointer rounded-2xl border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#434653] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ——— ELECCIÓN MANUAL ——— */}
        {step === 'manual' && (
          <div className="space-y-4 text-left">
            <div className="space-y-1.5 pr-8">
              <h3 className="text-lg font-extrabold tracking-tight text-[#111c2d]">
                ¿Cuál se parece más a su rostro?
              </h3>
              <p className="text-sm leading-relaxed text-[#434653]">
                Toque la forma que más se le parece y le sugerimos armazones para ella.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FACE_SHAPES.map(shape => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => pickManualShape(shape)}
                  className="flex min-h-[118px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#cbd5e1] bg-[#f8faff] px-2 py-3 transition hover:border-[#00357f]/50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  <FaceOutline shape={shape} />
                  <span className="text-xs font-bold text-[#00357f]">
                    {FACE_SHAPE_INFO[shape].label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep('intro')}
              className="min-h-[44px] w-full cursor-pointer rounded-2xl px-4 text-sm font-bold text-[#00357f] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
            >
              Volver
            </button>
          </div>
        )}

        {/* ——— ESPERA TRAS LA ELECCIÓN MANUAL ——— */}
        {step === 'manualWait' && resultShape && info && (
          <div className="space-y-4 py-2 text-center">
            <div className="anim-pulse-soft flex justify-center">
              <FaceOutline shape={resultShape} />
            </div>
            <p role="status" className="text-sm font-bold text-[#111c2d]">
              Buscando los armazones ideales para su forma
              <span aria-hidden="true">
                <span className="anim-blink-soft">.</span>
                <span className="anim-blink-soft" style={{ animationDelay: '0.25s' }}>
                  .
                </span>
                <span className="anim-blink-soft" style={{ animationDelay: '0.5s' }}>
                  .
                </span>
              </span>
            </p>
            <p className="text-xs text-[#737784]">Forma elegida: {info.label}</p>
          </div>
        )}

        {/* ——— ERROR ——— */}
        {step === 'error' && (
          <div className="space-y-4 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffdad6] text-[#ba1a1a]">
              <Camera className="h-6 w-6" />
            </div>
            <p className="text-sm leading-relaxed font-medium text-[#434653]">{errorText}</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStep('manual')}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#00357f] px-4 text-sm font-bold text-white shadow-md shadow-[#00357f]/25 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f] focus-visible:ring-offset-2"
              >
                Elegir mi forma manualmente
              </button>
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="min-h-[48px] w-full cursor-pointer rounded-2xl border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#434653] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                Intentar con la cámara de nuevo
              </button>
            </div>
          </div>
        )}

        {/* ——— RESULTADO ——— */}
        {step === 'result' && resultShape && info && (
          <div className="space-y-4 text-left">
            <div className="space-y-1.5 pr-8">
              <p className="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#00509e] uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Su forma de rostro
              </p>
              <h3 className="text-2xl font-extrabold tracking-tight text-[#00357f] uppercase">
                {info.label}
              </h3>
              <p className="text-sm leading-relaxed text-[#434653]">{info.description}</p>
              <p className="text-sm leading-relaxed font-medium text-[#111c2d]">{info.tip}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {info.recommendedFrames.map(fs => (
                <span
                  key={fs}
                  className="rounded-full bg-[#dee8ff] px-2.5 py-1 text-[11px] font-bold text-[#00357f]"
                >
                  {FRAME_SHAPE_LABELS[fs]}
                </span>
              ))}
            </div>

            {suggested.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold tracking-wider text-[#434653] uppercase">
                  De nuestro catálogo, para usted
                </p>
                <div className="space-y-2">
                  {suggested.map(p => {
                    const images = getProductImages(p)
                    const price = priceOf ? priceOf(p) : p.price
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPickProduct(p)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#cbd5e1]/70 bg-white p-2.5 text-left shadow-sm transition hover:border-[#00357f]/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                      >
                        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f8faff]">
                          {images.length > 0 ? (
                            <img
                              src={images[0]}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain p-1.5"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[#00357f]/30">
                              <Eye className="h-6 w-6 stroke-[1.5]" />
                            </span>
                          )}
                        </span>
                        <span className="block min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#111c2d]">
                            {p.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#5d606f]">
                            Tóquelo para verlo y cotizarlo
                          </span>
                        </span>
                        <span className="shrink-0 text-[15px] font-extrabold text-[#00357f] tabular-nums">
                          {formatPrice(price)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl bg-[#f0f3ff] px-4 py-3.5">
                <p className="text-sm leading-relaxed font-medium text-[#434653]">
                  Aún no tenemos en el catálogo un armazón etiquetado con esas formas,
                  pero ya sabe qué buscar: {info.recommendedFrames.map(fs => FRAME_SHAPE_LABELS[fs]).join(', ')}.
                </p>
                <button
                  type="button"
                  onClick={() => (onShowAllFrames ? onShowAllFrames() : handleClose())}
                  className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#00357f] px-4 text-sm font-bold text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
                >
                  Ver todos los armazones
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setResultShape(null)
                  setStep('intro')
                }}
                className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#00357f] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                <RotateCcw className="h-4 w-4" /> Escanear de nuevo
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[48px] flex-1 cursor-pointer rounded-2xl bg-[#00357f] px-4 text-sm font-bold text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00357f]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
