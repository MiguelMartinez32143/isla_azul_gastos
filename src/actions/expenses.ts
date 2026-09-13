'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isExpenseSource, isPaymentMethod } from '@/lib/constants'
import { findSupplierIdByName } from '@/lib/data'
import { isValidISODate } from '@/lib/dates'
import { MAX_INTEGER_DIGITS, roundAmount } from '@/lib/format'
import { MAX_RECEIPT_BYTES, RECEIPTS_BUCKET, RECEIPT_EXTENSIONS, isOwnReceiptPath } from '@/lib/receipts'
import type { SupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult, ExpenseSource, PaymentMethod } from '@/lib/types'
import { fail, isUUID, success } from '@/lib/utils'

export type ExpenseInput = {
  id?: string
  amount: number
  categoryId: string
  spentOn: string
  paymentMethod: PaymentMethod
  source: ExpenseSource
  description: string
  supplierId: string | null
  /** Nombre de un proveedor que aún no existe; se crea al guardar. */
  newSupplierName: string | null
  /** Ruta de la foto ya subida con `uploadReceipt`, o null si no tiene. */
  receiptPath: string | null
  /** Gasto fijo del que sale este gasto, si aplica. */
  recurringId: string | null
}

export async function saveExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser()

  const amount = roundAmount(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return fail('Escribe un monto mayor a cero.')
  if (amount >= 10 ** MAX_INTEGER_DIGITS) return fail('El monto es demasiado grande.')
  if (!isUUID(input.categoryId)) return fail('Elige una categoría.')
  if (!isValidISODate(input.spentOn)) return fail('La fecha no es válida.')
  if (!isPaymentMethod(input.paymentMethod)) return fail('Elige cómo pagaste.')
  if (!isExpenseSource(input.source)) return fail('Elige si el gasto es de caja menor o del jefe.')
  if (input.id !== undefined && !isUUID(input.id)) return fail('No encontramos ese gasto.')
  if (input.supplierId !== null && !isUUID(input.supplierId)) return fail('El proveedor no es válido.')
  if (input.receiptPath !== null && !isOwnReceiptPath(input.receiptPath, userId)) {
    return fail('La foto de la factura no es válida.')
  }
  if (input.recurringId !== null && !isUUID(input.recurringId)) return fail('El gasto fijo no es válido.')

  // Al editar, se guarda la foto anterior para borrarla si se cambió o se quitó.
  let previousReceipt: string | null = null
  if (input.id) {
    const { data: current, error: currentError } = await supabase
      .from('expenses')
      .select('receipt_path')
      .eq('id', input.id)
      .maybeSingle()
    if (currentError) return fail('No se pudo guardar el gasto. Intenta de nuevo.')
    if (!current) return fail('No encontramos ese gasto. Puede que ya se haya eliminado.')
    previousReceipt = (current as { receipt_path: string | null }).receipt_path
  }

  let supplierId = input.supplierId
  const newSupplierName = typeof input.newSupplierName === 'string' ? input.newSupplierName.trim().slice(0, 80) : ''
  if (!supplierId && newSupplierName) {
    const supplier = await findOrCreateSupplier(supabase, newSupplierName, input.categoryId)
    if (!supplier.ok) return supplier
    supplierId = supplier.data.id
  }

  const row = {
    amount,
    category_id: input.categoryId,
    spent_on: input.spentOn,
    payment_method: input.paymentMethod,
    source: input.source,
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 200) || null : null,
    supplier_id: supplierId,
    receipt_path: input.receiptPath,
    recurring_id: input.recurringId,
  }

  const { data, error } = input.id
    ? await supabase.from('expenses').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('expenses').insert(row).select('id').single()

  if (error) {
    if (error.code === 'PGRST116') return fail('No encontramos ese gasto. Puede que ya se haya eliminado.')
    if (error.code === '23503') return fail('La categoría, el proveedor o el gasto fijo ya no existen. Recarga la página.')
    return fail('No se pudo guardar el gasto. Intenta de nuevo.')
  }

  if (previousReceipt && previousReceipt !== input.receiptPath) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([previousReceipt])
  }

  if (supplierId) {
    // Si el proveedor aún no tiene categoría habitual, recuerda esta para sugerirla la próxima vez.
    await supabase
      .from('suppliers')
      .update({ default_category_id: input.categoryId })
      .eq('id', supplierId)
      .is('default_category_id', null)
  }

  revalidatePath('/', 'layout')
  return success({ id: (data as { id: string }).id })
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos ese gasto.')

  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('receipt_path').maybeSingle()
  if (error) return fail('No se pudo eliminar el gasto. Intenta de nuevo.')

  const receiptPath = (data as { receipt_path: string | null } | null)?.receipt_path
  if (receiptPath) await supabase.storage.from(RECEIPTS_BUCKET).remove([receiptPath])

  revalidatePath('/', 'layout')
  return success()
}

/** Sube la foto de una factura (ya comprimida en el celular) y devuelve dónde quedó guardada. */
export async function uploadReceipt(formData: FormData): Promise<ActionResult<{ path: string }>> {
  const { supabase, userId } = await requireUser()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return fail('No llegó la foto. Intenta de nuevo.')
  const extension = Object.hasOwn(RECEIPT_EXTENSIONS, file.type) ? RECEIPT_EXTENSIONS[file.type] : null
  if (!extension) return fail('La foto debe ser JPG, PNG o WEBP.')
  if (file.size > MAX_RECEIPT_BYTES) return fail('La foto es demasiado pesada.')

  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) return fail('No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.')

  return success({ path })
}

/** Borra una foto subida que no quedó asociada a ningún gasto (por ejemplo, si falló el guardado). */
export async function discardReceipt(path: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!isOwnReceiptPath(path, userId)) return fail('La foto no es válida.')

  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('receipt_path', path)
  if (error) return fail('No se pudo revisar la foto.')
  if (count) return success()

  await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
  return success()
}

async function findOrCreateSupplier(
  supabase: SupabaseServerClient,
  name: string,
  categoryId: string,
): Promise<ActionResult<{ id: string }>> {
  const existingId = await findSupplierIdByName(supabase, name)
  if (existingId) return success({ id: existingId })

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, default_category_id: categoryId })
    .select('id')
    .single()
  if (!error) return success({ id: (data as { id: string }).id })

  // 23505 = se creó al mismo tiempo desde otra pestaña.
  const retryId = error.code === '23505' ? await findSupplierIdByName(supabase, name) : null
  return retryId ? success({ id: retryId }) : fail('No se pudo crear el proveedor. Intenta de nuevo.')
}
