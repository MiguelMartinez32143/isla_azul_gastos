import type { Metadata } from 'next'
import { ExpenseBatchForm } from '@/components/expense-batch-form'
import { requireUser } from '@/lib/auth'
import { getCategories, getDayTotals, getRecentUsage, getSuppliers, sortByRecentUse } from '@/lib/data'
import { DAYS_WITH_TOTALS, addDays, isValidISODate, todayISO } from '@/lib/dates'

export const metadata: Metadata = { title: 'Varios gastos' }

export default async function AddSeveralExpensesPage({ searchParams }: PageProps<'/agregar/varios'>) {
  const { fecha } = await searchParams
  const today = todayISO()

  const { supabase } = await requireUser()
  const [categories, suppliers, usage, dayTotals] = await Promise.all([
    getCategories(supabase),
    getSuppliers(supabase),
    getRecentUsage(supabase),
    getDayTotals(supabase, { from: addDays(today, 1 - DAYS_WITH_TOTALS), to: addDays(today, 1) }),
  ])

  return (
    <ExpenseBatchForm
      categories={categories}
      suppliers={sortByRecentUse(suppliers, usage.supplierIds)}
      quickPicks={usage.quickPicks}
      defaultSource={usage.lastSource}
      defaultPaymentBySource={usage.paymentBySource}
      dayTotals={dayTotals}
      today={today}
      initialDay={isValidISODate(fecha) && fecha <= today ? fecha : null}
    />
  )
}
