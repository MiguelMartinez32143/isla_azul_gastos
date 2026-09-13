import type { Metadata } from 'next'
import { CategoryManager } from '@/components/category-manager'
import { requireUser } from '@/lib/auth'
import { getCategories, getCategoryTotals, totalsByCategory } from '@/lib/data'

export const metadata: Metadata = { title: 'Categorías' }

export default async function CategoriesPage() {
  const { supabase } = await requireUser()
  const [categories, allTimeRows] = await Promise.all([
    getCategories(supabase),
    getCategoryTotals(supabase, '1900-01-01', '9999-12-31'),
  ])

  const totals = totalsByCategory(allTimeRows)
  const entriesByCategory = Object.fromEntries(
    categories.map((category) => [category.id, totals.get(category.id)?.entries ?? 0]),
  )

  return <CategoryManager categories={categories} entriesByCategory={entriesByCategory} />
}
