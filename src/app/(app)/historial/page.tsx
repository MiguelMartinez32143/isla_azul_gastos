import type { Metadata } from 'next'
import { HistoryList } from '@/components/history-list'
import { requireUser } from '@/lib/auth'
import { sourceFromSlug } from '@/lib/constants'
import { PAGE_SIZE, getCategories, getExpenses } from '@/lib/data'
import { isValidMonth, monthRange, todayISO } from '@/lib/dates'
import { isUUID } from '@/lib/utils'

export const metadata: Metadata = { title: 'Historial' }

export default async function HistoryPage({ searchParams }: PageProps<'/historial'>) {
  const { mes, categoria, origen } = await searchParams
  const today = todayISO()
  const currentMonth = today.slice(0, 7)
  const month = isValidMonth(mes) && mes <= currentMonth ? mes : currentMonth
  const categoryId = isUUID(categoria) ? categoria : null
  const source = sourceFromSlug(origen)

  const { supabase } = await requireUser()
  const [categories, expenses] = await Promise.all([getCategories(supabase), getExpenses(supabase, monthRange(month))])

  return (
    <HistoryList
      key={`${month}:${categoryId}:${source}`}
      expenses={expenses}
      categories={categories}
      month={month}
      currentMonth={currentMonth}
      today={today}
      initialCategoryId={categoryId}
      initialSource={source}
      truncated={expenses.length >= PAGE_SIZE}
    />
  )
}
