import { createClient } from '@/utils/supabase/client'

/**
 * Catalog-side data helpers that lib/services.ts does not cover:
 * the real prescription upload for the quote assistant.
 *
 * Prescriptions live in the PRIVATE 'prescriptions' Storage bucket
 * (migration 20261109_prescriptions_bucket_and_whatsapp_setting.sql).
 * Every file goes under the owner's folder: `<userId>/<timestamp>-<name>`,
 * which is exactly what the storage RLS policies allow a customer to
 * insert and read. Staff can read every folder.
 */

export const PRESCRIPTION_BUCKET = 'prescriptions'

/** Same 5 MB ceiling the product photo standard uses (lib/product-images.ts). */
export const PRESCRIPTION_MAX_BYTES = 5 * 1024 * 1024

export const PRESCRIPTION_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]

/** Returns a user-facing error message, or null when the file is usable. */
export function validatePrescriptionFile(file: File): string | null {
  if (!PRESCRIPTION_ACCEPTED_TYPES.includes(file.type)) {
    return 'Formato no admitido. Sube tu receta en JPG, PNG, WebP o PDF.'
  }
  if (file.size > PRESCRIPTION_MAX_BYTES) {
    return 'El archivo pesa más de 5 MB. Toma la foto de nuevo o comprime el PDF.'
  }
  if (file.size === 0) {
    return 'El archivo está vacío. Selecciona tu receta de nuevo.'
  }
  return null
}

/**
 * Uploads the prescription file to the customer's own folder and returns
 * the storage path (NOT a public URL — the bucket is private).
 * Throws on error so the caller can report honestly instead of faking it.
 */
export async function uploadPrescriptionFile(userId: string, file: File): Promise<string> {
  const supabase = createClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(PRESCRIPTION_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(error.message)
  return path
}

/**
 * Attaches an already-uploaded prescription path to an existing lens
 * request. createLensRequest (lib/services.ts) cannot carry the path at
 * insert time, so the catalog updates the row right after creating it;
 * the "Customers can update their own requests" policy allows exactly this.
 */
export async function attachPrescriptionToRequest(requestId: string, path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('lens_requests')
    // prescription_url exists in the DB since the 2026-11-09 migration;
    // the generated Database types predate it, hence the cast.
    .update({ prescription_url: path } as any)
    .eq('id', requestId)

  if (error) throw new Error(error.message)
}
