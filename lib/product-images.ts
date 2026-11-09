/**
 * Product-photo standard for Óptica Rayo.
 *
 * One format everywhere (admin form, upload service and database bucket):
 * - JPG, PNG, WebP or AVIF
 * - maximum 5 MB per file
 * - recommended 1600 x 1200 px (4:3); minimum useful size 800 x 600 px
 * - one main photo + up to five gallery photos (six images total)
 */

export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_MAX_FILES = 6
export const PRODUCT_IMAGE_MAX_GALLERY_FILES = PRODUCT_IMAGE_MAX_FILES - 1
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
export const PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const
export const PRODUCT_IMAGE_RECOMMENDED = {
  width: 1600,
  height: 1200,
  minWidth: 800,
  minHeight: 600,
  aspectLabel: '4:3 horizontal',
} as const

export interface ProductImageValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  width?: number
  height?: number
}

/** Fast checks that do not require decoding the image. */
export function validateProductImageMetadata(
  file: Pick<File, 'name' | 'type' | 'size'>
): string[] {
  const errors: string[] = []
  if (!(PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    errors.push('Formato no permitido. Usa JPG, PNG, WebP o AVIF.')
  }
  if (file.size <= 0) {
    errors.push('El archivo está vacío.')
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    errors.push('La foto supera el máximo de 5 MB.')
  }
  return errors
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    image.src = url
  })
}

/** Full browser-side validation used before a photo is uploaded. */
export async function validateProductImageFile(file: File): Promise<ProductImageValidation> {
  const errors = validateProductImageMetadata(file)
  const warnings: string[] = []

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  try {
    const { width, height } = await readImageDimensions(file)
    if (width < PRODUCT_IMAGE_RECOMMENDED.minWidth || height < PRODUCT_IMAGE_RECOMMENDED.minHeight) {
      warnings.push(
        `La foto mide ${width}×${height}px. Se verá mejor con al menos ${PRODUCT_IMAGE_RECOMMENDED.minWidth}×${PRODUCT_IMAGE_RECOMMENDED.minHeight}px.`
      )
    }
    return { valid: true, errors, warnings, width, height }
  } catch {
    return {
      valid: false,
      errors: ['El archivo no parece ser una imagen válida.'],
      warnings,
    }
  }
}

export function productImageExtension(file: Pick<File, 'name' | 'type'>): string {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/avif') return 'avif'
  const fromName = file.name.split('.').pop()?.toLowerCase()
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : 'jpg'
}
