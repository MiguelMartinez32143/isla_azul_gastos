import { CURRENCY, CURRENCY_DECIMALS, LOCALE } from './config'

const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: CURRENCY_DECIMALS,
  maximumFractionDigits: CURRENCY_DECIMALS,
})

const moneyWhole = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 })

export const DECIMAL_SEPARATOR =
  new Intl.NumberFormat(LOCALE).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? ','

/** Máximo de dígitos enteros de un monto (la columna es numeric(14, 2)). */
export const MAX_INTEGER_DIGITS = 12

export function formatMoney(value: number): string {
  return money.format(value)
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio)
}

/**
 * Muestra un monto mientras se escribe. `raw` usa "." como separador decimal
 * interno: "125000" → "$ 125.000", "125000.5" → "$ 125.000,5".
 */
export function formatTypedAmount(raw: string): string {
  const [integer, fraction] = raw.split('.')
  const parts = moneyWhole.formatToParts(Number(integer || '0'))
  const lastIntegerIndex = parts.findLastIndex((part) => part.type === 'integer')
  return parts
    .map((part, index) =>
      index === lastIntegerIndex && fraction !== undefined ? part.value + DECIMAL_SEPARATOR + fraction : part.value,
    )
    .join('')
}

/** Convierte un monto guardado al formato interno de escritura (125000.5 → "125000.5"). */
export function amountToRaw(value: number): string {
  return String(Number(value.toFixed(CURRENCY_DECIMALS)))
}

/** Interpreta lo que el usuario escribe en un campo de dinero ("1.250.000" → 1250000). */
export function parseMoneyInput(text: string): number | null {
  let normalized = ''
  for (const char of text) {
    if (char >= '0' && char <= '9') normalized += char
    else if (char === DECIMAL_SEPARATOR && CURRENCY_DECIMALS > 0 && !normalized.includes('.')) normalized += '.'
  }
  if (normalized === '' || normalized === '.') return null
  return roundAmount(Number(normalized))
}

export function roundAmount(value: number): number {
  const factor = 10 ** CURRENCY_DECIMALS
  return Math.round(value * factor) / factor
}

/** Quita tildes y mayúsculas para comparar textos ("Nómina" → "nomina"). */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
