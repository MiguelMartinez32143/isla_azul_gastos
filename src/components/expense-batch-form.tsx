'use client'

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ListChecks,
  LoaderCircle,
  Plus,
  StickyNote,
  Store,
  Tags,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { type BatchExpenseInput, saveExpenseBatch } from '@/actions/expenses'
import FormLoading from '@/app/(form)/loading'
import { CategoryIcon } from '@/components/category-icon'
import {
  CategoryGrid,
  ChoiceButton,
  DetailButton,
  Keypad,
  NoteField,
  PaymentChoices,
  SourceToggle,
  SupplierPicker,
  applyKey,
  type SupplierChoice,
} from '@/components/expense-fields'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS, MAX_BATCH_ITEMS, PAYMENT_METHODS } from '@/lib/constants'
import type { DayTotals, QuickPick } from '@/lib/data'
import {
  DAYS_WITH_TOTALS,
  addDays,
  formatDayMonth,
  formatFullDate,
  formatWeekday,
  isValidISODate,
} from '@/lib/dates'
import { type BatchItem, newExpenseId, readDraft, writeDraft } from '@/lib/expense-batch'
import { amountToRaw, formatMoney, formatTypedAmount } from '@/lib/format'
import { buttonClass, errorBox, fieldLabel, input } from '@/lib/styles'
import type { Category, ExpenseSource, PaymentMethod, Supplier } from '@/lib/types'
import { buildHref, cx, plural } from '@/lib/utils'

type SheetName = 'resume' | 'date' | 'supplier' | 'category' | 'payment' | 'note' | 'review' | 'done'

type ExpenseBatchFormProps = {
  categories: Category[]
  suppliers: Supplier[]
  quickPicks: QuickPick[]
  defaultSource: ExpenseSource
  defaultPaymentBySource: Record<ExpenseSource, PaymentMethod>
  dayTotals: DayTotals
  today: string
  /** Día con el que se abre (?fecha=…). Si no viene, se pregunta al entrar. */
  initialDay: string | null
}

/** Días que se ofrecen con un toque al elegir el día: hoy y los cinco anteriores. */
const QUICK_DAYS = 6

const subscribeToNothing = () => () => {}

/** Registrar varios gastos de un mismo día sin repetir el día ni esperar a que guarde cada uno. */
export function ExpenseBatchForm(props: ExpenseBatchFormProps) {
  // La lista sin guardar vive en este dispositivo, así que el formulario se arma ya en el navegador.
  const isBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
  return isBrowser ? <BatchComposer {...props} /> : <FormLoading />
}

/** "Hoy", "Ayer", "Anteayer" o "Martes" */
function dayName(day: string, today: string): string {
  if (day === today) return 'Hoy'
  if (day === addDays(today, -1)) return 'Ayer'
  if (day === addDays(today, -2)) return 'Anteayer'
  return formatWeekday(day)
}

/** "27 de octubre", con el año si no es el actual. */
function dayDate(day: string, today: string): string {
  return day.slice(0, 4) === today.slice(0, 4) ? formatDayMonth(day) : formatFullDate(day)
}

function itemTitle(item: BatchItem, categoryName: string): string {
  return item.supplier?.name || item.description || categoryName
}

function toBatchInput(item: BatchItem): BatchExpenseInput {
  return {
    id: item.id,
    amount: item.amount,
    categoryId: item.categoryId,
    paymentMethod: item.paymentMethod,
    source: item.source,
    description: item.description,
    supplierId: item.supplier?.id ?? null,
    newSupplierName: item.supplier && !item.supplier.id ? item.supplier.name : null,
  }
}

