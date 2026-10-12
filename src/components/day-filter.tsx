'use client'

import { CalendarRange, Check, ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sheet } from '@/components/sheet'
import type { DayRange } from '@/lib/dates'
import { addDays, formatDayRange, formatMonthName, monthRange, normalizeDayRange } from '@/lib/dates'
import { historyHref } from '@/lib/history-url'
import { buttonClass, fieldLabel, input } from '@/lib/styles'
import { cx } from '@/lib/utils'

type DayFilterProps = {
  month: string
  currentMonth: string
  today: string
  /** null cuando se está viendo el mes completo. */
  range: DayRange | null
  /** Filtros de categoría y origen, para no perderlos al cambiar de días. */
  params: Record<string, string | undefined>
}

/**
 * Elige qué días mostrar en el historial: todo el mes, un día suelto (hoy, ayer),
 * los últimos días o un tramo exacto con el calendario del celular.
 */
export function DayFilter({ month, currentMonth, today, range, params }: DayFilterProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const bounds = monthRange(month)
  const monthStart = bounds.from
  const monthEnd = earliest(addDays(bounds.to, -1), today)
  const [from, setFrom] = useState(range?.from ?? monthStart)
  const [through, setThrough] = useState(range?.through ?? monthEnd)

  const yesterday = addDays(today, -1)
  const options: { label: string; range: DayRange | null }[] = [
    { label: `Todos los días de ${formatMonthName(month)}`, range: null },
    { label: 'Hoy', range: { from: today, through: today } },
    { label: 'Ayer', range: { from: yesterday, through: yesterday } },
    { label: 'Últimos 7 días', range: { from: addDays(today, -6), through: today } },
    { label: 'Últimos 30 días', range: { from: addDays(today, -29), through: today } },
  ]

  const hrefFor = (target: DayRange | null) => historyHref({ month, currentMonth, range: target, params })
  const pending = normalizeDayRange(from, through, today)

  function openSheet() {
    // Los campos del tramo arrancan en lo que se está viendo.
    setFrom(range?.from ?? monthStart)
    setThrough(range?.through ?? monthEnd)
    setOpen(true)
  }

  function applyRange() {
    if (!pending) return
    setOpen(false)
    router.push(hrefFor(pending))
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cx(
            'flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white px-4 shadow-sm transition',
            range ? 'ring-2 ring-brand-500' : 'ring-1 ring-stone-200/70 hover:bg-stone-50',
          )}
        >
          <CalendarRange className={cx('size-5 shrink-0', range ? 'text-brand-600' : 'text-stone-400')} aria-hidden />
          <span
            className={cx(
              'min-w-0 flex-1 truncate text-left text-sm',
              range ? 'font-semibold text-brand-800' : 'font-medium text-stone-600',
            )}
          >
            {range ? formatDayRange(range, today) : `Todos los días de ${formatMonthName(month)}`}
          </span>
          <ChevronDown className="size-4 shrink-0 text-stone-400" aria-hidden />
        </button>
        {range && (
          <Link
            href={hrefFor(null)}
            aria-label="Ver todo el mes"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-stone-500 shadow-sm ring-1 ring-stone-200/70 transition hover:bg-stone-50"
          >
            <X className="size-5" />
          </Link>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="¿Qué días quieres ver?"
        description="Un día suelto, los últimos días o el tramo que necesites."
      >
        <ul className="space-y-1">
          {options.map((option, index) => {
            const selected = sameRange(option.range, range)
            return (
              <li key={option.label}>
                <Link
                  href={hrefFor(option.range)}
                  onClick={() => setOpen(false)}
                  data-autofocus={index === 0 ? '' : undefined}
                  aria-current={selected ? 'true' : undefined}
                  className={cx(
                    'flex h-12 items-center justify-between gap-3 rounded-xl px-4 text-sm transition',
                    selected ? 'bg-brand-50 font-semibold text-brand-800' : 'font-medium hover:bg-stone-100',
                  )}
                >
                  {option.label}
                  {selected && <Check className="size-5 shrink-0 text-brand-600" aria-hidden />}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold">Un tramo exacto</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="day-from" className={fieldLabel}>
                Desde
              </label>
              <input
                id="day-from"
                type="date"
                value={from}
                max={today}
                onChange={(event) => setFrom(event.target.value)}
                className={input}
              />
            </div>
            <div>
              <label htmlFor="day-through" className={fieldLabel}>
                Hasta
              </label>
              <input
                id="day-through"
                type="date"
                value={through}
                max={today}
                onChange={(event) => setThrough(event.target.value)}
                className={input}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyRange}
            disabled={!pending}
            className={cx(buttonClass(), 'mt-4 w-full')}
          >
            {pending ? `Ver ${formatDayRange(pending, today).toLowerCase()}` : 'Elige las dos fechas'}
          </button>
        </div>
      </Sheet>
    </>
  )
}

function sameRange(a: DayRange | null, b: DayRange | null): boolean {
  if (!a || !b) return a === b
  return a.from === b.from && a.through === b.through
}

function earliest(a: string, b: string): string {
  return a <= b ? a : b
}
