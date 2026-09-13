'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { MAX_INTEGER_DIGITS, roundAmount } from '@/lib/format'
import type { SupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { fail, isUUID, plural, success } from '@/lib/utils'

export type CategoryInput = {
  id?: string
  name: string
  hint: string
  icon: string
  color: string
  monthlyBudget: number | null
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser()

  const name = String(input.name ?? '').trim()
  const hint = String(input.hint ?? '').trim().slice(0, 80)
  if (!name) return fail('Escribe un nombre para la categoría.')
  if (name.length > 40) return fail('El nombre puede tener máximo 40 caracteres.')
  if (typeof input.icon !== 'string' || input.icon.length === 0 || input.icon.length > 16) return fail('Elige un ícono.')
  if (typeof input.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.color)) return fail('Elige un color.')
  if (input.id !== undefined && !isUUID(input.id)) return fail('No encontramos esa categoría.')

  const budget = input.monthlyBudget === null ? null : roundAmount(Number(input.monthlyBudget))
  if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget >= 10 ** MAX_INTEGER_DIGITS)) {
    return fail('El presupuesto no es válido.')
  }

  const row = { name, hint: hint || null, icon: input.icon, color: input.color, monthly_budget: budget || null }

  const { data, error } = input.id
    ? await supabase.from('categories').update(row).eq('id', input.id).select('id').single()
    : await supabase
        .from('categories')
        .insert({ ...row, sort_order: await nextSortOrder(supabase) })
        .select('id')
        .single()

  if (error) {
    if (error.code === '23505') return fail(`Ya tienes una categoría llamada “${name}”.`)
    if (error.code === 'PGRST116') return fail('No encontramos esa categoría.')
    return fail('No se pudo guardar la categoría. Intenta de nuevo.')
  }

  revalidatePath('/', 'layout')
  return success({ id: (data as { id: string }).id })
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos esa categoría.')

  if (!isActive && !(await hasOtherActiveCategories(supabase, id))) {
    return fail('Necesitas al menos una categoría activa para registrar gastos.')
  }

  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', id)
  if (error) return fail('No se pudo actualizar la categoría. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}

export async function moveCategory(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const { supabase } = await requireUser()

  const { data, error } = await supabase
    .from('categories')
    .select('id, sort_order, is_active')
    .order('sort_order')
    .order('created_at')
  if (error) return fail('No se pudo cambiar el orden. Intenta de nuevo.')

  const list = data as unknown as { id: string; sort_order: number; is_active: boolean }[]
  const active = list.filter((item) => item.is_active)
  const index = active.findIndex((item) => item.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= active.length) return success()

  ;[active[index], active[target]] = [active[target], active[index]]

  // Renumera: primero las activas en su nuevo orden, luego las archivadas.
  const ordered = [...active, ...list.filter((item) => !item.is_active)]
  const changes = ordered
    .map((item, position) => ({ id: item.id, from: item.sort_order, to: position }))
    .filter((change) => change.from !== change.to)

  const results = await Promise.all(
    changes.map((change) => supabase.from('categories').update({ sort_order: change.to }).eq('id', change.id)),
  )
  if (results.some((result) => result.error)) return fail('No se pudo cambiar el orden. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser()
  if (!isUUID(id)) return fail('No encontramos esa categoría.')

  const [expenses, recurring] = await Promise.all([
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('recurring_expenses').select('id', { count: 'exact', head: true }).eq('category_id', id),
  ])
  if (expenses.error || recurring.error) return fail('No se pudo eliminar la categoría. Intenta de nuevo.')
  if (expenses.count) {
    return fail(`Tiene ${plural(expenses.count, 'gasto', 'gastos')}. Archívala para ocultarla sin perder el historial.`)
  }
  if (recurring.count) {
    return fail(`La usan ${plural(recurring.count, 'gasto fijo', 'gastos fijos')}. Cámbiales la categoría o archívala.`)
  }
  if (!(await hasOtherActiveCategories(supabase, id))) return fail('Necesitas al menos una categoría activa.')

  const { error: deleteError } = await supabase.from('categories').delete().eq('id', id)
  if (deleteError) return fail('No se pudo eliminar la categoría. Intenta de nuevo.')

  revalidatePath('/', 'layout')
  return success()
}

async function nextSortOrder(supabase: SupabaseServerClient): Promise<number> {
  const { data } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { sort_order: number } | null)?.sort_order ?? -1) + 1
}

async function hasOtherActiveCategories(supabase: SupabaseServerClient, id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .neq('id', id)
  // Si la consulta falla no se sabe cuántas hay: mejor avisar del error que decir "no hay otras".
  if (error) throw new Error(`No se pudieron contar las categorías activas: ${error.message}`)
  return (count ?? 0) > 0
}
