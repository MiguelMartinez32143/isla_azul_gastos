'use client'

import { Check, Delete, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { CategoryIcon } from '@/components/category-icon'
import { CURRENCY_DECIMALS } from '@/lib/config'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS, PAYMENT_METHODS, PAYMENT_METHOD_KEYS } from '@/lib/constants'
import { DECIMAL_SEPARATOR, MAX_INTEGER_DIGITS, normalizeText } from '@/lib/format'
import { buttonClass, inputBase, textarea } from '@/lib/styles'
import type { Category, ExpenseSource, PaymentMethod, Supplier } from '@/lib/types'
import { cx, withAlpha } from '@/lib/utils'

// Piezas que comparten el formulario de un gasto y el de varios gastos.

export type SupplierChoice = { id: string | null; name: string }

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', CURRENCY_DECIMALS > 0 ? '.' : '000', '0', 'back']

/** Aplica una tecla al monto escrito. Internamente el separador decimal es ".". */
export function applyKey(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1)
  const [integer, fraction] = current.split('.')
  if (key === '.') return CURRENCY_DECIMALS === 0 || fraction !== undefined ? current : `${integer || '0'}.`
  if (fraction !== undefined) return current + key.slice(0, Math.max(CURRENCY_DECIMALS - fraction.length, 0))
  const nextInteger = (integer + key).replace(/^0+/, '')
  return nextInteger.length > MAX_INTEGER_DIGITS ? current : nextInteger
}

/** Teclado numérico en pantalla. `keyClassName` ajusta el alto de las teclas. */
export function Keypad({
  onPress,
  keyClassName = 'h-12 [@media(min-height:720px)]:h-14',
}: {
  onPress: (key: string) => void
  keyClassName?: string
}) {
  return (
    <div className="mt-auto grid grid-cols-3 gap-2 px-4 pt-4">
      {KEYPAD.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          aria-label={key === 'back' ? 'Borrar último número' : key === '.' ? 'Decimales' : key}
          className={cx(
            'grid select-none place-items-center rounded-2xl text-2xl font-semibold tabular-nums transition active:scale-95',
            keyClassName,
            key === 'back'
              ? 'text-stone-500 hover:bg-stone-100 active:bg-stone-200'
              : 'bg-stone-100 text-stone-900 hover:bg-stone-200 active:bg-stone-300',
          )}
        >
          {key === 'back' ? <Delete className="size-7" /> : key === '.' ? DECIMAL_SEPARATOR : key}
        </button>
      ))}
    </div>
  )
}

/** Quién hizo el gasto: caja menor o jefe. */
export function SourceToggle({ value, onChange }: { value: ExpenseSource; onChange: (next: ExpenseSource) => void }) {
  return (
    <div role="group" aria-label="¿Quién hizo el gasto?" className="grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1">
      {EXPENSE_SOURCE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cx(
            'flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold transition',
            value === key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
          )}
        >
          <span aria-hidden>{EXPENSE_SOURCES[key].emoji}</span>
          <span className="truncate">{EXPENSE_SOURCES[key].label}</span>
        </button>
      ))}
    </div>
  )
}

export function CategoryGrid({
  categories,
  selectedId,
  invalid = false,
  labelledBy,
  onPick,
}: {
  categories: Category[]
  selectedId: string | null
  /** Marca la cuadrícula en rojo cuando falta elegir. */
  invalid?: boolean
  labelledBy?: string
  onPick: (id: string) => void
}) {
  if (categories.length === 0) {
    return (
      <p className="rounded-2xl bg-stone-50 p-4 text-center text-sm text-stone-500">
        No tienes categorías activas. Créalas en la sección Categorías.
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cx('grid grid-cols-4 gap-2', invalid && 'animate-shake')}
    >
      {categories.map((item) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(item.id)}
            className={cx(
              'relative flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 transition active:scale-95',
              !selected && 'bg-stone-50 ring-1 hover:bg-stone-100',
              !selected && (invalid ? 'ring-red-300' : 'ring-stone-200'),
            )}
            style={
              selected
                ? { backgroundColor: withAlpha(item.color, 0.14), boxShadow: `inset 0 0 0 2px ${item.color}` }
                : undefined
            }
          >
            <span className="text-2xl leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-stone-700">
              {item.name}
            </span>
            {selected && (
              <span
                className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full text-white"
                style={{ backgroundColor: item.color }}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function PaymentChoices({ value, onPick }: { value: PaymentMethod; onPick: (next: PaymentMethod) => void }) {
  return (
    <div className="space-y-2">
      {PAYMENT_METHOD_KEYS.map((key) => (
        <ChoiceButton key={key} selected={value === key} onClick={() => onPick(key)}>
          <span className="text-2xl" aria-hidden>
            {PAYMENT_METHODS[key].emoji}
          </span>
          <span className="flex-1 font-semibold">{PAYMENT_METHODS[key].label}</span>
        </ChoiceButton>
      ))}
    </div>
  )
}

export function NoteField({
  value,
  onChange,
  onDone,
}: {
  value: string
  onChange: (next: string) => void
  onDone: () => void
}) {
  return (
    <>
      <textarea
        data-autofocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={200}
        rows={3}
        placeholder="Ej: Factura 1234, 20 kg de pollo"
        className={textarea}
      />
      <p className="mt-1 text-right text-xs text-stone-400">{value.length}/200</p>
      <button type="button" onClick={onDone} className={cx(buttonClass(), 'mt-2 w-full')}>
        Listo
      </button>
    </>
  )
}

export function DetailButton({
  label,
  value,
  active,
  invalid = false,
  icon,
  onClick,
}: {
  label: string
  value: string | null
  active: boolean
  invalid?: boolean
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={value ? `${label}: ${value}` : `Agregar ${label.toLowerCase()}`}
      className={cx(
        'flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-xs transition active:scale-95',
        invalid && 'animate-shake',
        invalid
          ? 'bg-red-50 text-red-700 ring-1 ring-red-300'
          : active
            ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
            : 'bg-stone-50 text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100',
      )}
    >
      {icon}
      <span className="w-full truncate text-center font-medium">{value ?? label}</span>
    </button>
  )
}

export function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99]',
        selected ? 'bg-brand-50 ring-2 ring-brand-500' : 'ring-1 ring-stone-200 hover:bg-stone-50',
      )}
    >
      {children}
      {selected && <Check className="size-5 shrink-0 text-brand-600" />}
    </button>
  )
}

