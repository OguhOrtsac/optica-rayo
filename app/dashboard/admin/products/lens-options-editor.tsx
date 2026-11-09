'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  LENS_OPTION_GROUPS,
  type LensOptionDraft,
  type LensOptionGroup
} from '@/lib/product-lens-options'

/**
 * Controlled editor for a list of lens options grouped by 'vision' and
 * 'extra'. Purely local state: the parent owns the drafts and decides
 * when to persist them (syncLensOptionTemplates / syncProductLensOptions
 * in lib/product-lens-options.ts). Used by the template editor and by
 * the create/edit product forms, so all three edit the same shape.
 */
export default function LensOptionsEditor({
  value,
  onChange
}: {
  value: LensOptionDraft[]
  onChange: (next: LensOptionDraft[]) => void
}) {
  const updateRow = (index: number, changes: Partial<LensOptionDraft>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const moveRow = (grp: LensOptionGroup, indexInGroup: number, direction: -1 | 1) => {
    const groupIndexes = value
      .map((row, i) => ({ row, i }))
      .filter(entry => entry.row.grp === grp)
    const target = groupIndexes[indexInGroup + direction]
    const current = groupIndexes[indexInGroup]
    if (!target || !current) return
    const next = [...value]
    next[current.i] = { ...current.row, sort_order: target.row.sort_order }
    next[target.i] = { ...target.row, sort_order: current.row.sort_order }
    onChange(next)
  }

  const addRow = (grp: LensOptionGroup) => {
    const inGroup = value.filter(row => row.grp === grp)
    const nextOrder = inGroup.length > 0 ? Math.max(...inGroup.map(r => r.sort_order)) + 10 : 10
    onChange([
      ...value,
      { grp, name: '', price_delta: 0, sort_order: nextOrder, is_active: true }
    ])
  }

  const inputClass =
    'bg-[#f0f3ff] border border-[#cbd5e1] rounded-lg p-2 text-xs text-[#111c2d] focus:border-[#00357f] focus:ring-1 focus:ring-[#00357f] outline-none min-h-[38px]'

  return (
    <div className="space-y-4">
      {LENS_OPTION_GROUPS.map(group => {
        const rows = value
          .map((row, index) => ({ row, index }))
          .filter(entry => entry.row.grp === group.value)
          .sort((a, b) => a.row.sort_order - b.row.sort_order)
        return (
          <fieldset key={group.value} className="space-y-2">
            <legend className="text-[11px] font-black uppercase tracking-wider text-[#00357f]">
              {group.label}
              <span className="ml-2 font-semibold normal-case tracking-normal text-[#737784]">{group.hint}</span>
            </legend>

            {rows.length === 0 && (
              <p className="text-[11px] font-medium text-[#737784] rounded-lg border border-dashed border-[#cbd5e1] px-3 py-2">
                Sin opciones en este grupo. El asistente no mostrará esta sección.
              </p>
            )}

            {rows.map(({ row, index }, indexInGroup) => (
              <div
                key={row.id ?? `new-${index}`}
                className={`flex flex-wrap items-center gap-2 rounded-xl border border-[#cbd5e1] bg-white p-2.5 ${row.is_active ? '' : 'opacity-60'}`}
              >
                <input
                  aria-label={`Nombre de la opción ${indexInGroup + 1} de ${group.label}`}
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder={group.value === 'vision' ? 'Ej. Monofocal (Visión de Lejos o Cerca)' : 'Ej. Antirreflejante'}
                  className={`${inputClass} flex-1 min-w-[170px] font-semibold`}
                  type="text"
                />
                <label className="flex items-center gap-1 text-[11px] font-bold text-[#434653]">
                  +$
                  <input
                    aria-label="Recargo en pesos"
                    value={row.price_delta}
                    onChange={(e) => updateRow(index, { price_delta: parseFloat(e.target.value) || 0 })}
                    className={`${inputClass} w-24 font-mono`}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                  MXN
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#434653] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                    className="rounded text-[#00357f] focus:ring-[#00357f] cursor-pointer"
                  />
                  Activa
                </label>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    aria-label="Subir opción"
                    title="Subir"
                    disabled={indexInGroup === 0}
                    onClick={() => moveRow(group.value, indexInGroup, -1)}
                    className="p-1.5 rounded-lg text-[#737784] hover:bg-[#dee8ff] hover:text-[#00357f] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar opción"
                    title="Bajar"
                    disabled={indexInGroup === rows.length - 1}
                    onClick={() => moveRow(group.value, indexInGroup, 1)}
                    className="p-1.5 rounded-lg text-[#737784] hover:bg-[#dee8ff] hover:text-[#00357f] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Quitar opción"
                    title="Quitar opción"
                    onClick={() => removeRow(index)}
                    className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addRow(group.value)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#00357f] bg-[#dee8ff] hover:bg-[#c9d8ff] px-3 py-2 rounded-lg transition-colors cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar opción {group.value === 'vision' ? 'de visión' : 'extra'}
            </button>
          </fieldset>
        )
      })}
    </div>
  )
}