function BatchComposer({
  categories,
  suppliers,
  quickPicks,
  defaultSource,
  defaultPaymentBySource,
  dayTotals,
  today,
  initialDay,
}: ExpenseBatchFormProps) {
  const router = useRouter()
  const toast = useToast()
  const addButtonRef = useRef<HTMLButtonElement>(null)

  const [draft] = useState(readDraft)
  const lastItem = draft?.items.at(-1)

  // La lista completa comparte el día; origen y pago se conservan de un gasto al siguiente.
  const [items, setItems] = useState<BatchItem[]>(draft?.items ?? [])
  const [spentOn, setSpentOn] = useState(draft?.spentOn ?? initialDay ?? addDays(today, -1))
  const [source, setSource] = useState<ExpenseSource>(lastItem?.source ?? defaultSource)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    lastItem?.paymentMethod ?? defaultPaymentBySource[defaultSource],
  )
  const [pickedPaymentByHand, setPickedPaymentByHand] = useState(false)
  const [openSheet, setOpenSheet] = useState<SheetName | null>(draft ? 'resume' : initialDay ? null : 'date')

  // El gasto que se está escribiendo.
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [pickedCategoryByHand, setPickedCategoryByHand] = useState(false)
  const [supplier, setSupplier] = useState<SupplierChoice | null>(null)
  const [description, setDescription] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  /** Gasto de la lista que se está corrigiendo, con el origen y el pago a los que hay que volver. */
  const [editing, setEditing] = useState<{
    id: string
    source: ExpenseSource
    paymentMethod: PaymentMethod
    pickedPaymentByHand: boolean
  } | null>(null)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ count: number; total: number; day: string } | null>(null)
  const [isSaving, startSaving] = useTransition()

  const activeCategories = categories.filter((item) => item.is_active)
  const categoryById = new Map(categories.map((item) => [item.id, item]))
  const amountValue = Number(amount || '0')
  const category = categoryId ? (categoryById.get(categoryId) ?? null) : null
  const missing = amountValue <= 0 ? 'amount' : category === null ? 'category' : null
  // Solo se marca en rojo lo que falta después de intentar agregar.
  const showMissing = failedAttempts > 0 ? missing : null
  const amountText = formatTypedAmount(amount)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const dayLabel = `${dayName(spentOn, today)} · ${dayDate(spentOn, today)}`
  const existing = dayTotals[spentOn]
  const totalsKnown = spentOn > addDays(today, -DAYS_WITH_TOTALS)

  // La lista sobrevive si se cierra la app o se pasa a otra (por ejemplo, para leer el WhatsApp del cajero).
  useEffect(() => {
    writeDraft(items.length > 0 ? { spentOn, items } : null)
  }, [items, spentOn])

  // Al cerrar una hoja, Enter vuelve a servir para agregar el gasto.
  useEffect(() => {
    if (openSheet === null) addButtonRef.current?.focus({ preventScroll: true })
  }, [openSheet])

  /** Cierra esa hoja, salvo que ya se haya pasado a otra. */
  const closeSheet = (name: SheetName) => () => setOpenSheet((current) => (current === name ? null : current))

  function pressKey(key: string) {
    setAmount((current) => applyKey(current, key))
    addButtonRef.current?.focus({ preventScroll: true })
  }

  function pickSource(next: ExpenseSource) {
    setSource(next)
    // La caja menor casi siempre se paga en efectivo; solo se ajusta si no se eligió el pago a mano.
    if (!pickedPaymentByHand) setPaymentMethod(defaultPaymentBySource[next])
  }

  function pickCategory(id: string | null) {
    setCategoryId(id)
    setPickedCategoryByHand(id !== null)
    setOpenSheet(null)
    addButtonRef.current?.focus({ preventScroll: true })
  }

  function pickSupplier(choice: SupplierChoice | null) {
    setSupplier(choice)
    setOpenSheet(null)
    addButtonRef.current?.focus({ preventScroll: true })
    if (pickedCategoryByHand) return
    // Sugiere la categoría habitual del proveedor si no se eligió una a mano.
    const suggested = choice?.id ? suppliers.find((item) => item.id === choice.id)?.default_category_id : null
    setCategoryId(suggested && activeCategories.some((item) => item.id === suggested) ? suggested : null)
  }

  /** Deja el formulario listo para el siguiente gasto. */
  function clearComposer() {
    setAmount('')
    setCategoryId(null)
    setPickedCategoryByHand(false)
    setSupplier(null)
    setDescription('')
    setFailedAttempts(0)
    if (editing) {
      setSource(editing.source)
      setPaymentMethod(editing.paymentMethod)
      setPickedPaymentByHand(editing.pickedPaymentByHand)
      setEditing(null)
    }
  }

  /** Pasa a la lista lo que se está escribiendo, o actualiza el gasto que se está corrigiendo. */
  function commitItem(): BatchItem | null {
    if (category === null || missing !== null) return null
    const item: BatchItem = {
      id: editing?.id ?? newExpenseId(),
      amount: amountValue,
      categoryId: category.id,
      source,
      paymentMethod,
      description: description.trim(),
      supplier,
    }
    setItems((current) =>
      editing ? current.map((other) => (other.id === editing.id ? item : other)) : [...current, item],
    )
    clearComposer()
    return item
  }

  function addItem() {
    if (missing !== null) {
      setFailedAttempts((count) => count + 1)
      return
    }
    if (!editing && items.length >= MAX_BATCH_ITEMS) {
      toast.error(`Llegaste a ${MAX_BATCH_ITEMS} gastos: guarda esta lista y sigue con otra.`)
      return
    }
    const wasEditing = editing !== null
    const item = commitItem()
    if (wasEditing) setOpenSheet('review')
    else if (item) toast.success(`Agregado: ${itemTitle(item, category?.name ?? '')} · ${formatMoney(item.amount)}`)
  }

  function openReview() {
    // Si lo que se está escribiendo ya está completo, entra a la lista para no dejarlo por fuera.
    if (items.length < MAX_BATCH_ITEMS) commitItem()
    setSaveError(null)
    setOpenSheet('review')
  }

  function editItem(item: BatchItem) {
    setEditing({ id: item.id, source, paymentMethod, pickedPaymentByHand })
    setAmount(amountToRaw(item.amount))
    setCategoryId(item.categoryId)
    setPickedCategoryByHand(true)
    setSupplier(item.supplier)
    setDescription(item.description)
    setSource(item.source)
    setPaymentMethod(item.paymentMethod)
    setPickedPaymentByHand(true)
    setFailedAttempts(0)
    setSaveError(null)
    setOpenSheet(null)
  }

  function cancelEdit() {
    clearComposer()
    setOpenSheet('review')
  }

  function removeItem(id: string) {
    const remaining = items.filter((item) => item.id !== id)
    setItems(remaining)
    setSaveError(null)
    if (remaining.length === 0) setOpenSheet(null)
  }

  function discardDraft() {
    setItems([])
    setSpentOn(initialDay ?? addDays(today, -1))
    setOpenSheet(initialDay ? null : 'date')
  }

  function saveAll() {
    if (isSaving || items.length === 0) return
    setSaveError(null)
    startSaving(async () => {
      try {
        const result = await saveExpenseBatch(spentOn, items.map(toBatchInput))
        if (!result.ok) {
          setSaveError(result.error)
          return
        }
        setSaved({ count: items.length, total, day: spentOn })
        setItems([])
        setOpenSheet('done')
      } catch {
        setSaveError('No se pudo guardar. Revisa tu conexión e intenta de nuevo: tu lista sigue aquí.')
      }
    })
  }

  function leave() {
    if (items.length > 0) toast.success(`Tu lista de ${plural(items.length, 'gasto', 'gastos')} sigue sin guardar: la encuentras en “Varios”.`)
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  // En computador también se puede escribir el monto con el teclado y agregar con Enter.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (openSheet !== null || event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('input, textarea, select')) return

    if (/^\d$/.test(event.key)) pressKey(event.key)
    else if (event.key === 'Backspace') pressKey('back')
    else if (event.key === ',' || event.key === '.') pressKey('.')
    else if (event.key === 'Enter' && !target?.closest('button, a')) addItem()
    else return
    event.preventDefault()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // Lo que más se repite queda a un toque: proveedores y categorías de los gastos sin proveedor.
  const chips = quickPicks.flatMap((pick) => {
    if (pick.supplierId) {
      const found = suppliers.find((item) => item.id === pick.supplierId)
      if (!found) return []
      const chipCategory = categoryById.get(found.default_category_id ?? pick.categoryId)
      return [
        {
          key: found.id,
          label: found.name,
          icon: chipCategory?.icon ?? '🏪',
          selected: supplier?.id === found.id,
          onClick: () => pickSupplier(supplier?.id === found.id ? null : { id: found.id, name: found.name }),
        },
      ]
    }
    const chipCategory = categoryById.get(pick.categoryId)
    if (!chipCategory?.is_active) return []
    return [
      {
        key: chipCategory.id,
        label: chipCategory.name,
        icon: chipCategory.icon,
        selected: categoryId === chipCategory.id,
        onClick: () => pickCategory(categoryId === chipCategory.id ? null : chipCategory.id),
      },
    ]
  })

  const addLabel =
    missing === 'amount'
      ? 'Escribe el monto'
      : missing === 'category'
        ? 'Elige una categoría'
        : editing
          ? `Actualizar a ${formatMoney(amountValue)}`
          : `Agregar ${formatMoney(amountValue)} a la lista`

  const statusLine =
    showMissing === 'amount'
      ? 'Escribe el monto con el teclado de abajo'
      : showMissing === 'category'
        ? 'Toca un proveedor o elige la categoría'
        : editing
          ? 'Corrigiendo un gasto de la lista'
          : [category ? `${category.icon} ${category.name}` : null, supplier?.name].filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={leave}
          aria-label="Salir"
          className="grid size-12 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100"
        >
          <X className="size-6" />
        </button>
        <h1 className="sr-only">Varios gastos de un día</h1>
        <SourceToggle value={source} onChange={pickSource} />
        <span className="size-12" aria-hidden />
      </header>

      {/* El día de toda la lista */}
      <div className="px-4 pt-1">
        <button
          type="button"
          onClick={() => setOpenSheet('date')}
          aria-haspopup="dialog"
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-brand-50 px-4 py-2 text-left ring-1 ring-brand-200 transition hover:bg-brand-100"
        >
          <CalendarDays className="size-5 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-brand-800">{dayLabel}</span>
            {totalsKnown && (
              <span className="block truncate text-xs text-stone-600">
                {existing
                  ? `Ya hay ${plural(existing.count, 'gasto registrado', 'gastos registrados')} · ${formatMoney(existing.total)}`
                  : 'Sin gastos registrados todavía'}
              </span>
            )}
          </span>
          <ChevronDown className="size-5 shrink-0 text-brand-700" aria-hidden />
        </button>
      </div>

      {/* Monto */}
      <div className="px-5 pt-2 text-center">
        <p
          key={showMissing === 'amount' ? `amount-${failedAttempts}` : 'amount'}
          aria-live="polite"
          className={cx(
            'font-bold tracking-tight tabular-nums',
            amountText.length > 14 ? 'text-3xl' : amountText.length > 10 ? 'text-4xl' : 'text-5xl',
            amountValue > 0 ? 'text-stone-900' : showMissing === 'amount' ? 'animate-shake text-red-400' : 'text-stone-300',
          )}
        >
          {amountText}
        </p>
        <p className={cx('mt-1 h-5 truncate text-sm', showMissing ? 'font-medium text-red-600' : 'text-stone-500')}>
          {statusLine}
        </p>
      </div>

      {/* Lo más frecuente, a un toque */}
      {chips.length > 0 && (
        <div
          role="group"
          aria-label="Proveedores y categorías frecuentes"
          // Filas de chips según el alto de la pantalla: lo que no cabe se busca en Proveedor o Categoría.
          className="mt-2 flex max-h-[4.875rem] flex-wrap gap-1.5 overflow-hidden px-4 [@media(max-height:700px)]:max-h-9 [@media(min-height:780px)]:max-h-[7.5rem]"
        >
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={chip.selected}
              onClick={chip.onClick}
              className={cx(
                'flex h-9 max-w-44 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition active:scale-95',
                chip.selected ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
              )}
            >
              <span aria-hidden>{chip.icon}</span>
              <span className="truncate">{chip.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Detalles del gasto */}
      <div className="grid grid-cols-4 gap-1.5 px-4 pt-2">
        <DetailButton
          label="Proveedor"
          value={supplier?.name ?? null}
          active={supplier !== null}
          icon={<Store className="size-5" />}
          onClick={() => setOpenSheet('supplier')}
        />
        <DetailButton
          key={showMissing === 'category' ? `category-${failedAttempts}` : 'category'}
          label="Categoría"
          value={category?.name ?? null}
          active={category !== null}
          invalid={showMissing === 'category'}
          icon={
            category ? (
              <span className="text-lg leading-5" aria-hidden>
                {category.icon}
              </span>
            ) : (
              <Tags className="size-5" />
            )
          }
          onClick={() => setOpenSheet('category')}
        />
        <DetailButton
          label="Nota"
          value={description.trim() || null}
          active={description.trim() !== ''}
          icon={<StickyNote className="size-5" />}
          onClick={() => setOpenSheet('note')}
        />
        <DetailButton
          label="Pago"
          value={PAYMENT_METHODS[paymentMethod].short}
          active={false}
          icon={
            <span className="text-lg leading-5" aria-hidden>
              {PAYMENT_METHODS[paymentMethod].emoji}
            </span>
          }
          onClick={() => setOpenSheet('payment')}
        />
      </div>

      <Keypad onPress={pressKey} keyClassName="h-11 [@media(min-height:700px)]:h-12 [@media(min-height:800px)]:h-14" />

      <div className="px-4 pt-2">
        <button
          ref={addButtonRef}
          type="button"
          onClick={addItem}
          className={cx(
            'flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition active:scale-[0.98]',
            missing ? 'bg-stone-200 text-stone-500' : 'bg-brand-600 text-white shadow-lg shadow-brand-700/25 hover:bg-brand-700',
          )}
        >
          {!missing && (editing ? <Check className="size-5" /> : <Plus className="size-5" />)}
          {addLabel}
        </button>
      </div>

      <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {editing ? (
          <button type="button" onClick={cancelEdit} className={cx(buttonClass('secondary'), 'w-full')}>
            Cancelar la corrección
          </button>
        ) : items.length > 0 ? (
          <button
            type="button"
            onClick={openReview}
            className="flex h-12 w-full items-center gap-2 rounded-2xl bg-stone-900 pl-4 pr-3 text-white transition hover:bg-stone-800 active:scale-[0.98]"
          >
            <ListChecks className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold tabular-nums">
              {plural(items.length, 'gasto', 'gastos')} · {formatMoney(total)}
            </span>
            <span className="shrink-0 text-sm font-medium">Revisar y guardar</span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </button>
        ) : (
          <p className="flex h-12 items-center justify-center text-center text-sm text-stone-500">
            Agrégalos uno tras otro; al final los guardas todos juntos.
          </p>
        )}
      </div>

      <Sheet
        open={openSheet === 'resume'}
        onClose={closeSheet('resume')}
        title="Tienes una lista sin guardar"
        description={`${plural(items.length, 'gasto', 'gastos')} · ${formatMoney(total)} · ${dayLabel}`}
      >
        <div className="grid gap-2">
          <button type="button" onClick={() => setOpenSheet(null)} className={buttonClass()}>
            Seguir con esta lista
          </button>
          <button type="button" onClick={discardDraft} className={buttonClass('dangerGhost')}>
            Borrarla y empezar otra
          </button>
        </div>
      </Sheet>

      <Sheet
        open={openSheet === 'date'}
        onClose={closeSheet('date')}
        title="¿De qué día son los gastos?"
        description={
          items.length > 0
            ? 'Al cambiarlo, cambia para toda la lista.'
            : 'Todos los que agregues quedarán con ese día.'
        }
      >
        <div className="space-y-1.5">
          {Array.from({ length: QUICK_DAYS }, (_, index) => addDays(today, -index)).map((day) => (
            <DayOption
              key={day}
              name={dayName(day, today)}
              date={dayDate(day, today)}
              totals={dayTotals[day]}
              selected={spentOn === day}
              onClick={() => {
                setSpentOn(day)
                setOpenSheet(null)
              }}
            />
          ))}
          <label className="block pt-2">
            <span className={fieldLabel}>Otra fecha</span>
            <input
              type="date"
              value={spentOn}
              max={today}
              onChange={(event) => {
                if (isValidISODate(event.target.value) && event.target.value <= today) setSpentOn(event.target.value)
              }}
              className={input}
            />
          </label>
          <button type="button" onClick={() => setOpenSheet(null)} className={cx(buttonClass(), 'mt-2 w-full')}>
            Listo
          </button>
        </div>
      </Sheet>

      <Sheet
        open={openSheet === 'supplier'}
        onClose={closeSheet('supplier')}
        title="¿A quién le pagaste?"
        description="Busca un proveedor o escribe uno nuevo."
      >
        <SupplierPicker suppliers={suppliers} categories={categories} selected={supplier} onSelect={pickSupplier} />
      </Sheet>

      <Sheet open={openSheet === 'category'} onClose={closeSheet('category')} title="¿En qué se gastó?">
        <CategoryGrid categories={activeCategories} selectedId={categoryId} onPick={pickCategory} />
      </Sheet>

      <Sheet
        open={openSheet === 'note'}
        onClose={closeSheet('note')}
        title="Nota"
        description="Opcional. Por ejemplo, el número de factura o qué se compró."
      >
        <NoteField value={description} onChange={setDescription} onDone={() => setOpenSheet(null)} />
      </Sheet>

      <Sheet open={openSheet === 'payment'} onClose={closeSheet('payment')} title="¿Cómo se pagó?">
        <PaymentChoices
          value={paymentMethod}
          onPick={(next) => {
            setPaymentMethod(next)
            setPickedPaymentByHand(true)
            setOpenSheet(null)
          }}
        />
      </Sheet>

      <Sheet
        open={openSheet === 'review'}
        onClose={closeSheet('review')}
        title={`${plural(items.length, 'gasto', 'gastos')} · ${formatMoney(total)}`}
        description={`${dayLabel} · Toca uno para corregirlo.`}
      >
        {existing && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            Este día ya tiene {plural(existing.count, 'gasto', 'gastos')} ({formatMoney(existing.total)}). Revisa que no se
            repitan.{' '}
            <Link href={buildHref('/historial', { desde: spentOn })} className="font-semibold underline">
              Ver
            </Link>
          </p>
        )}
        {amountValue > 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            Los {formatMoney(amountValue)} que estabas escribiendo todavía no están en la lista.
          </p>
        )}

        <ul className="-mx-2 divide-y divide-stone-100">
          {items.map((item) => (
            <BatchRow
              key={item.id}
              item={item}
              category={categoryById.get(item.categoryId)}
              onEdit={() => editItem(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ul>

        {/* La sombra blanca tapa las filas que asomarían en el margen inferior de la hoja. */}
        <div className="sticky bottom-0 -mx-5 bg-white px-5 pt-3 shadow-[0_3rem_0_0_#fff]">
          {EXPENSE_SOURCE_KEYS.every((key) => items.some((item) => item.source === key)) && (
            <p className="pb-2 text-center text-xs text-stone-500">
              {EXPENSE_SOURCE_KEYS.map((key) => {
                const sourceTotal = items.reduce((sum, item) => (item.source === key ? sum + item.amount : sum), 0)
                return `${EXPENSE_SOURCES[key].emoji} ${EXPENSE_SOURCES[key].label} ${formatMoney(sourceTotal)}`
              }).join(' · ')}
            </p>
          )}
          {saveError && (
            <p role="alert" className={cx(errorBox, 'mb-3')}>
              {saveError}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => setOpenSheet(null)} className={buttonClass('secondary')}>
              Agregar más
            </button>
            <button type="button" onClick={saveAll} disabled={isSaving} className={buttonClass()}>
              {isSaving ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" />
                  Guardando…
                </>
              ) : (
                `Guardar ${plural(items.length, 'gasto', 'gastos')}`
              )}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={openSheet === 'done'} onClose={closeSheet('done')} title="Gastos guardados">
        {saved && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">
                  {plural(saved.count, 'gasto', 'gastos')} · {formatMoney(saved.total)}
                </p>
                <p className="truncate text-sm text-stone-600">
                  {dayName(saved.day, today)} · {dayDate(saved.day, today)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => setOpenSheet('date')} className={buttonClass()}>
                Registrar gastos de otro día
              </button>
              <Link href={buildHref('/historial', { desde: saved.day })} className={buttonClass('secondary')}>
                Ver en el historial
              </Link>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function DayOption({
  name,
  date,
  totals,
  selected,
  onClick,
}: {
  name: string
  date: string
  totals: DayTotals[string] | undefined
  selected: boolean
  onClick: () => void
}) {
  return (
    <ChoiceButton selected={selected} onClick={onClick}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{name}</span>
        <span className="block truncate text-sm text-stone-500">{date}</span>
      </span>
      {totals ? (
        <span className="shrink-0 text-right text-sm">
          <span className="block font-medium leading-tight">{plural(totals.count, 'gasto', 'gastos')}</span>
          <span className="block tabular-nums text-stone-500">{formatMoney(totals.total)}</span>
        </span>
      ) : (
        <span className="shrink-0 text-sm text-stone-400">Sin gastos</span>
      )}
    </ChoiceButton>
  )
}

function BatchRow({
  item,
  category,
  onEdit,
  onRemove,
}: {
  item: BatchItem
  category: Category | undefined
  onEdit: () => void
  onRemove: () => void
}) {
  const categoryName = category?.name ?? 'Sin categoría'
  const title = itemTitle(item, categoryName)
  const source = EXPENSE_SOURCES[item.source]
  const details = [
    title === categoryName ? null : categoryName,
    item.supplier ? item.description : null,
    item.supplier && !item.supplier.id ? 'Proveedor nuevo' : null,
    PAYMENT_METHODS[item.paymentMethod].label,
  ].filter(Boolean)

  return (
    <li className="flex items-center gap-1 py-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Corregir ${title}, ${formatMoney(item.amount)}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-stone-50 active:bg-stone-100"
      >
        <CategoryIcon icon={category?.icon ?? '📋'} color={category?.color ?? '#a8a29e'} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-stone-500">{details.join(' · ')}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">{formatMoney(item.amount)}</span>
          <span
            className={cx(
              'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none',
              source.badgeClass,
            )}
          >
            <span aria-hidden>{source.emoji}</span>
            {source.label}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${title} de la lista`}
        className="grid size-10 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <X className="size-5" />
      </button>
    </li>
  )
}
