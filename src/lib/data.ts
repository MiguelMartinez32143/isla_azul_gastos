import { DEFAULT_CATEGORIES, EXPENSE_SOURCE_KEYS } from './constants'
import type { SupabaseServerClient } from './supabase/server'
import type { Category, Expense, ExpenseSource, PaymentMethod, RecurringExpense, Supplier } from './types'

const CATEGORY_COLUMNS = 'id, name, icon, color, hint, monthly_budget, sort_order, is_active'
const SUPPLIER_COLUMNS = 'id, name, default_category_id, phone, notes'
const EXPENSE_COLUMNS =
  'id, spent_on, amount, category_id, supplier_id, payment_method, source, description, receipt_path, recurring_id, created_at, supplier:suppliers(name)'
const RECURRING_COLUMNS = 'id, name, amount, category_id, supplier_id, payment_method, source, due_day, is_active'

/** Máximo de filas que Supabase devuelve por consulta con su configuración por defecto. */
export const PAGE_SIZE = 1000

type CategoryRow = Omit<Category, 'monthly_budget'> & { monthly_budget: number | string | null }
type ExpenseRow = Omit<Expense, 'amount' | 'supplier_name'> & {
  amount: number | string
  supplier: { name: string } | null
}
type RecurringRow = Omit<RecurringExpense, 'amount'> & { amount: number | string | null }

const toCategory = (row: CategoryRow): Category => ({
  ...row,
  monthly_budget: row.monthly_budget === null ? null : Number(row.monthly_budget),
})

const toExpense = ({ supplier, ...row }: ExpenseRow): Expense => ({
  ...row,
  amount: Number(row.amount),
  supplier_name: supplier?.name ?? null,
})

const toRecurring = (row: RecurringRow): RecurringExpense => ({
  ...row,
  amount: row.amount === null ? null : Number(row.amount),
})

async function selectCategories(supabase: SupabaseServerClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('sort_order')
    .order('created_at')
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`)
  return (data as unknown as CategoryRow[]).map(toCategory)
}

/** Categorías ordenadas. La primera vez que se entra crea las categorías sugeridas. */
export async function getCategories(supabase: SupabaseServerClient): Promise<Category[]> {
  const categories = await selectCategories(supabase)
  if (categories.length > 0) return categories

  const { error } = await supabase
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((category, index) => ({ ...category, sort_order: index })))
  // 23505 = otra pestaña las creó al mismo tiempo; basta con volver a leerlas.
  if (error && error.code !== '23505') throw new Error(`No se pudieron crear las categorías: ${error.message}`)
  return selectCategories(supabase)
}

export async function getSuppliers(supabase: SupabaseServerClient): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select(SUPPLIER_COLUMNS).order('name')
  if (error) throw new Error(`No se pudieron cargar los proveedores: ${error.message}`)
  return data as unknown as Supplier[]
}

/** Busca un proveedor por nombre sin importar mayúsculas. */
export async function findSupplierIdByName(supabase: SupabaseServerClient, name: string): Promise<string | null> {
  const pattern = name.replace(/[\\%_]/g, (char) => `\\${char}`)
  const { data, error } = await supabase.from('suppliers').select('id, name').ilike('name', pattern).limit(20)
  if (error) throw new Error(`No se pudo buscar el proveedor: ${error.message}`)
  const wanted = name.toLowerCase()
  return (data as unknown as { id: string; name: string }[]).find((item) => item.name.toLowerCase() === wanted)?.id ?? null
}

export type TotalsRow = { categoryId: string; source: ExpenseSource; total: number; entries: number }

/** Total gastado y cantidad de gastos por categoría y origen en el rango [from, to). */
export async function getCategoryTotals(supabase: SupabaseServerClient, from: string, to: string): Promise<TotalsRow[]> {
  const { data, error } = await supabase.rpc('category_totals', { p_from: from, p_to: to })
  if (error) throw new Error(`No se pudieron calcular los totales: ${error.message}`)
  const rows = (data ?? []) as {
    category_id: string
    source: ExpenseSource
    total: number | string
    entries: number | string
  }[]
  return rows.map((row) => ({
    categoryId: row.category_id,
    source: row.source,
    total: Number(row.total),
    entries: Number(row.entries),
  }))
}

/** Suma los totales por categoría; si se indica un origen, solo cuenta ese. */
export function totalsByCategory(
  rows: TotalsRow[],
  source: ExpenseSource | null = null,
): Map<string, { total: number; entries: number }> {
  const totals = new Map<string, { total: number; entries: number }>()
  for (const row of rows) {
    if (source && row.source !== source) continue
    const current = totals.get(row.categoryId) ?? { total: 0, entries: 0 }
    totals.set(row.categoryId, { total: current.total + row.total, entries: current.entries + row.entries })
  }
  return totals
}

export function totalsBySource(rows: TotalsRow[]): Record<ExpenseSource, number> {
  const totals = Object.fromEntries(EXPENSE_SOURCE_KEYS.map((key) => [key, 0])) as Record<ExpenseSource, number>
  for (const row of rows) totals[row.source] += row.total
  return totals
}

export function sumTotals(totals: Map<string, { total: number }>): number {
  return [...totals.values()].reduce((sum, item) => sum + item.total, 0)
}

type ExpenseFilter = { from: string; to: string; source?: ExpenseSource | null }

/** Gastos del rango [from, to), del más reciente al más antiguo. */
export async function getExpenses(
  supabase: SupabaseServerClient,
  { from, to, source = null, limit = PAGE_SIZE }: ExpenseFilter & { limit?: number },
): Promise<Expense[]> {
  let query = supabase.from('expenses').select(EXPENSE_COLUMNS).gte('spent_on', from).lt('spent_on', to)
  if (source) query = query.eq('source', source)

  const { data, error } = await query
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`No se pudieron cargar los gastos: ${error.message}`)
  return (data as unknown as ExpenseRow[]).map(toExpense)
}

/** Todos los gastos del rango [from, to) en orden cronológico, pidiéndolos por páginas. */
export async function getAllExpenses(
  supabase: SupabaseServerClient,
  { from, to, source = null }: ExpenseFilter,
): Promise<Expense[]> {
  const expenses: Expense[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from('expenses').select(EXPENSE_COLUMNS).gte('spent_on', from).lt('spent_on', to)
    if (source) query = query.eq('source', source)

    const { data, error } = await query
      .order('spent_on')
      .order('created_at')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`No se pudieron cargar los gastos: ${error.message}`)
    const rows = data as unknown as ExpenseRow[]
    expenses.push(...rows.map(toExpense))
    if (rows.length < PAGE_SIZE) return expenses
  }
}

export async function getExpense(supabase: SupabaseServerClient, id: string): Promise<Expense | null> {
  const { data, error } = await supabase.from('expenses').select(EXPENSE_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo cargar el gasto: ${error.message}`)
  return data ? toExpense(data as unknown as ExpenseRow) : null
}

