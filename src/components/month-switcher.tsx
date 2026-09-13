import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatMonth, shiftMonth } from '@/lib/dates'
import { cx } from '@/lib/utils'

type MonthSwitcherProps = {
  month: string
  currentMonth: string
  basePath: string
  /** Parámetros extra que se conservan al cambiar de mes. */
  params?: Record<string, string | undefined>
}

const ARROW_CLASS = 'grid size-11 place-items-center rounded-xl text-stone-600 transition'

export function MonthSwitcher({ month, currentMonth, basePath, params = {} }: MonthSwitcherProps) {
  const hrefFor = (target: string) => {
    const search = new URLSearchParams()
    if (target !== currentMonth) search.set('mes', target)
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
    const query = search.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  const nextMonth = shiftMonth(month, 1)
  const canGoForward = nextMonth <= currentMonth

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-stone-200/70">
      <Link href={hrefFor(shiftMonth(month, -1))} aria-label="Mes anterior" className={cx(ARROW_CLASS, 'hover:bg-stone-100')}>
        <ChevronLeft className="size-5" />
      </Link>
      <div className="min-w-0 text-center leading-tight">
        <p className="font-semibold">{formatMonth(month)}</p>
        {month !== currentMonth && (
          <Link href={hrefFor(currentMonth)} className="text-xs font-medium text-brand-700 hover:underline">
            Volver al mes actual
          </Link>
        )}
      </div>
      {canGoForward ? (
        <Link href={hrefFor(nextMonth)} aria-label="Mes siguiente" className={cx(ARROW_CLASS, 'hover:bg-stone-100')}>
          <ChevronRight className="size-5" />
        </Link>
      ) : (
        <span aria-hidden className={cx(ARROW_CLASS, 'opacity-25')}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  )
}
