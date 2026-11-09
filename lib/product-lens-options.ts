import { createClient } from '@/utils/supabase/client'

/**
 * Lens options for the quote assistant, in two levels (owner's decision,
 * 2026-11-09 — see migration 20261109_product_lens_options.sql):
 *
 * 1) TEMPLATES (lens_option_templates): the editable default set. The
 *    admin can rename, reprice, add, deactivate or delete entries.
 *    Editing a template NEVER rewrites products that already exist.
 * 2) PER-PRODUCT options (product_lens_options): every frame/lens
 *    product owns its copy, seeded from the active templates when the
 *    product is created (seedProductOptionsFromTemplates) and edited
 *    independently afterwards.
 *
 * Groups: 'vision' = graduation (the assistant picks exactly ONE),
 * 'extra' = treatments/filters (the assistant allows SEVERAL).
 *
 * No mock fallbacks here: a failed read returns an honest empty result
 * only where the signature says so; writes always throw the real error
 * so the admin UI can report it instead of faking success.
 */

export type LensOptionGroup = 'vision' | 'extra'

export interface LensOptionTemplate {
  id: string
  grp: LensOptionGroup
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface ProductLensOption {
  id: string
  product_id: string
  grp: LensOptionGroup
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
  created_at: string
}

/** Editable row used by the admin forms; `id` is absent until first save. */
export interface LensOptionDraft {
  id?: string
  grp: LensOptionGroup
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
}

export interface LensOptionsByGroup {
  vision: ProductLensOption[]
  extra: ProductLensOption[]
}

export const LENS_OPTION_GROUPS: { value: LensOptionGroup; label: string; hint: string }[] = [
  { value: 'vision', label: 'Tipo de visión (graduación)', hint: 'El cliente elige una sola.' },
  { value: 'extra', label: 'Extras y tratamientos', hint: 'El cliente puede elegir varias.' }
]

const bySortOrder = <T extends { sort_order: number; name: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es')

function normalizeDraft(draft: LensOptionDraft, indexInGroup: number): LensOptionDraft {
  return {
    id: draft.id,
    grp: draft.grp,
    name: draft.name.trim(),
    price_delta: Number.isFinite(draft.price_delta) ? draft.price_delta : 0,
    sort_order: Number.isFinite(draft.sort_order) ? draft.sort_order : (indexInGroup + 1) * 10,
    is_active: draft.is_active
  }
}

function groupDraftsByGroup(drafts: LensOptionDraft[]): Record<LensOptionGroup, LensOptionDraft[]> {
  const grouped: Record<LensOptionGroup, LensOptionDraft[]> = { vision: [], extra: [] }
  drafts.forEach(d => grouped[d.grp].push(normalizeDraft(d, grouped[d.grp].length)))
  return grouped
}

// ============================================================
// Templates
// ============================================================

/** All templates (including inactive) for the admin editor. Throws on error. */
export async function getLensOptionTemplates(): Promise<LensOptionTemplate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lens_option_templates')
    .select('*')
    .order('grp', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as LensOptionTemplate[]).sort((a, b) =>
    a.grp === b.grp ? bySortOrder(a, b) : a.grp === 'vision' ? -1 : 1
  )
}

/** Only the active templates — what a new product is seeded from. Throws on error. */
export async function getActiveLensOptionTemplates(): Promise<LensOptionTemplate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lens_option_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as LensOptionTemplate[]
}

/** Converts active templates into editable drafts (used to prefill forms). */
export function templatesToDrafts(templates: LensOptionTemplate[]): LensOptionDraft[] {
  return templates.map(t => ({
    id: undefined,
    grp: t.grp,
    name: t.name,
    price_delta: t.price_delta,
    sort_order: t.sort_order,
    is_active: t.is_active
  }))
}

