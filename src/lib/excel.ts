import ExcelJS from 'exceljs'
import { APP_NAME, CURRENCY, CURRENCY_DECIMALS, LOCALE } from './config'
import { EXPENSE_SOURCES, PAYMENT_METHODS } from './constants'
import { formatFullDate, formatWeekday, toUTCDate } from './dates'
import { formatMoney } from './format'
import type { Category, Expense, ExpenseSource } from './types'
import { plural } from './utils'

// Archivo de Excel (.xlsx) con tres hojas: el detalle de los gastos, el resumen
// por categoría y el total de cada día. Las fechas y los montos van como fecha y
// como número de verdad, así se pueden filtrar, ordenar y sumar en Excel.

/** Símbolo de la moneda configurada ("$" para COP). */
const CURRENCY_SYMBOL =
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? '$'

/** Excel muestra los miles con los separadores de quien abre el archivo. */
const MONEY_FORMAT = `"${CURRENCY_SYMBOL} "#,##0${CURRENCY_DECIMALS > 0 ? `.${'0'.repeat(CURRENCY_DECIMALS)}` : ''}`
const DATE_FORMAT = 'dd/mm/yyyy'
const COUNT_FORMAT = '#,##0'
const PERCENT_FORMAT = '0%'
const PERCENT_LABEL = 'Parte del total'

// Colores de la app, en el formato ARGB que pide Excel.
const BRAND = 'FF0F766E'
const BRAND_SOFT = 'FFF0FDFA'
const WHITE = 'FFFFFFFF'
const INK = 'FF1C1917'
const MUTED = 'FF78716C'
const ZEBRA = 'FFFAFAF9'
const LINE = 'FFE7E5E4'

const FONT = 'Calibri'
/** Filas 1-3: títulos. Fila 4: espacio. Fila 5: encabezado de la tabla. */
const HEADER_ROW = 5
const FIRST_DATA_ROW = HEADER_ROW + 1

type SheetColumn = { label: string; width: number; style?: Partial<ExcelJS.Style> }

export type ExportInput = {
  expenses: Expense[]
  categories: Category[]
  /** "Octubre de 2026" */
  periodLabel: string
  /** null cuando se exportan la caja menor y el jefe juntos. */
  source: ExpenseSource | null
  /** Día en que se genera el archivo ("YYYY-MM-DD"). */
  generatedOn: string
}

export async function buildExpensesWorkbook(input: ExportInput): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = APP_NAME
  workbook.created = new Date()

  addExpensesSheet(workbook, input)
  addCategorySheet(workbook, input)
  addDailySheet(workbook, input)

  return workbook.xlsx.writeBuffer()
}

/** Hoja 1: un gasto por fila, con filtros en el encabezado. */
function addExpensesSheet(workbook: ExcelJS.Workbook, input: ExportInput) {
  const { expenses, categories, source } = input
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))

  const columns: SheetColumn[] = [
    { label: 'Fecha', width: 12, style: { numFmt: DATE_FORMAT } },
    { label: 'Origen', width: 14 },
    { label: 'Categoría', width: 18 },
    { label: 'Proveedor', width: 22 },
    { label: 'Descripción', width: 34 },
    { label: 'Forma de pago', width: 15 },
    { label: 'Factura', width: 9, style: { alignment: { horizontal: 'center' } } },
    { label: 'Monto', width: 15, style: { numFmt: MONEY_FORMAT } },
  ]
  const sheet = createSheet(workbook, 'Gastos', columns, 'Detalle de gastos', input)
  sheet.pageSetup.orientation = 'landscape'

  expenses.forEach((expense, index) => {
    writeDataRow(sheet, FIRST_DATA_ROW + index, index, [
      toUTCDate(expense.spent_on),
      `${EXPENSE_SOURCES[expense.source].emoji} ${EXPENSE_SOURCES[expense.source].label}`,
      categoryName.get(expense.category_id) ?? 'Sin categoría',
      expense.supplier_name ?? '',
      expense.description ?? '',
      PAYMENT_METHODS[expense.payment_method].label,
      expense.receipt_path ? 'Sí' : '—',
      expense.amount,
    ])
  })

  const { lastDataRow, totalRow } = closeTable(sheet, columns.length, expenses.length)
  if (expenses.length > 0) {
    sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastDataRow, column: columns.length } }
    // Con SUBTOTAL, al filtrar la tabla el total suma solo lo que quedó a la vista.
    const amountColumn = sheet.getColumn(columns.length).letter
    totalRow.getCell(columns.length).value = {
      formula: `SUBTOTAL(109,${amountColumn}${FIRST_DATA_ROW}:${amountColumn}${lastDataRow})`,
      result: sumAmounts(expenses),
    }
  } else {
    totalRow.getCell(columns.length).value = 0
  }
  sheet.mergeCells(totalRow.number, 1, totalRow.number, columns.length - 1)
  const label = totalRow.getCell(1)
  label.value = source ? `Total ${EXPENSE_SOURCES[source].ofLabel}` : 'Total de gastos'
  label.alignment = { horizontal: 'right', vertical: 'middle' }
}

