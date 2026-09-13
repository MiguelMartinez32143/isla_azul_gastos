'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isExpenseSource, isPaymentMethod } from '@/lib/constants'
import { MAX_INTEGER_DIGITS, roundAmount } from '@/lib/format'
import type { ActionResult, ExpenseSource, PaymentMethod } from '@/lib/types'
import { fail, isUUID, success } from '@/lib/utils'

export type RecurringInput = {
  id?: string
  name: string
  /** null cuando el monto cambia cada mes. */
  amount: number | null
  categoryId: string
  supplierId: string | null
  paymentMethod: PaymentMethod
  source: ExpenseSource
  dueDay: number
}

export async function saveRecurring(input: RecurringInput): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser()

  const name = String(input.name ?? '').trim()
  if (!name) return fail('Escribe un nombre, por ejemplo “Arriendo del local”.')
  if (name.length > 60) return fail('El nombre puede tener máximo 60 caracteres.')

  const amount = input.amount === null ? null : roundAmount(Number(input.amount))
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount >= 10 ** MAX_INTEGER_DIGITS)) {
    return fail('El monto no es válido.')
  }
  if (!isUUID(input.categoryId)) return fail('Elige una categoría.')
  if (input.supplierId !== null && !isUUID(input.supplierId)) return fail('El proveedor no es válido.')
  if (!isPaymentMethod(input.paymentMethod)) return fail('Elige cómo se paga.')
  if (!isExpenseSource(input.source)) return fail('Elige si lo paga la caja menor o el jefe.')

  const dueDay = Number(input.dueDay)
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return fail('Elige el día del mes en que se paga.')
  if (input.id !== undefined && !isUUID(input.id)) return fail('No encontramos ese gasto fijo.')

  const row = {
    name,
    amount,
    category_id: input.categoryId,
    supplier_id: input.supplierId,
    payment_method: input.paymentMethod,
    source: input.source,
    due_day: dueDay,
  }

  const { data, error } = input.id
    ? await supabase.from('recurring_expenses').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('recurring_expenses').insert(row).select('id').single()

  if (error) {
    if (error.code === '23503') return fail('La categoría o el proveedor ya no existen. Recarga la página.')
    if (error.code === 'PGRST116') return fail('No encontramos ese gasto fijo.')
    return fail('No se pudo guardar el gasto fijo. Intenta de nuevo.')
  }

  revalidatePath('/', 'layout')
  return success({ id: (data as { id: string }).id })
}

export async function setRecurringActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos ese gasto fijo.')

  const { error } = await supabase.from('recurring_expenses').update({ is_active: isActive }).eq('id', id)
  if (error) return fail('No se pudo actualizar el gasto fijo. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}

/** Elimina un gasto fijo. Los gastos que ya se registraron con él se conservan. */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos ese gasto fijo.')

  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
  if (error) return fail('No se pudo eliminar el gasto fijo. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}
