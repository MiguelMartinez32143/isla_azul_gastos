import { LOCALE, TIME_ZONE } from './config'

// Las fechas se manejan como texto "YYYY-MM-DD" (y los meses como "YYYY-MM")
// para que no cambien de día por diferencias de zona horaria.

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha de hoy en la zona horaria del restaurante. */
export function todayISO(): string {
  return isoFormatter.format(new Date())
}

/** Una fecha "YYYY-MM-DD" como Date (medianoche UTC), para lo que necesite objetos Date. */
export function toUTCDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(iso: string, days: number): string {
  const date = toUTCDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toUTCDate(value).toISOString().slice(0, 10) === value
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** Rango [from, to) de un mes "YYYY-MM". */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` }
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const monthFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthNameFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' })
const longDayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const shortDayFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortDayWithYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fullDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' })
const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' })
const numericDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "Septiembre de 2026" */
export function formatMonth(month: string): string {
  return capitalize(monthFormatter.format(toUTCDate(`${month}-01`)))
}

/** "septiembre" */
export function formatMonthName(month: string): string {
  return monthNameFormatter.format(toUTCDate(`${month}-01`))
}

/** "Miércoles, 9 de septiembre" */
export function formatLongDate(iso: string): string {
  return capitalize(longDayFormatter.format(toUTCDate(iso)))
}

/** "Hoy", "Ayer" o "Miércoles, 9 de septiembre" */
export function formatDayHeading(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  return formatLongDate(iso)
}

/** "12 de octubre de 2026" */
export function formatFullDate(iso: string): string {
  return fullDateFormatter.format(toUTCDate(iso))
}

/** "12 de octubre" */
export function formatDayMonth(iso: string): string {
  return dayMonthFormatter.format(toUTCDate(iso))
}

/** "Lunes" */
export function formatWeekday(iso: string): string {
  return capitalize(weekdayFormatter.format(toUTCDate(iso)))
}

/** "Hoy", "Ayer" o "9 sept" */
export function formatShortDay(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  const formatter = iso.slice(0, 4) === today.slice(0, 4) ? shortDayFormatter : shortDayWithYearFormatter
  return formatter.format(toUTCDate(iso))
}

/** Hasta cuántos días atrás (contando hoy) "Varios gastos" muestra lo ya registrado. */
export const DAYS_WITH_TOTALS = 31

/** Tramo de días elegido en el historial. Incluye el primero y el último. */
export type DayRange = { from: string; through: string }

/**
 * Lee ?desde=&hasta= del historial: acepta un solo día, ordena los extremos si
 * vienen al revés y no deja pedir días que todavía no llegan.
 */
export function normalizeDayRange(from: unknown, through: unknown, today: string): DayRange | null {
  const start = isValidISODate(from) ? from : null
  const end = isValidISODate(through) ? through : null
  const first = start ?? end
  const second = end ?? start
  if (!first || !second) return null
  const [earlier, later] = first <= second ? [first, second] : [second, first]
  const clamp = (day: string) => (day > today ? today : day)
  return { from: clamp(earlier), through: clamp(later) }
}

/** Rango [from, to) que cubre todos los días del tramo. */
export function dayRangeBounds({ from, through }: DayRange): { from: string; to: string } {
  return { from, to: addDays(through, 1) }
}

/** "Hoy", "Ayer", "1–7 de octubre" o "28 sept – 4 oct" */
export function formatDayRange({ from, through }: DayRange, today: string): string {
  if (from === through) return formatDayHeading(from, today)
  // El texto se arma a mano porque Intl.formatRange separa el rango con caracteres
  // distintos según la versión de ICU: el servidor y el navegador escribirían textos
  // diferentes y React tendría que rehacer esa parte de la página (error de hidratación).
  const year = today.slice(0, 4)
  const sameYear = from.slice(0, 4) === year && through.slice(0, 4) === year
  // Dentro del mismo mes se escribe completo ("1–12 de octubre"); si cruza meses se
  // abrevia para que quepa en la pantalla del celular sin cortarse.
  if (from.slice(0, 7) === through.slice(0, 7)) {
    const formatter = sameYear ? dayMonthFormatter : fullDateFormatter
    return `${Number(from.slice(8, 10))}–${formatter.format(toUTCDate(through))}`
  }
  const formatter = sameYear ? shortDayFormatter : numericDateFormatter
  return `${formatter.format(toUTCDate(from))} – ${formatter.format(toUTCDate(through))}`
}
