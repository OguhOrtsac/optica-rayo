'use client'

import { useState } from 'react'
import { composePhone, phoneDigits, splitPhonePrefix, type SplitPhone } from '@/lib/phone'

/**
 * Captura de teléfono con prefijo elegible (dictado del dueño,
 * 2026-11-19): **+52 por default, sin el «1»**, cambiable a **+1**
 * (clientes de EE. UU.) u **Otro…** con el prefijo tecleado (solo
 * dígitos, 1–3).
 *
 * Contrato con el padre: el padre guarda UNA sola cadena — el valor
 * COMPUESTO «+<prefijo> <número local>» que produce composePhone — y
 * la recibe por onChange en cada cambio. Al montarse, el componente
 * separa el valor guardado con splitPhonePrefix para reflejar su
 * prefijo en el selector (por eso cada formulario lo monta solo
 * cuando se abre: alta, registros rápidos y el modal de la ficha).
 * El número local se muestra agrupado 3-3-4 mientras se teclea.
 */
export default function PhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Ej. 444 123 4567',
  selectClassName = '',
  inputClassName = '',
  customPrefixClassName = '',
}: {
  /** Valor compuesto guardado por el padre («+52 4441234567» o ''). */
  value: string
  /** Recibe el valor compuesto nuevo en cada cambio ('' si no hay número). */
  onChange: (composed: string) => void
  disabled?: boolean
  placeholder?: string
  selectClassName?: string
  inputClassName?: string
  customPrefixClassName?: string
}) {
  const [split, setSplit] = useState<SplitPhone>(() => splitPhonePrefix(value))

  const update = (next: SplitPhone) => {
    setSplit(next)
    onChange(composePhone(next))
  }

  const formatLocal = (digits: string) => {
    if (digits.length > 10) return digits
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <div className="flex gap-2">
      <select
        aria-label="Prefijo telefónico"
        value={split.choice}
        disabled={disabled}
        onChange={e => update({ ...split, choice: e.target.value as SplitPhone['choice'] })}
        className={selectClassName}
      >
        <option value="52">+52</option>
        <option value="1">+1</option>
        <option value="other">Otro…</option>
      </select>
      {split.choice === 'other' && (
        <input
          type="text"
          inputMode="numeric"
          aria-label="Prefijo personalizado"
          value={split.customPrefix ? `+${split.customPrefix}` : ''}
          disabled={disabled}
          onChange={e => update({ ...split, customPrefix: phoneDigits(e.target.value).slice(0, 3) })}
          placeholder="+__"
          className={customPrefixClassName}
        />
      )}
      <input
        type="tel"
        aria-label="Número de teléfono"
        value={formatLocal(split.local)}
        disabled={disabled}
        onChange={e => update({ ...split, local: phoneDigits(e.target.value).slice(0, 15) })}
        placeholder={placeholder}
        className={`${inputClassName} flex-1 min-w-0`}
      />
    </div>
  )
}