/** Gastos fijos ordenados por el día del mes en que se pagan. */
export async function getRecurringExpenses(supabase: SupabaseServerClient): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select(RECURRING_COLUMNS)
    .order('due_day')
    .order('name')
  if (error) throw new Error(`No se pudieron cargar los gastos fijos: ${error.message}`)
  return (data as unknown as RecurringRow[]).map(toRecurring)
}

export async function getRecurringExpense(supabase: SupabaseServerClient, id: string): Promise<RecurringExpense | null> {
  const { data, error } = await supabase.from('recurring_expenses').select(RECURRING_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo cargar el gasto fijo: ${error.message}`)
  return data ? toRecurring(data as unknown as RecurringRow) : null
}

/** Ids de los gastos fijos que ya tienen un gasto registrado en el rango [from, to). */
export async function getRegisteredRecurringIds(
  supabase: SupabaseServerClient,
  { from, to }: { from: string; to: string },
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('expenses')
    .select('recurring_id')
    .not('recurring_id', 'is', null)
    .gte('spent_on', from)
    .lt('spent_on', to)
  if (error) throw new Error(`No se pudieron revisar los gastos fijos del mes: ${error.message}`)
  return new Set((data as unknown as { recurring_id: string }[]).map((row) => row.recurring_id))
}

export type RecentUsage = {
  supplierIds: string[]
  lastSource: ExpenseSource
  paymentBySource: Record<ExpenseSource, PaymentMethod>
}

/** Lo usado recientemente (proveedores, origen y forma de pago) para sugerirlo al registrar. */
export async function getRecentUsage(supabase: SupabaseServerClient): Promise<RecentUsage> {
  const { data, error } = await supabase
    .from('expenses')
    .select('supplier_id, payment_method, source')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw new Error(`No se pudo cargar el uso reciente: ${error.message}`)

  const rows = data as unknown as { supplier_id: string | null; payment_method: PaymentMethod; source: ExpenseSource }[]
  const lastPaymentFor = (source: ExpenseSource) => rows.find((row) => row.source === source)?.payment_method

  return {
    supplierIds: [...new Set(rows.flatMap((row) => (row.supplier_id ? [row.supplier_id] : [])))],
    lastSource: rows[0]?.source ?? 'petty_cash',
    paymentBySource: {
      petty_cash: lastPaymentFor('petty_cash') ?? 'cash',
      manager: lastPaymentFor('manager') ?? 'transfer',
    },
  }
}

export function sortByRecentUse(suppliers: Supplier[], recentIds: string[]): Supplier[] {
  const rank = new Map(recentIds.map((id, index) => [id, index]))
  const rankOf = (supplier: Supplier) => rank.get(supplier.id) ?? recentIds.length
  return [...suppliers].sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name, 'es'))
}