/** Hoja 2: cuánto se gastó en cada categoría y qué parte del total es. */
function addCategorySheet(workbook: ExcelJS.Workbook, input: ExportInput) {
  const { expenses, categories, source } = input
  const bySource = source === null
  const columns: SheetColumn[] = [
    { label: 'Categoría', width: 24 },
    { label: 'Gastos', width: 10, style: { numFmt: COUNT_FORMAT, alignment: { horizontal: 'center' } } },
    ...(bySource ? sourceColumns() : []),
    { label: 'Total', width: 16, style: { numFmt: MONEY_FORMAT } },
    { label: PERCENT_LABEL, width: 15, style: { numFmt: PERCENT_FORMAT, alignment: { horizontal: 'center' } } },
  ]
  const sheet = createSheet(workbook, 'Resumen', columns, 'Resumen por categoría', input)

  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const rows = [...groupBy(expenses, (expense) => expense.category_id)]
    .map(([id, items]) => ({ name: categoryName.get(id) ?? 'Sin categoría', items, total: sumAmounts(items) }))
    .sort((a, b) => b.total - a.total)

  const total = sumAmounts(expenses)
  rows.forEach((row, index) => {
    writeDataRow(sheet, FIRST_DATA_ROW + index, index, [
      row.name,
      row.items.length,
      ...(bySource ? sourceAmounts(row.items) : []),
      row.total,
      total > 0 ? row.total / total : 0,
    ])
  })

  const { totalRow } = closeTable(sheet, columns.length, rows.length)
  totalRow.getCell(1).value = 'Total'
  writeTotals(sheet, totalRow, columns.length, rows.length, expenses, { bySource, hasPercent: true })
}

/** Hoja 3: el total de cada día, para ver los picos del mes. */
function addDailySheet(workbook: ExcelJS.Workbook, input: ExportInput) {
  const { expenses, source } = input
  const bySource = source === null
  const columns: SheetColumn[] = [
    { label: 'Fecha', width: 12, style: { numFmt: DATE_FORMAT } },
    { label: 'Día', width: 14 },
    { label: 'Gastos', width: 10, style: { numFmt: COUNT_FORMAT, alignment: { horizontal: 'center' } } },
    ...(bySource ? sourceColumns() : []),
    { label: 'Total', width: 16, style: { numFmt: MONEY_FORMAT } },
  ]
  const sheet = createSheet(workbook, 'Por día', columns, 'Total por día', input)

  const rows = [...groupBy(expenses, (expense) => expense.spent_on)].sort(([a], [b]) => a.localeCompare(b))
  rows.forEach(([day, items], index) => {
    writeDataRow(sheet, FIRST_DATA_ROW + index, index, [
      toUTCDate(day),
      formatWeekday(day),
      items.length,
      ...(bySource ? sourceAmounts(items) : []),
      sumAmounts(items),
    ])
  })

  const { totalRow } = closeTable(sheet, columns.length, rows.length)
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 2)
  const label = totalRow.getCell(1)
  label.value = plural(rows.length, 'día con gastos', 'días con gastos')
  label.alignment = { horizontal: 'left', vertical: 'middle' }
  writeTotals(sheet, totalRow, columns.length, rows.length, expenses, { bySource, hasPercent: false })
}

function sourceColumns(): SheetColumn[] {
  return Object.values(EXPENSE_SOURCES).map((item) => ({
    label: `${item.emoji} ${item.label}`,
    width: 16,
    style: { numFmt: MONEY_FORMAT },
  }))
}

function sourceAmounts(expenses: Expense[]): number[] {
  return Object.keys(EXPENSE_SOURCES).map((key) => sumAmounts(expenses.filter((expense) => expense.source === key)))
}

function sumAmounts(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}

function groupBy(expenses: Expense[], keyOf: (expense: Expense) => string): Map<string, Expense[]> {
  const groups = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const group = groups.get(keyOf(expense))
    if (group) group.push(expense)
    else groups.set(keyOf(expense), [expense])
  }
  return groups
}

