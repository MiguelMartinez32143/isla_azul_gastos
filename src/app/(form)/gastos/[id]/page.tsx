import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import { requireUser } from '@/lib/auth'
import { getCategories, getExpense, getRecentUsage, getSuppliers, sortByRecentUse } from '@/lib/data'
import { todayISO } from '@/lib/dates'
import { getReceiptUrl } from '@/lib/receipts'
import { isUUID } from '@/lib/utils'

export const metadata: Metadata = { title: 'Editar gasto' }

export default async function EditExpensePage({ params }: PageProps<'/gastos/[id]'>) {
  const { id } = await params
  if (!isUUID(id)) notFound()

  const { supabase } = await requireUser()
  const [expense, categories, suppliers, usage] = await Promise.all([
    getExpense(supabase, id),
    getCategories(supabase),
    getSuppliers(supabase),
    getRecentUsage(supabase),
  ])
  if (!expense) notFound()

  const receiptUrl = expense.receipt_path ? await getReceiptUrl(supabase, expense.receipt_path) : null

  return (
    <ExpenseForm
      expense={expense}
      receiptUrl={receiptUrl}
      categories={categories.filter((category) => category.is_active || category.id === expense.category_id)}
      suppliers={sortByRecentUse(suppliers, usage.supplierIds)}
      today={todayISO()}
    />
  )
}
