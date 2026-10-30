import { isExpenseSource, isPaymentMethod } from './constants'
import { isValidISODate } from './dates'
import type { ExpenseSource, PaymentMethod } from './types'
import { isUUID } from './utils'

/** Un gasto de la lista de "Varios gastos", todavía sin guardar. */
export type BatchItem = {
  id: string
  amount: number
  categoryId: string
  source: ExpenseSource
  paymentMethod: PaymentMethod
  description: string
  /** `id` null: proveedor nuevo, se crea al guardar. */
  supplier: { id: string | null; name: string } | null
}

export type BatchDraft = { spentOn: string; items: BatchItem[] }

const DRAFT_KEY = 'gastos-lista-sin-guardar'

/**
 * Identificador de un gasto, generado en el dispositivo: si se reintenta guardar la lista,
 * los gastos que ya hubieran entrado no se duplican. No usa crypto.randomUUID porque
 * solo existe en HTTPS y la app también se abre por la red local al probarla.
 */
export function newExpenseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function isBatchItem(value: unknown): value is BatchItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<BatchItem>
  return (
    isUUID(item.id) &&
    typeof item.amount === 'number' &&
    item.amount > 0 &&
    isUUID(item.categoryId) &&
    isExpenseSource(item.source) &&
    isPaymentMethod(item.paymentMethod) &&
    typeof item.description === 'string'
  )
}

/** La lista que quedó sin guardar en este dispositivo, si hay alguna. */
export function readDraft(): BatchDraft | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (typeof saved !== 'object' || saved === null) return null
    const { spentOn, items } = saved as Partial<BatchDraft>
    if (!isValidISODate(spentOn) || !Array.isArray(items) || items.length === 0) return null
    return items.every(isBatchItem) ? { spentOn, items } : null
  } catch {
    return null
  }
}

export function writeDraft(draft: BatchDraft | null): void {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Sin almacenamiento (modo privado, por ejemplo) la lista solo dura mientras la pantalla esté abierta.
  }
}
