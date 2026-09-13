import type { Metadata } from 'next'
import { ExpenseForm } from '@/components/expense-form'
import { requireUser } from '@/lib/auth'
import { getCategories, getRecentUsage, getRecurringExpense, getSuppliers, sortByRecentUse } from '@/lib/data'
import { todayISO } from '@/lib/dates'
import { isUUID } from '@/lib/utils'

export const metadata: Metadata = { title: 'Nuevo gasto' }

export default async function AddExpensePage({ searchParams }: PageProps<'/agregar'>) {
  const { fijo } = await searchParams

  const { supabase } = await requireUser()
  const [categories, suppliers, usage, template] = await Promise.all([
    getCategories(supabase),
    getSuppliers(supabase),
    getRecentUsage(supabase),
    // ?fijo=<id>: registrar un gasto fijo con sus datos ya llenos.
    isUUID(fijo) ? getRecurringExpense(supabase, fijo) : Promise.resolve(null),
  ])

  return (
    <ExpenseForm
      categories={categories.filter((category) => category.is_active || category.id === template?.category_id)}
      suppliers={sortByRecentUse(suppliers, usage.supplierIds)}
      defaultSource={usage.lastSource}
      defaultPaymentBySource={usage.paymentBySource}
      template={template ?? undefined}
      today={todayISO()}
    />
  )
}