/** Crea la hoja con sus títulos, el encabezado fijo y el ancho de cada columna. */
function createSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: SheetColumn[],
  kind: string,
  { expenses, periodLabel, source, generatedOn }: ExportInput,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: BRAND } },
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
    pageSetup: {
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })
  sheet.columns = columns.map(({ width, style }) => ({ width, style }))

  const lastColumn = sheet.getColumn(columns.length).letter
  const scope = source ? `Solo gastos ${EXPENSE_SOURCES[source].ofLabel}` : 'Caja menor y jefe'
  const headings: { text: string; font: Partial<ExcelJS.Font>; height?: number }[] = [
    { text: APP_NAME, font: { size: 16, bold: true, color: { argb: BRAND } }, height: 24 },
    { text: `${kind} · ${periodLabel} · ${scope}`, font: { size: 11, bold: true, color: { argb: INK } } },
    {
      text: `${plural(expenses.length, 'gasto', 'gastos')} · Total ${formatMoney(sumAmounts(expenses))} · Generado el ${formatFullDate(generatedOn)}`,
      font: { size: 9, color: { argb: MUTED } },
    },
  ]
  headings.forEach(({ text, font, height }, index) => {
    const row = index + 1
    sheet.mergeCells(`A${row}:${lastColumn}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = text
    cell.font = { name: FONT, ...font }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (height) sheet.getRow(row).height = height
  })
  sheet.getRow(HEADER_ROW - 1).height = 8

  const header = sheet.getRow(HEADER_ROW)
  header.values = columns.map((column) => column.label)
  header.height = 24
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1)
    cell.font = { name: FONT, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = {
      vertical: 'middle',
      horizontal: column.style?.alignment?.horizontal ?? (column.style?.numFmt === MONEY_FORMAT ? 'right' : 'left'),
      wrapText: true,
    }
  })
  return sheet
}

function writeDataRow(sheet: ExcelJS.Worksheet, rowNumber: number, index: number, values: ExcelJS.CellValue[]) {
  const row = sheet.getRow(rowNumber)
  row.values = values
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { bottom: { style: 'hair', color: { argb: LINE } } }
    // Franjas claras alternas para no perder la fila al leer de izquierda a derecha.
    if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
  })
}

/** Cierra la tabla: aviso cuando no hay datos y fila de totales resaltada. */
function closeTable(sheet: ExcelJS.Worksheet, width: number, dataRows: number) {
  if (dataRows === 0) {
    sheet.mergeCells(FIRST_DATA_ROW, 1, FIRST_DATA_ROW, width)
    const notice = sheet.getCell(FIRST_DATA_ROW, 1)
    notice.value = 'No hay gastos registrados en este periodo.'
    notice.font = { name: FONT, italic: true, color: { argb: MUTED } }
    notice.alignment = { horizontal: 'left', vertical: 'middle' }
  }
  const lastDataRow = FIRST_DATA_ROW + Math.max(dataRows, 1) - 1
  const totalRow = sheet.getRow(lastDataRow + 1)
  totalRow.height = 24
  for (let column = 1; column <= width; column += 1) {
    const cell = totalRow.getCell(column)
    cell.font = { name: FONT, bold: true, color: { argb: INK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
    cell.border = { top: { style: 'thin', color: { argb: BRAND } } }
    cell.alignment = { ...cell.alignment, vertical: 'middle' }
  }
  return { lastDataRow, totalRow }
}

/**
 * Totales de las hojas de resumen: cantidad de gastos, montos por origen y total.
 * Las columnas numéricas terminan a la derecha, antes del porcentaje si la hoja lo tiene.
 */
function writeTotals(
  sheet: ExcelJS.Worksheet,
  totalRow: ExcelJS.Row,
  width: number,
  dataRows: number,
  expenses: Expense[],
  { bySource, hasPercent }: { bySource: boolean; hasPercent: boolean },
) {
  const values = [expenses.length, ...(bySource ? sourceAmounts(expenses) : []), sumAmounts(expenses)]
  const lastNumberColumn = hasPercent ? width - 1 : width
  const firstNumberColumn = lastNumberColumn - values.length + 1
  const lastDataRow = FIRST_DATA_ROW + Math.max(dataRows, 1) - 1

  values.forEach((value, index) => {
    const column = firstNumberColumn + index
    const letter = sheet.getColumn(column).letter
    totalRow.getCell(column).value =
      dataRows > 0 ? { formula: `SUM(${letter}${FIRST_DATA_ROW}:${letter}${lastDataRow})`, result: value } : value
  })
  // La columna de porcentaje de la hoja de categorías siempre cierra en 100 %.
  if (hasPercent) totalRow.getCell(width).value = dataRows > 0 ? 1 : 0
}
