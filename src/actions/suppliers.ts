'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { fail, isUUID, success } from '@/lib/utils'

export type SupplierInput = {
  id?: string
  name: string
  defaultCategoryId: string | null
  phone: string
  notes: string
}

export async function saveSupplier(input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser()

  const name = String(input.name ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const notes = String(input.notes ?? '').trim()
  if (!name) return fail('Escribe el nombre del proveedor.')
  if (name.length > 80) return fail('El nombre puede tener máximo 80 caracteres.')
  if (phone.length > 30) return fail('El teléfono es demasiado largo.')
  if (notes.length > 300) return fail('Las notas pueden tener máximo 300 caracteres.')
  if (input.defaultCategoryId !== null && !isUUID(input.defaultCategoryId)) return fail('La categoría no es válida.')
  if (input.id !== undefined && !isUUID(input.id)) return fail('No encontramos ese proveedor.')

  const row = { name, default_category_id: input.defaultCategoryId, phone: phone || null, notes: notes || null }

  const { data, error } = input.id
    ? await supabase.from('suppliers').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('suppliers').insert(row).select('id').single()

  if (error) {
    if (error.code === '23505') return fail(`Ya tienes un proveedor llamado “${name}”.`)
    if (error.code === '23503') return fail('La categoría elegida ya no existe.')
    if (error.code === 'PGRST116') return fail('No encontramos ese proveedor.')
    return fail('No se pudo guardar el proveedor. Intenta de nuevo.')
  }

  revalidatePath('/', 'layout')
  return success({ id: (data as { id: string }).id })
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos ese proveedor.')

  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) return fail('No se pudo eliminar el proveedor. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}
