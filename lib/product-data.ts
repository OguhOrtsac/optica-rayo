import type { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type FrameShape = NonNullable<Product['frame_shape']>

export const FRAME_SHAPE_OPTIONS: Array<{ value: FrameShape; label: string }> = [
  { value: 'round', label: 'Redondo' },
  { value: 'square', label: 'Cuadrado' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'aviator', label: 'Aviador' },
  { value: 'cat_eye', label: 'Cat eye' },
  { value: 'oval', label: 'Ovalado' },
  { value: 'other', label: 'Otro' },
]

export interface ProductDetails {
  brand: string
  material: string
  sku: string
  notes: string
  frameShape: FrameShape | null
  color: string
}

interface LegacyDescription {
  brand?: string
  material?: string
  sku?: string
  notes?: string
}

function parseLegacyDescription(description: string | null): LegacyDescription & { plainText: string } {
  if (!description) return { plainText: '' }
  const trimmed = description.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as LegacyDescription
      return { ...parsed, plainText: parsed.notes || '' }
    } catch {
      return { plainText: description }
    }
  }
  return { plainText: description }
}

/**
 * Reads product attributes from their real columns first and falls back to
 * the legacy JSON-in-description format used by older rows.
 */
export function getProductDetails(product: Product): ProductDetails {
  const legacy = parseLegacyDescription(product.description)
  return {
    brand: product.brand || legacy.brand || '',
    material: product.material || legacy.material || '',
    sku: product.sku || legacy.sku || '',
    notes: legacy.plainText || '',
    frameShape: product.frame_shape || null,
    color: product.color || '',
  }
}

export function getProductDescription(product: Product): string {
  return getProductDetails(product).notes
}

/** Main photo first, followed by the ordered gallery; duplicates removed. */
export function getProductImages(product: Product): string[] {
  const gallery = Array.isArray(product.gallery_urls) ? product.gallery_urls : []
  return Array.from(new Set([product.image_url, ...gallery].filter(Boolean) as string[]))
}

export function getProductImageAlt(product: Product): string {
  return product.image_alt?.trim() || product.name
}
