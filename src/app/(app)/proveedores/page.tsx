import type { Metadata } from 'next'
import { SupplierManager } from '@/components/supplier-manager'
import { requireUser } from '@/lib/auth'
import { getCategories, getSuppliers } from '@/lib/data'

export const metadata: Metadata = { title: 'Proveedores' }

export default async function SuppliersPage() {
  const { supabase } = await requireUser()
  const [suppliers, categories] = await Promise.all([getSuppliers(supabase), getCategories(supabase)])

  return <SupplierManager suppliers={suppliers} categories={categories} />
}
