'use client'

import { CalendarRange, Plus, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DayFilter } from '@/components/day-filter'
import { EmptyState } from '@/components/empty-state'
import { ExpenseRow } from '@/components/expense-row'
import { MonthSwitcher } from '@/components/month-switcher'
import { SourceTabs } from '@/components/source-tabs'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS, PAYMENT_METHODS } from '@/lib/constants'
import type { DayRange } from '@/lib/dates'
import { addDays, formatDayHeading, formatFullDate, formatMonthName } from '@/lib/dates'
import { formatMoney, normalizeText } from '@/lib/format'
import { historyHref } from '@/lib/history-url'
import { buttonClass, card, inputBase } from '@/lib/styles'
import type { Category, Expense, ExpenseSource } from '@/lib/types'
import { buildHref, cx, plural } from '@/lib/utils'

type HistoryListProps = {
  expenses: Expense[]
  categories: Category[]
  month: string
  currentMonth: string
  today: string
  /** Días que se están viendo. null = el mes completo. */
  range: DayRange | null
  initialCategoryId: string | null
  initialSource: ExpenseSource | null
  truncated: boolean
}

export function HistoryList({
  expenses,
  categories,
  month,
  currentMonth,
  today,
  range,
  initialCategoryId,
  initialSource,
  truncated,
}: HistoryListProps) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [source, setSource] = useState(initialSource)

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])

  const sourceExpenses = useMemo(
    () => (source ? expenses.filter((item) => item.source === source) : expenses),
    [expenses, source],
  )

  const filterChips = useMemo(() => {
    const used = new Set(sourceExpenses.map((item) => item.category_id))
    return categories.filter((item) => used.has(item.id) || item.id === categoryId)
  }, [sourceExpenses, categories, categoryId])

  const filtered = useMemo(() => {
    const text = normalizeText(query)
    // Si se escriben solo números, se busca por monto ("350.000" → 350000).
    const digits = /^[\d\s.,$]+$/.test(query.trim()) ? query.replace(/\D/g, '') : ''
    return sourceExpenses.filter((item) => {
      if (categoryId && item.category_id !== categoryId) return false
      if (digits) return String(Math.round(item.amount)).includes(digits)
      if (!text) return true
      const searchable = [
        item.supplier_name,
        item.description,
        categoryById.get(item.category_id)?.name,
        PAYMENT_METHODS[item.payment_method].label,
      ]
        .filter(Boolean)
        .join(' ')
      return normalizeText(searchable).includes(text)
    })
  }, [sourceExpenses, query, categoryId, categoryById])

  const days = useMemo(() => {
    const groups = new Map<string, Expense[]>()
    for (const item of filtered) {
      const group = groups.get(item.spent_on)
      if (group) group.push(item)
      else groups.set(item.spent_on, [item])
    }
    return [...groups].map(([day, items]) => ({ day, items, total: items.reduce((sum, item) => sum + item.amount, 0) }))
  }, [filtered])

  const total = filtered.reduce((sum, item) => sum + item.amount, 0)
  const totalFor = (key: ExpenseSource) =>
    filtered.reduce((sum, item) => (item.source === key ? sum + item.amount : sum), 0)
  const selectedCategory = categoryId ? categoryById.get(categoryId) : undefined
  /** Filtros que se conservan al cambiar de mes o de días. */
  const navParams = { categoria: categoryId ?? undefined, origen: source ? EXPENSE_SOURCES[source].slug : undefined }

  function syncUrl(key: string, value: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }

  function selectCategory(id: string | null) {
    setCategoryId(id)
    syncUrl('categoria', id)
  }

  function selectSource(next: ExpenseSource | null) {
    setSource(next)
    syncUrl('origen', next ? EXPENSE_SOURCES[next].slug : null)
  }

  function clearFilters() {
    setQuery('')
    selectCategory(null)
    selectSource(null)
  }

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-stone-500">Toca un gasto para editarlo o eliminarlo.</p>
      </header>

      {/* Con un tramo de días elegido manda el tramo, que puede cruzar meses. */}
      {range === null && (
        <MonthSwitcher month={month} currentMonth={currentMonth} basePath="/historial" params={navParams} />
      )}

      <DayFilter month={month} currentMonth={currentMonth} today={today} range={range} params={navParams} />

      {expenses.length > 0 && (
        <>
          <SourceTabs value={source} onChange={selectSource} />

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar proveedor, nota o monto"
              aria-label="Buscar gastos"
              className={cx(inputBase, 'bg-white pl-11 pr-4 shadow-sm ring-1 ring-stone-200')}
            />
          </div>

          {filterChips.length > 0 && (
            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por categoría">
              <FilterChip selected={categoryId === null} onClick={() => selectCategory(null)}>
                Todas
              </FilterChip>
              {filterChips.map((item) => (
                <FilterChip
                  key={item.id}
                  selected={item.id === categoryId}
                  onClick={() => selectCategory(item.id === categoryId ? null : item.id)}
                >
                  <span aria-hidden>{item.icon}</span> {item.name}
                </FilterChip>
              ))}
            </div>
          )}
        </>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title={emptyTitle(range, month, today)}
          description={
            range
              ? 'Prueba con otros días o vuelve al mes completo.'
              : month === currentMonth
                ? 'Cuando registres un gasto aparecerá aquí.'
                : 'Prueba con otro mes.'
          }
          action={
            range ? (
              <div className="grid gap-2">
                {range.from === range.through && (
                  <Link href={buildHref('/agregar/varios', { fecha: range.from })} className={buttonClass()}>
                    <Plus className="size-5" />
                    Registrar gastos de ese día
                  </Link>
                )}
                <Link href={historyHref({ month, currentMonth, params: navParams })} className={buttonClass('secondary')}>
                  <CalendarRange className="size-5" />
                  Ver todo el mes
                </Link>
              </div>
            ) : month === currentMonth ? (
              <Link href="/agregar" className={buttonClass()}>
                <Plus className="size-5" />
                Registrar gasto
              </Link>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No encontramos gastos"
          description="Prueba con otra palabra o quita los filtros."
          action={
            <button type="button" onClick={clearFilters} className={buttonClass('secondary')}>
              <X className="size-5" />
              Quitar filtros
            </button>
          }
        />
      ) : (
        <>
          <div className="px-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-stone-500">
                {plural(filtered.length, 'gasto', 'gastos')}
                {source ? ` ${EXPENSE_SOURCES[source].ofLabel}` : ''}
                {selectedCategory ? ` en ${selectedCategory.name}` : ''}
              </p>
              <p className="shrink-0 text-xl font-bold tabular-nums">{formatMoney(total)}</p>
            </div>
            {source === null && (
              <p className="mt-0.5 text-right text-xs text-stone-500">
                {EXPENSE_SOURCE_KEYS.map(
                  (key) => `${EXPENSE_SOURCES[key].emoji} ${EXPENSE_SOURCES[key].label} ${formatMoney(totalFor(key))}`,
                ).join(' · ')}
              </p>
            )}
          </div>

          {days.map(({ day, items, total: dayTotal }) => (
            <section key={day} className={cx(card, 'overflow-hidden')}>
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-2 text-sm">
                <h2 className="font-semibold text-stone-700">{formatDayHeading(day, today)}</h2>
                <span className="flex items-center gap-1.5">
                  <span className="tabular-nums text-stone-500">{formatMoney(dayTotal)}</span>
                  <Link
                    href={buildHref('/agregar/varios', { fecha: day })}
                    aria-label={`Agregar gastos a: ${formatDayHeading(day, today)}`}
                    className="-my-1.5 -mr-2 grid size-8 place-items-center rounded-full text-brand-700 transition hover:bg-stone-200"
                  >
                    <Plus className="size-4" />
                  </Link>
                </span>
              </div>
              <ul className="divide-y divide-stone-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <ExpenseRow expense={item} category={categoryById.get(item.category_id)} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {truncated && (
            <p className="text-center text-xs text-stone-500">
              Se muestran los primeros 1.000 gastos {range ? 'de estos días' : 'del mes'}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** "No hay gastos en octubre", "No hay gastos hoy", "No hay gastos en esos días"… */
function emptyTitle(range: DayRange | null, month: string, today: string): string {
  if (!range) return `No hay gastos en ${formatMonthName(month)}`
  if (range.from !== range.through) return 'No hay gastos en esos días'
  if (range.from === today) return 'No hay gastos hoy'
  if (range.from === addDays(today, -1)) return 'No hay gastos ayer'
  return `No hay gastos el ${formatFullDate(range.from)}`
}

function FilterChip({
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
        'h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition',
        selected ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50',
      )}
    >
      {children}
    </button>
  )
}
