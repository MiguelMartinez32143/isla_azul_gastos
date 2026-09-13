import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CategoryBreakdown, MonthSummaryCard, RecentExpenses } from '@/components/dashboard'
import { EmptyState } from '@/components/empty-state'
import { MonthSwitcher } from '@/components/month-switcher'
import { PendingRecurring } from '@/components/pending-recurring'
import { SourceTabs } from '@/components/source-tabs'
import { requireUser } from '@/lib/auth'
import { EXPENSE_SOURCES, sourceFromSlug } from '@/lib/constants'
import {
  getCategories,
  getCategoryTotals,
  getExpenses,
  getRecurringExpenses,
  getRegisteredRecurringIds,
  sumTotals,
  totalsByCategory,
  totalsBySource,
} from '@/lib/data'
import {
  addDays,
  daysInMonth,
  formatLongDate,
  formatMonthName,
  isValidMonth,
  monthRange,
  shiftMonth,
  todayISO,
} from '@/lib/dates'
import { buttonClass } from '@/lib/styles'
import type { ExpenseSource } from '@/lib/types'
import { buildHref } from '@/lib/utils'

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const { mes, origen } = await searchParams
  const today = todayISO()
  const currentMonth = today.slice(0, 7)
  const month = isValidMonth(mes) && mes <= currentMonth ? mes : currentMonth
  const isCurrentMonth = month === currentMonth
  const source = sourceFromSlug(origen)
  const sourceSlug = source ? EXPENSE_SOURCES[source].slug : undefined
  const monthParam = isCurrentMonth ? undefined : month
  const todayDay = Number(today.slice(8, 10))

  // Se compara con el mes anterior. Si el mes está en curso, solo con los mismos días.
  const { from, to } = monthRange(month)
  const previousMonth = shiftMonth(month, -1)
  const previousFrom = monthRange(previousMonth).from
  const comparedDays = Math.min(todayDay, daysInMonth(previousMonth))
  const previousTo = isCurrentMonth ? addDays(previousFrom, comparedDays) : from
  const comparisonLabel = isCurrentMonth
    ? `los mismos días de ${formatMonthName(previousMonth)}`
    : formatMonthName(previousMonth)

  const { supabase } = await requireUser()
  const [categories, rows, previousRows, recentExpenses, recurring, registeredRecurring] = await Promise.all([
    getCategories(supabase),
    getCategoryTotals(supabase, from, to),
    getCategoryTotals(supabase, previousFrom, previousTo),
    getExpenses(supabase, { from, to, source, limit: 5 }),
    // Los gastos fijos pendientes solo se muestran en el mes en curso.
    isCurrentMonth ? getRecurringExpenses(supabase) : Promise.resolve([]),
    isCurrentMonth ? getRegisteredRecurringIds(supabase, { from, to }) : Promise.resolve(new Set<string>()),
  ])

  const totals = totalsByCategory(rows, source)
  const total = sumTotals(totals)

  // Los presupuestos son por categoría (caja menor + jefe), así que solo se muestran al ver todo.
  const showBudgets = source === null
  const activeCategories = categories.filter((category) => category.is_active)
  const budgeted = showBudgets ? activeCategories.filter((category) => category.monthly_budget) : []
  const budget = budgeted.reduce((sum, category) => sum + (category.monthly_budget ?? 0), 0)
  const budgetSpent = budgeted.reduce((sum, category) => sum + (totals.get(category.id)?.total ?? 0), 0)

  const categoryRows = categories
    .map((category) => ({
      category,
      total: totals.get(category.id)?.total ?? 0,
      entries: totals.get(category.id)?.entries ?? 0,
    }))
    .filter((row) => row.total > 0 || (showBudgets && row.category.is_active && row.category.monthly_budget))
    .sort((a, b) => b.total - a.total)

  const recurringInView = recurring.filter((item) => item.is_active && (!source || item.source === source))
  const pendingRecurring = recurringInView.filter((item) => !registeredRecurring.has(item.id))

  const homeHrefFor = (next: ExpenseSource | null) =>
    buildHref('/', { mes: monthParam, origen: next ? EXPENSE_SOURCES[next].slug : undefined })

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <p className="text-sm text-stone-500">{formatLongDate(today)}</p>
        <h1 className="text-2xl font-bold">Resumen de gastos</h1>
      </header>

      <MonthSwitcher month={month} currentMonth={currentMonth} basePath="/" params={{ origen: sourceSlug }} />
      <SourceTabs value={source} hrefFor={homeHrefFor} />

      {isCurrentMonth && (
        <PendingRecurring
          pending={pendingRecurring}
          registeredCount={recurringInView.length - pendingRecurring.length}
          categories={categories}
          todayDay={todayDay}
          lastDayOfMonth={daysInMonth(month)}
        />
      )}

      {total === 0 ? (
        <EmptyState
          emoji={source ? EXPENSE_SOURCES[source].emoji : '🧾'}
          title={[
            isCurrentMonth ? 'Aún no hay gastos' : 'No hubo gastos',
            source ? EXPENSE_SOURCES[source].ofLabel : null,
            isCurrentMonth ? 'este mes' : `en ${formatMonthName(month)}`,
          ]
            .filter(Boolean)
            .join(' ')}
          description={
            isCurrentMonth ? 'Registra cada compra o pago y aquí verás en qué se va el dinero.' : undefined
          }
          action={
            isCurrentMonth ? (
              <Link href="/agregar" className={buttonClass()}>
                <Plus className="size-5" />
                Registrar un gasto
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <MonthSummaryCard
            month={month}
            source={source}
            total={total}
            previousTotal={sumTotals(totalsByCategory(previousRows, source))}
            comparisonLabel={comparisonLabel}
            sourceTotals={totalsBySource(rows)}
            hrefForSource={homeHrefFor}
            budget={budget}
            budgetSpent={budgetSpent}
            allCategoriesBudgeted={budgeted.length === activeCategories.length}
          />
          <CategoryBreakdown
            rows={categoryRows}
            total={total}
            showBudgets={showBudgets}
            historyHrefFor={(categoryId) =>
              buildHref('/historial', { mes: month, categoria: categoryId, origen: sourceSlug })
            }
          />
          <RecentExpenses
            expenses={recentExpenses}
            categories={categories}
            today={today}
            historyHref={buildHref('/historial', { mes: monthParam, origen: sourceSlug })}
          />
        </>
      )}
    </div>
  )
}
