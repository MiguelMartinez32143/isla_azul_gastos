import type { NextRequest } from 'next/server'
import { CURRENCY_DECIMALS } from '@/lib/config'
import { EXPENSE_SOURCES, PAYMENT_METHODS, sourceFromSlug } from '@/lib/constants'
import { getAllExpenses, getCategories } from '@/lib/data'
import { isValidMonth, monthRange } from '@/lib/dates'
import { DECIMAL_SEPARATOR } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Category, Expense } from '@/lib/types'

/** Marca de UTF-8 (BOM) para que Excel muestre bien las tildes. */
const UTF8_BOM = String.fromCharCode(0xfeff)

/**
 * Descarga los gastos de un mes como CSV separado por ";" (así lo abre Excel en español).
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

  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const formatAmount = (value: number) => value.toFixed(CURRENCY_DECIMALS).replace('.', DECIMAL_SEPARATOR)
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  const rows = [
    ['Fecha', 'Origen', 'Categoría', 'Proveedor', 'Descripción', 'Método de pago', 'Foto de factura', 'Monto'],
    ...expenses.map((expense) => [
      expense.spent_on,
      EXPENSE_SOURCES[expense.source].label,
      categoryName.get(expense.category_id) ?? '',
      expense.supplier_name ?? '',
      expense.description ?? '',
      PAYMENT_METHODS[expense.payment_method].label,
      expense.receipt_path ? 'Sí' : 'No',
      formatAmount(expense.amount),
    ]),
    ['', '', '', '', '', '', 'Total', formatAmount(total)],
  ]

  const csv = rows.map((cells) => cells.map(toCsvCell).join(';')).join('\r\n')
  const fileName = `gastos-${month}${source ? `-${EXPENSE_SOURCES[source].slug}` : ''}.csv`

  return new Response(UTF8_BOM + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function toCsvCell(value: string): string {
  // Evita que Excel interprete textos como fórmulas.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
