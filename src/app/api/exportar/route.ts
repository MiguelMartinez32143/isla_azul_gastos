import type { NextRequest } from 'next/server'
import { EXPENSE_SOURCES, sourceFromSlug } from '@/lib/constants'
import { getAllExpenses, getCategories } from '@/lib/data'
import { formatMonth, isValidMonth, monthRange, todayISO } from '@/lib/dates'
import { buildExpensesWorkbook } from '@/lib/excel'
import { createClient } from '@/lib/supabase/server'
import type { Category, Expense } from '@/lib/types'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Descarga los gastos de un mes en un archivo de Excel (.xlsx) con tres hojas:
 * el detalle, el resumen por categoría y el total de cada día.
 * ?mes=2026-09 y, opcional, ?origen=caja-menor | jefe.
 */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get('mes')
  if (!isValidMonth(month)) return new Response('Mes no válido', { status: 400 })
  const source = sourceFromSlug(request.nextUrl.searchParams.get('origen'))

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return new Response('Inicia sesión para descargar', { status: 401 })

  let loaded: [Category[], Expense[]]
  try {
    loaded = await Promise.all([getCategories(supabase), getAllExpenses(supabase, { ...monthRange(month), source })])
  } catch (error) {
    // Supabase a veces tarda demasiado en responder: mejor explicarlo que descargar un archivo vacío.
    console.error('No se pudo generar la exportación', error)
    return new Response(
      'No se pudo generar el archivo porque la base de datos no respondió a tiempo. Vuelve atrás e intenta de nuevo en unos segundos.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' } },
    )
  }
  const [categories, expenses] = loaded

  const workbook = await buildExpensesWorkbook({
    expenses,
    categories,
    periodLabel: formatMonth(month),
    source,
    generatedOn: todayISO(),
  })
  const fileName = `gastos-${month}${source ? `-${EXPENSE_SOURCES[source].slug}` : ''}.xlsx`

  return new Response(workbook, {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
