import type { Metadata } from 'next'
import { HistoryList } from '@/components/history-list'
import { requireUser } from '@/lib/auth'
import { sourceFromSlug } from '@/lib/constants'
import { PAGE_SIZE, getCategories, getExpenses } from '@/lib/data'
import { dayRangeBounds, isValidMonth, monthRange, normalizeDayRange, todayISO } from '@/lib/dates'
import { isUUID } from '@/lib/utils'

export const metadata: Metadata = { title: 'Historial' }

export default async function HistoryPage({ searchParams }: PageProps<'/historial'>) {
  const { mes, desde, hasta, categoria, origen } = await searchParams
  const today = todayISO()
  const currentMonth = today.slice(0, 7)
  // ?desde=&hasta= manda sobre ?mes=: son los días exactos que pidió el usuario.
  const range = normalizeDayRange(desde, hasta, today)
  const month = range ? range.from.slice(0, 7) : isValidMonth(mes) && mes <= currentMonth ? mes : currentMonth
  const categoryId = isUUID(categoria) ? categoria : null
  const source = sourceFromSlug(origen)
  const bounds = range ? dayRangeBounds(range) : monthRange(month)

  const { supabase } = await requireUser()
  const [categories, expenses] = await Promise.all([getCategories(supabase), getExpenses(supabase, bounds)])

  return (
    <HistoryList
      key={`${bounds.from}:${bounds.to}:${categoryId}:${source}`}
      expenses={expenses}
      categories={categories}
      month={month}
      currentMonth={currentMonth}
      today={today}
      range={range}
      initialCategoryId={categoryId}
      initialSource={source}
      truncated={expenses.length >= PAGE_SIZE}
    />
  )
}
