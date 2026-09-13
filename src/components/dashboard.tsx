import { TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { CategoryIcon } from '@/components/category-icon'
import { ExpenseRow } from '@/components/expense-row'
import { ProgressBar } from '@/components/progress-bar'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS } from '@/lib/constants'
import { formatMonthName } from '@/lib/dates'
import { formatMoney, formatPercent } from '@/lib/format'
import { card } from '@/lib/styles'
import type { Category, Expense, ExpenseSource } from '@/lib/types'
import { cx, plural } from '@/lib/utils'

/** A partir de qué porcentaje del presupuesto se muestra en amarillo. */
const BUDGET_WARNING_RATIO = 0.85

function budgetStatus(ratio: number): 'ok' | 'warning' | 'over' {
  return ratio > 1 ? 'over' : ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'ok'
}

/** Participación en el total; evita mostrar "0%" en gastos pequeños. */
function formatShare(ratio: number): string {
  return ratio > 0 && ratio < 0.01 ? 'Menos del 1%' : formatPercent(ratio)
}

type MonthSummaryCardProps = {
  month: string
  /** Origen que se está viendo; null = todos. */
  source: ExpenseSource | null
  total: number
  previousTotal: number
  /** Con qué se compara, ej. "los mismos días de agosto". */
  comparisonLabel: string
  sourceTotals: Record<ExpenseSource, number>
  hrefForSource: (source: ExpenseSource) => string
  budget: number
  budgetSpent: number
  allCategoriesBudgeted: boolean
}

export function MonthSummaryCard({
  month,
  source,
  total,
  previousTotal,
  comparisonLabel,
  sourceTotals,
  hrefForSource,
  budget,
  budgetSpent,
  allCategoriesBudgeted,
}: MonthSummaryCardProps) {
  const change = previousTotal > 0 ? (total - previousTotal) / previousTotal : null
  const roundedChange = change === null ? null : Math.round(change * 100)
  const budgetRatio = budget > 0 ? budgetSpent / budget : null

  return (
    <section className="rounded-3xl bg-brand-700 p-5 text-white shadow-sm">
      <p className="text-sm font-medium text-brand-100">
        {source ? `Gastos ${EXPENSE_SOURCES[source].ofLabel}` : 'Gastado'} en {formatMonthName(month)}
      </p>
      <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{formatMoney(total)}</p>

      {roundedChange !== null && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm">
          {roundedChange > 0 && <TrendingUp className="size-4" aria-hidden />}
          {roundedChange < 0 && <TrendingDown className="size-4" aria-hidden />}
          {roundedChange === 0
            ? `Casi igual que ${comparisonLabel}`
            : `${formatPercent(Math.abs(roundedChange) / 100)} ${roundedChange > 0 ? 'más' : 'menos'} que ${comparisonLabel}`}
        </p>
      )}

      {source === null && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {EXPENSE_SOURCE_KEYS.map((key) => (
            <Link
              key={key}
              href={hrefForSource(key)}
              scroll={false}
              className="min-w-0 rounded-2xl bg-white/10 px-3 py-2.5 transition hover:bg-white/20"
            >
              <span className="block truncate text-xs font-medium text-brand-100">
                <span aria-hidden>{EXPENSE_SOURCES[key].emoji}</span> {EXPENSE_SOURCES[key].label}
              </span>
              <span className="mt-0.5 block truncate font-semibold tabular-nums">{formatMoney(sourceTotals[key])}</span>
              <span className="block text-xs text-brand-100">
                {formatShare(total > 0 ? sourceTotals[key] / total : 0)} del mes
              </span>
            </Link>
          ))}
        </div>
      )}

      {budgetRatio !== null && (
        <div className="mt-5 border-t border-white/15 pt-4">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-brand-100">Presupuesto</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(budgetSpent)} de {formatMoney(budget)}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar
              ratio={budgetRatio}
              color={{ ok: '#ffffff', warning: '#fcd34d', over: '#fca5a5' }[budgetStatus(budgetRatio)]}
              trackClassName="bg-white/20"
            />
          </div>
          <p className="mt-2 text-sm font-medium">
            {budgetRatio > 1
              ? `⚠️ Te pasaste ${formatMoney(budgetSpent - budget)}`
              : `Te quedan ${formatMoney(budget - budgetSpent)}`}
          </p>
          {!allCategoriesBudgeted && (
            <p className="mt-1 text-xs text-brand-100">Solo cuenta las categorías que tienen presupuesto.</p>
          )}
        </div>
      )}
    </section>
  )
}

export type CategoryTotalRow = { category: Category; total: number; entries: number }

type CategoryBreakdownProps = {
  rows: CategoryTotalRow[]
  total: number
  /** Los presupuestos cubren caja menor + jefe, así que solo se muestran al ver todo. */
  showBudgets: boolean
  historyHrefFor: (categoryId: string) => string
}

export function CategoryBreakdown({ rows, total, showBudgets, historyHrefFor }: CategoryBreakdownProps) {
  return (
    <section className={cx(card, 'overflow-hidden')}>
      <div className="px-5 pb-1 pt-4">
        <h2 className="font-semibold">¿En qué se fue el dinero?</h2>
        <p className="text-xs text-stone-500">Toca una categoría para ver sus gastos.</p>
      </div>
      <ul className="divide-y divide-stone-100">
        {rows.map(({ category, total: spent, entries }) => {
          const budget = showBudgets ? category.monthly_budget : null
          const ratio = budget ? spent / budget : total > 0 ? spent / total : 0
          const status = budget ? budgetStatus(ratio) : null

          return (
            <li key={category.id}>
              <Link
                href={historyHrefFor(category.id)}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50 active:bg-stone-100"
              >
                <CategoryIcon icon={category.icon} color={category.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{category.name}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatMoney(spent)}</p>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar
                      ratio={ratio}
                      color={status === 'over' ? '#dc2626' : status === 'warning' ? '#f59e0b' : category.color}
                    />
                  </div>
                  <p
                    className={cx(
                      'mt-1 truncate text-xs',
                      status === 'over' && 'font-medium text-red-600',
                      status === 'warning' && 'font-medium text-amber-700',
                      (status === null || status === 'ok') && 'text-stone-500',
                    )}
                  >
                    {budget
                      ? status === 'over'
                        ? `Te pasaste ${formatMoney(spent - budget)} del presupuesto`
                        : `Quedan ${formatMoney(budget - spent)} de ${formatMoney(budget)}`
                      : `${formatShare(ratio)} del total · ${plural(entries, 'gasto', 'gastos')}`}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type RecentExpensesProps = {
  expenses: Expense[]
  categories: Category[]
  today: string
  historyHref: string
}

export function RecentExpenses({ expenses, categories, today, historyHref }: RecentExpensesProps) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return (
    <section className={cx(card, 'overflow-hidden')}>
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 className="font-semibold">Últimos gastos</h2>
        <Link href={historyHref} className="text-sm font-medium text-brand-700 hover:underline">
          Ver todos
        </Link>
      </div>
      <ul className="divide-y divide-stone-100">
        {expenses.map((expense) => (
          <li key={expense.id}>
            <ExpenseRow expense={expense} category={categoryById.get(expense.category_id)} today={today} showDate />
          </li>
        ))}
      </ul>
    </section>
  )
}
