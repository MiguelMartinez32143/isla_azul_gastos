'use client'

import { useState } from 'react'
import { CURRENCY_DECIMALS } from '@/lib/config'
import { formatMoney, parseMoneyInput } from '@/lib/format'
import { input } from '@/lib/styles'

type MoneyInputProps = {
  id?: string
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
}

/** Campo de dinero que muestra los separadores de miles mientras se escribe. */
export function MoneyInput({ id, value, onChange, placeholder }: MoneyInputProps) {
  const [text, setText] = useState(value === null ? '' : formatMoney(value))

  return (
    <input
      id={id}
      type="text"
      inputMode={CURRENCY_DECIMALS > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        const parsed = parseMoneyInput(event.target.value)
        onChange(parsed)
        if (parsed === null) setText('')
        else setText(CURRENCY_DECIMALS === 0 ? formatMoney(parsed) : event.target.value)
      }}
      onBlur={() => setText(value === null ? '' : formatMoney(value))}
      className={input}
    />
  )
}
