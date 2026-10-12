import type { DayRange } from './dates'

type HistoryQuery = {
  month: string
  currentMonth: string
  /** null = todo el mes. */
  range?: DayRange | null
  /** Filtros que se conservan al cambiar de días: categoría y origen. */
  params?: Record<string, string | undefined>
}

/** URL del historial. Con un tramo de días manda ?desde=&hasta=; sin él, el mes. */
export function historyHref({ month, currentMonth, range = null, params = {} }: HistoryQuery): string {
  const search = new URLSearchParams()
  if (range) {
    search.set('desde', range.from)
    if (range.through !== range.from) search.set('hasta', range.through)
  } else if (month !== currentMonth) {
    search.set('mes', month)
  }
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const query = search.toString()
  return query ? `/historial?${query}` : '/historial'
}
