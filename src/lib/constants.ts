import type { ExpenseSource, PaymentMethod } from './types'

/** `short` se usa donde hay poco espacio (los botones del formulario de gasto). */
export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; short: string; emoji: string }> = {
  cash: { label: 'Efectivo', short: 'Efectivo', emoji: '💵' },
  transfer: { label: 'Transferencia', short: 'Transfer.', emoji: '🏦' },
  card: { label: 'Tarjeta', short: 'Tarjeta', emoji: '💳' },
}

export const PAYMENT_METHOD_KEYS = Object.keys(PAYMENT_METHODS) as PaymentMethod[]

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && Object.hasOwn(PAYMENT_METHODS, value)
}

/** Quién hizo el gasto. `slug` es el valor que se usa en las URLs (?origen=caja-menor). */
export const EXPENSE_SOURCES: Record<
  ExpenseSource,
  { label: string; emoji: string; slug: string; ofLabel: string; badgeClass: string }
> = {
  petty_cash: {
    label: 'Caja menor',
    emoji: '🪙',
    slug: 'caja-menor',
    ofLabel: 'de caja menor',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  manager: {
    label: 'Jefe',
    emoji: '👔',
    slug: 'jefe',
    ofLabel: 'del jefe',
    badgeClass: 'bg-indigo-100 text-indigo-800',
  },
}

export const EXPENSE_SOURCE_KEYS = Object.keys(EXPENSE_SOURCES) as ExpenseSource[]

export function isExpenseSource(value: unknown): value is ExpenseSource {
  return typeof value === 'string' && Object.hasOwn(EXPENSE_SOURCES, value)
}

export function sourceFromSlug(slug: unknown): ExpenseSource | null {
  return EXPENSE_SOURCE_KEYS.find((key) => EXPENSE_SOURCES[key].slug === slug) ?? null
}

/** Categorías que se crean automáticamente la primera vez que entras. */
export const DEFAULT_CATEGORIES = [
  { name: 'Alimentos', icon: '🥩', color: '#f97316', hint: 'Carnes, verduras, abarrotes, lácteos' },
  { name: 'Bebidas', icon: '🥤', color: '#06b6d4', hint: 'Gaseosas, jugos, cerveza, licores, café' },
  { name: 'Nómina', icon: '👥', color: '#8b5cf6', hint: 'Sueldos, prestaciones, turnos extra' },
  { name: 'Arriendo', icon: '🏠', color: '#3b82f6', hint: 'Arriendo y administración del local' },
  { name: 'Servicios', icon: '💡', color: '#eab308', hint: 'Luz, agua, gas, internet, teléfono' },
  { name: 'Empaques', icon: '📦', color: '#a16207', hint: 'Desechables, bolsas, cajas para domicilio' },
  { name: 'Limpieza', icon: '🧽', color: '#14b8a6', hint: 'Detergentes, químicos, toallas, bolsas de basura' },
  { name: 'Mantenimiento', icon: '🔧', color: '#64748b', hint: 'Reparaciones, equipos, fumigación' },
  { name: 'Publicidad', icon: '📣', color: '#ec4899', hint: 'Redes sociales, volantes, promociones' },
  { name: 'Comisiones', icon: '🛵', color: '#22c55e', hint: 'Apps de domicilio, datáfono, bancos' },
  { name: 'Impuestos', icon: '🧾', color: '#6366f1', hint: 'Impuestos, contador, trámites' },
  { name: 'Otros', icon: '📋', color: '#a8a29e', hint: 'Lo que no encaja en otra categoría' },
] as const

/** Gastos fijos típicos de un restaurante, para crearlos con un toque. */
export const RECURRING_SUGGESTIONS = [
  { name: 'Arriendo del local', category: 'Arriendo', icon: '🏠' },
  { name: 'Luz', category: 'Servicios', icon: '💡' },
  { name: 'Agua', category: 'Servicios', icon: '💧' },
  { name: 'Gas', category: 'Servicios', icon: '🔥' },
  { name: 'Internet y teléfono', category: 'Servicios', icon: '📶' },
  { name: 'Nómina', category: 'Nómina', icon: '👥' },
  { name: 'Contador', category: 'Impuestos', icon: '🧾' },
] as const

export const CATEGORY_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#a16207',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#a8a29e',
]

export const CATEGORY_ICONS = [
  '🥩', '🍗', '🐟', '🥬', '🍅', '🧀', '🥚', '🍞',
  '🌾', '🧂', '🥤', '🍺', '🍷', '☕', '🧊', '🍳',
  '👥', '👨‍🍳', '🏠', '💡', '💧', '🔥', '📶', '📱',
  '📦', '🥡', '🧻', '🧽', '🧴', '🔧', '🚚', '🛵',
  '📣', '💳', '🧾', '🏦', '🚗', '🎉', '🌿', '📋',
]
