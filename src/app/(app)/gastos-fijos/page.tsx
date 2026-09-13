import type { Metadata } from 'next'
import { RecurringManager } from '@/components/recurring-manager'
import { requireUser } from '@/lib/auth'
import { getCategories, getRecurringExpenses, getRegisteredRecurringIds, getSuppliers } from '@/lib/data'
import { monthRange, todayISO } from '@/lib/dates'

export const metadata: Metadata = { title: 'Gastos fijos' }

export default async function RecurringExpensesPage() {
  const { supabase } = await requireUser()
  const [items, categories, suppliers, registered] = await Promise.all([
    getRecurringExpenses(supabase),
    getCategories(supabase),
    getSuppliers(supabase),
    getRegisteredRecurringIds(supabase, monthRange(todayISO().slice(0, 7))),
  ])

  return (
    <RecurringManager items={items} categories={categories} suppliers={suppliers} registeredIds={[...registered]} />
  )
}