export function SupplierPicker({
  suppliers,
  categories,
  selected,
  onSelect,
}: {
  suppliers: Supplier[]
  categories: Category[]
  selected: SupplierChoice | null
  onSelect: (choice: SupplierChoice | null) => void
}) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const normalizedQuery = normalizeText(query)
  const categoryById = new Map(categories.map((item) => [item.id, item]))
  const matches = normalizedQuery
    ? suppliers.filter((item) => normalizeText(item.name).includes(normalizedQuery))
    : suppliers
  const exactMatch = suppliers.find((item) => normalizeText(item.name) === normalizedQuery)
  const canCreate = trimmed !== '' && !exactMatch
  const pendingNew = selected && selected.id === null && normalizeText(selected.name) !== normalizedQuery ? selected : null

  function selectWithEnter() {
    const match = exactMatch ?? (matches.length === 1 ? matches[0] : undefined)
    if (match) onSelect({ id: match.id, name: match.name })
    else if (canCreate) onSelect({ id: null, name: trimmed })
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          data-autofocus
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              selectWithEnter()
            }
          }}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="done"
          aria-label="Nombre del proveedor"
          placeholder="Nombre del proveedor"
          className={cx(inputBase, 'bg-stone-100 pl-11 pr-4 focus:bg-white')}
        />
      </div>

      <ul className="-mx-2 mt-3 max-h-[45dvh] space-y-0.5 overflow-y-auto">
        {pendingNew && (
          <li>
            <OptionRow
              selected
              onClick={() => onSelect(pendingNew)}
              icon={<CategoryIcon icon="🆕" color="#14b8a6" size="sm" />}
              title={pendingNew.name}
              subtitle="Nuevo · se guarda junto con el gasto"
            />
          </li>
        )}
        {matches.map((item) => {
          const defaultCategory = item.default_category_id ? categoryById.get(item.default_category_id) : undefined
          return (
            <li key={item.id}>
              <OptionRow
                selected={selected?.id === item.id}
                onClick={() => onSelect({ id: item.id, name: item.name })}
                icon={
                  <CategoryIcon icon={defaultCategory?.icon ?? '🏪'} color={defaultCategory?.color ?? '#a8a29e'} size="sm" />
                }
                title={item.name}
                subtitle={defaultCategory?.name}
              />
            </li>
          )
        })}
        {/* Los proveedores existentes van primero para no crear duplicados por error. */}
        {canCreate && (
          <li>
            <OptionRow
              onClick={() => onSelect({ id: null, name: trimmed })}
              icon={
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Plus className="size-5" />
                </span>
              }
              title={`Agregar “${trimmed}”`}
              subtitle="Proveedor nuevo"
            />
          </li>
        )}
        {selected && (
          <li>
            <OptionRow
              onClick={() => onSelect(null)}
              icon={
                <span className="grid size-10 place-items-center rounded-xl bg-stone-100 text-stone-500">
                  <X className="size-5" />
                </span>
              }
              title="Sin proveedor"
            />
          </li>
        )}
      </ul>

      {suppliers.length === 0 && trimmed === '' && (
        <p className="px-2 py-6 text-center text-sm text-stone-500">
          Aún no tienes proveedores. Escribe el nombre y toca “Agregar”.
        </p>
      )}
    </div>
  )
}

function OptionRow({
  icon,
  title,
  subtitle,
  selected = false,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition',
        selected ? 'bg-brand-50' : 'hover:bg-stone-50 active:bg-stone-100',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && <span className="block truncate text-sm text-stone-500">{subtitle}</span>}
      </span>
      {selected && <Check className="size-5 shrink-0 text-brand-600" />}
    </button>
  )
}
