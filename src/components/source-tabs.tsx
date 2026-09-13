import Link from 'next/link'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS } from '@/lib/constants'
import type { ExpenseSource } from '@/lib/types'
import { cx } from '@/lib/utils'

const OPTIONS: { value: ExpenseSource | null; label: string; emoji?: string }[] = [
  { value: null, label: 'Todo' },
  ...EXPENSE_SOURCE_KEYS.map((key) => ({ value: key, label: EXPENSE_SOURCES[key].label, emoji: EXPENSE_SOURCES[key].emoji })),
]

type SourceTabsProps = {
  value: ExpenseSource | null
  /** En páginas del servidor: la URL de cada opción. */
  hrefFor?: (value: ExpenseSource | null) => string
  /** En componentes del cliente: qué hacer al elegir una opción. */
  onChange?: (value: ExpenseSource | null) => void
}

/** Selector "Todo · Caja menor · Jefe" para ver los gastos por separado. */
export function SourceTabs({ value, hrefFor, onChange }: SourceTabsProps) {
  return (
    <div
      role="group"
      aria-label="Ver gastos de caja menor o del jefe"
      // "Caja menor" es el texto más largo, así que su pestaña es más ancha.
      className="grid grid-cols-[1fr_1.4fr_1fr] gap-1 rounded-2xl bg-stone-200/70 p-1"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value
        const className = cx(
          'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 text-sm font-semibold transition',
          selected ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900',
        )
        const content = (
          <>
            {option.emoji && <span aria-hidden>{option.emoji}</span>}
            <span className="truncate">{option.label}</span>
          </>
        )

        return hrefFor ? (
          <Link
            key={option.label}
            href={hrefFor(option.value)}
            scroll={false}
            aria-current={selected ? 'true' : undefined}
            className={className}
          >
            {content}
          </Link>
        ) : (
          <button
            key={option.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange?.(option.value)}
            className={className}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
