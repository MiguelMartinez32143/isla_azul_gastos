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

function toUTCDate(iso: string): Date {
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

/** "Hoy", "Ayer" o "9 sept" */
export function formatShortDay(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  const formatter = iso.slice(0, 4) === today.slice(0, 4) ? shortDayFormatter : shortDayWithYearFormatter
  return formatter.format(toUTCDate(iso))
}
