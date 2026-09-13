import { Paperclip } from 'lucide-react'
import Link from 'next/link'
import { CategoryIcon } from '@/components/category-icon'
import { EXPENSE_SOURCES, PAYMENT_METHODS } from '@/lib/constants'
import { formatShortDay } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import type { Category, Expense } from '@/lib/types'
import { cx } from '@/lib/utils'

type ExpenseRowProps = {
  expense: Expense
  category: Category | undefined
  today: string
  showDate?: boolean
}

export function ExpenseRow({ expense, category, today, showDate = false }: ExpenseRowProps) {
  const categoryName = category?.name ?? 'Sin categoría'
  const title = expense.supplier_name ?? expense.description ?? categoryName
  const source = EXPENSE_SOURCES[expense.source]
  const details = [
    showDate ? formatShortDay(expense.spent_on, today) : null,
    title === categoryName ? null : categoryName,
    expense.supplier_name ? expense.description : null,
    PAYMENT_METHODS[expense.payment_method].label,
  ].filter(Boolean)

  return (
    <Link
      href={`/gastos/${expense.id}`}
      className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50 active:bg-stone-100"
    >
      <CategoryIcon icon={category?.icon ?? '📋'} color={category?.color ?? '#a8a29e'} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          <span className="truncate">{title}</span>
          {expense.receipt_path && (
            <>
              <Paperclip className="size-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="sr-only">(con foto de la factura)</span>
            </>
          )}
        </p>
        <p className="truncate text-sm text-stone-500">{details.join(' · ')}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
        <p
          className={cx(
            'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none',
            source.badgeClass,
          )}
        >
          <span aria-hidden>{source.emoji}</span>
          {source.label}
        </p>
      </div>
    </Link>
  )
}