export async function createLensOptionTemplate(
  draft: Omit<LensOptionDraft, 'id'>
): Promise<LensOptionTemplate> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lens_option_templates')
    .insert({
      grp: draft.grp,
      name: draft.name.trim(),
      price_delta: draft.price_delta,
      sort_order: draft.sort_order,
      is_active: draft.is_active
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as LensOptionTemplate
}

export async function updateLensOptionTemplate(
  id: string,
  changes: Partial<Omit<LensOptionDraft, 'id'>>
): Promise<LensOptionTemplate> {
  const supabase = createClient()
  const payload: Record<string, unknown> = { ...changes }
  if (typeof changes.name === 'string') payload.name = changes.name.trim()
  const { data, error } = await supabase
    .from('lens_option_templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as LensOptionTemplate
}

export async function deleteLensOptionTemplate(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('lens_option_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Saves the whole template editor in one pass: drafts without `id` are
 * inserted, drafts with `id` are updated, and stored templates missing
 * from the list are deleted. Returns the fresh template list.
 */
export async function syncLensOptionTemplates(drafts: LensOptionDraft[]): Promise<LensOptionTemplate[]> {
  const supabase = createClient()
  const current = await getLensOptionTemplates()
  const grouped = groupDraftsByGroup(drafts)
  const normalized = [...grouped.vision, ...grouped.extra]
  const keptIds = new Set(normalized.map(d => d.id).filter(Boolean) as string[])

  for (const stored of current) {
    if (!keptIds.has(stored.id)) await deleteLensOptionTemplate(stored.id)
  }
  for (const draft of normalized) {
    if (draft.id) {
      await updateLensOptionTemplate(draft.id, draft)
    } else {
      await createLensOptionTemplate(draft)
    }
  }
  return getLensOptionTemplates()
}

// ============================================================
// Per-product options
// ============================================================

/**
 * Options of one product grouped for the quote assistant.
 * Public callers (catalog) get only active rows — RLS enforces it too.
 * Pass includeInactive for the admin editor. Throws on error.
 */
export async function getProductLensOptions(
  productId: string,
  options: { includeInactive?: boolean } = {}
): Promise<LensOptionsByGroup> {
  const supabase = createClient()
  let query = supabase
    .from('product_lens_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  if (!options.includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as ProductLensOption[]
  return {
    vision: rows.filter(r => r.grp === 'vision').sort(bySortOrder),
    extra: rows.filter(r => r.grp === 'extra').sort(bySortOrder)
  }
}

/** Flat row list of a product's options (admin editor). Throws on error. */
export async function getProductLensOptionRows(
  productId: string,
  options: { includeInactive?: boolean } = {}
): Promise<ProductLensOption[]> {
  const grouped = await getProductLensOptions(productId, options)
  return [...grouped.vision, ...grouped.extra]
}

/** Converts stored product options into editable drafts. */
export function productOptionsToDrafts(rows: ProductLensOption[]): LensOptionDraft[] {
  return rows.map(r => ({
    id: r.id,
    grp: r.grp,
    name: r.name,
    price_delta: r.price_delta,
    sort_order: r.sort_order,
    is_active: r.is_active
  }))
}

export async function createProductLensOption(
  productId: string,
  draft: Omit<LensOptionDraft, 'id'>
): Promise<ProductLensOption> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('product_lens_options')
    .insert({
      product_id: productId,
      grp: draft.grp,
      name: draft.name.trim(),
      price_delta: draft.price_delta,
      sort_order: draft.sort_order,
      is_active: draft.is_active
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ProductLensOption
}

export async function updateProductLensOption(
  id: string,
  changes: Partial<Omit<LensOptionDraft, 'id'>>
): Promise<ProductLensOption> {
  const supabase = createClient()
  const payload: Record<string, unknown> = { ...changes }
  if (typeof changes.name === 'string') payload.name = changes.name.trim()
  const { data, error } = await supabase
    .from('product_lens_options')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ProductLensOption
}

export async function deleteProductLensOption(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('product_lens_options').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Saves the whole per-product editor in one pass (same semantics as
 * syncLensOptionTemplates, scoped to one product). Returns fresh rows.
 */
export async function syncProductLensOptions(
  productId: string,
  drafts: LensOptionDraft[]
): Promise<ProductLensOption[]> {
  const current = await getProductLensOptionRows(productId, { includeInactive: true })
  const grouped = groupDraftsByGroup(drafts)
  const normalized = [...grouped.vision, ...grouped.extra]
  const keptIds = new Set(normalized.map(d => d.id).filter(Boolean) as string[])

  for (const stored of current) {
    if (!keptIds.has(stored.id)) await deleteProductLensOption(stored.id)
  }
  for (const draft of normalized) {
    if (draft.id) {
      await updateProductLensOption(draft.id, draft)
    } else {
      await createProductLensOption(productId, draft)
    }
  }
  return getProductLensOptionRows(productId, { includeInactive: true })
}

/**
 * Seeds a product's options from the ACTIVE templates. Idempotent by
 * design: if the product already has any option rows, they are returned
 * untouched — this is only the "product is born" path, never a reset.
 */
export async function seedProductOptionsFromTemplates(productId: string): Promise<ProductLensOption[]> {
  const existing = await getProductLensOptionRows(productId, { includeInactive: true })
  if (existing.length > 0) return existing

  const supabase = createClient()
  const templates = await getActiveLensOptionTemplates()
  if (templates.length === 0) return []

  const { error } = await supabase.from('product_lens_options').insert(
    templates.map(t => ({
      product_id: productId,
      grp: t.grp,
      name: t.name,
      price_delta: t.price_delta,
      sort_order: t.sort_order,
      is_active: t.is_active
    }))
  )
  if (error) throw new Error(error.message)

  return getProductLensOptionRows(productId, { includeInactive: true })
}
