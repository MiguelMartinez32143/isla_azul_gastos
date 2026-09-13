export type PaymentMethod = 'cash' | 'transfer' | 'card'

/** Quién hizo el gasto: la caja menor (cajero) o el jefe. */
export type ExpenseSource = 'petty_cash' | 'manager'

export type Category = {
  id: string
  name: string
  icon: string
  color: string
  hint: string | null
  monthly_budget: number | null
  sort_order: number
  is_active: boolean
}

export type Supplier = {
  id: string
  name: string
  default_category_id: string | null
  phone: string | null
  notes: string | null
}

export type Expense = {
  id: string
  spent_on: string
  amount: number
  category_id: string
  supplier_id: string | null
  supplier_name: string | null
  payment_method: PaymentMethod
  source: ExpenseSource
  description: string | null
  /** Ruta de la foto de la factura en Supabase Storage. */
  receipt_path: string | null
  /** Gasto fijo del que salió este gasto, si aplica. */
  recurring_id: string | null
  created_at: string
}

/** Gasto que se paga todos los meses (arriendo, servicios, nómina…). */
export type RecurringExpense = {
  id: string
  name: string
  /** null cuando el monto cambia cada mes. */
  amount: number | null
  category_id: string
  supplier_id: string | null
  payment_method: PaymentMethod
  source: ExpenseSource
  /** Día del mes en que se paga (1–31). */
  due_day: number
  is_active: boolean
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string }
