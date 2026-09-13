import { CalendarClock, ChevronRight, CircleCheck } from 'lucide-react'
import Link from 'next/link'
import { CategoryIcon } from '@/components/category-icon'
import { EXPENSE_SOURCES } from '@/lib/constants'
import { formatMoney } from '@/lib/format'
import { card } from '@/lib/styles'
import type { Category, RecurringExpense } from '@/lib/types'
import { cx } from '@/lib/utils'

type PendingRecurringProps = {
  /** Gastos fijos activos que aún no se registran este mes. */
  pending: RecurringExpense[]
  /** Cuántos ya se registraron este mes. */
  registeredCount: number
  categories: Category[]
  todayDay: number
  lastDayOfMonth: number
}

/** Tarjeta del inicio con los gastos fijos que faltan por registrar en el mes. */
export function PendingRecurring({ pending, registeredCount, categories, todayDay, lastDayOfMonth }: PendingRecurringProps) {
  if (pending.length === 0 && registeredCount === 0) return null

  if (pending.length === 0) {
    return (
      <Link
        href="/gastos-fijos"
        className={cx(card, 'flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-stone-50')}
      >
        <CircleCheck className="size-5 shrink-0 text-brand-600" />
        <span className="flex-1 font-medium">Gastos fijos del mes al día</span>
        <ChevronRight className="size-4 text-stone-300" />
      </Link>
    )
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return (
    <section className={cx(card, 'overflow-hidden')}>
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-5 text-amber-600" aria-hidden />
          Gastos fijos por registrar
        </h2>
        <Link href="/gastos-fijos" className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          Administrar
        </Link>
      </div>
      <ul className="divide-y divide-stone-100">
        {pending.map((item) => {
          const category = categoryById.get(item.category_id)
          // Un gasto que vence el 31 vence el último día en los meses más cortos.
          const dueDay = Math.min(item.due_day, lastDayOfMonth)
          const status =
            dueDay < todayDay
              ? { text: `Venció el día ${dueDay}`, className: 'font-medium text-red-600' }
              : dueDay === todayDay
                ? { text: 'Vence hoy', className: 'font-medium text-amber-700' }
                : { text: `Vence el día ${dueDay}`, className: 'text-stone-500' }

          return (
            <li key={item.id}>
              <Link
                href={`/agregar?fijo=${item.id}`}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50 active:bg-stone-100"
              >
                <CategoryIcon icon={category?.icon ?? '📌'} color={category?.color ?? '#a8a29e'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-sm">
                    <span className={status.className}>{status.text}</span>
                    <span className="text-stone-500">
                      {' · '}
                      <span aria-hidden>{EXPENSE_SOURCES[item.source].emoji}</span>{' '}
                      {item.amount ? formatMoney(item.amount) : 'Monto variable'}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                  Registrar
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
