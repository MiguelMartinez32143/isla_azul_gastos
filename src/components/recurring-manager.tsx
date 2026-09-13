'use client'

import { ChevronLeft, Pause, Play, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useState, useTransition } from 'react'
import { deleteRecurring, saveRecurring, setRecurringActive } from '@/actions/recurring'
import { CategoryIcon } from '@/components/category-icon'
import { EmptyState } from '@/components/empty-state'
import { MoneyInput } from '@/components/money-input'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import {
  EXPENSE_SOURCES,
  EXPENSE_SOURCE_KEYS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  RECURRING_SUGGESTIONS,
} from '@/lib/constants'
import { formatMoney, normalizeText } from '@/lib/format'
import { buttonClass, card, errorBox, fieldHelp, fieldLabel, input, sectionTitle } from '@/lib/styles'
import type { ActionResult, Category, ExpenseSource, PaymentMethod, RecurringExpense, Supplier } from '@/lib/types'
import { cx, plural } from '@/lib/utils'

type RecurringManagerProps = {
  items: RecurringExpense[]
  categories: Category[]
  suppliers: Supplier[]
  /** Gastos fijos que ya se registraron este mes. */
  registeredIds: string[]
}

export function RecurringManager({ items, categories, suppliers, registeredIds }: RecurringManagerProps) {
  const [editing, setEditing] = useState<RecurringExpense | 'new' | null>(null)

  const registered = new Set(registeredIds)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const active = items.filter((item) => item.is_active)
  const paused = items.filter((item) => !item.is_active)
  const monthlyTotal = active.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const variableCount = active.filter((item) => item.amount === null).length
  const pendingCount = active.filter((item) => !registered.has(item.id)).length

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <Link
          href="/ajustes"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-stone-500 transition hover:bg-stone-200/60"
        >
          <ChevronLeft className="size-4" />
          Ajustes
        </Link>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Gastos fijos</h1>
            <p className="text-sm text-stone-500">Lo que pagas cada mes. En el inicio verás cuáles faltan por registrar.</p>
          </div>
          <button type="button" onClick={() => setEditing('new')} className={cx(buttonClass('primary', 'sm'), 'shrink-0')}>
            <Plus className="size-5" />
            Nuevo
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          emoji="📌"
          title="Aún no tienes gastos fijos"
          description="Agrega los que pagas todos los meses, como el arriendo, los servicios o la nómina."
          action={
            <button type="button" onClick={() => setEditing('new')} className={buttonClass()}>
              <Plus className="size-5" />
              Agregar gasto fijo
            </button>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className={cx(card, 'grid grid-cols-2 divide-x divide-stone-100')}>
              <div className="min-w-0 px-5 py-4">
                <p className="text-sm text-stone-500">Fijos al mes</p>
                <p className="truncate text-xl font-bold tabular-nums">{formatMoney(monthlyTotal)}</p>
                {variableCount > 0 && <p className="text-xs text-stone-500">+ {variableCount} de monto variable</p>}
              </div>
              <div className="min-w-0 px-5 py-4">
                <p className="text-sm text-stone-500">Este mes</p>
                <p className={cx('text-xl font-bold', pendingCount > 0 ? 'text-amber-700' : 'text-brand-700')}>
                  {pendingCount > 0 ? plural(pendingCount, 'pendiente', 'pendientes') : 'Al día'}
                </p>
                <p className="text-xs text-stone-500">
                  {plural(active.length - pendingCount, 'registrado', 'registrados')}
                </p>
              </div>
            </div>
          )}

          {active.length > 0 && (
            <ul className={cx(card, 'divide-y divide-stone-100 overflow-hidden')}>
              {active.map((item) => (
                <RecurringRow
                  key={item.id}
                  item={item}
                  category={categoryById.get(item.category_id)}
                  registered={registered.has(item.id)}
                  onEdit={() => setEditing(item)}
                />
              ))}
            </ul>
          )}

          {paused.length > 0 && (
            <section>
              <h2 className={sectionTitle}>Pausados</h2>
              <ul className={cx(card, 'divide-y divide-stone-100 overflow-hidden')}>
                {paused.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    category={categoryById.get(item.category_id)}
                    registered={false}
                    onEdit={() => setEditing(item)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}
      >
        {editing !== null && (
          <RecurringEditor
            item={editing === 'new' ? null : editing}
            categories={categories}
            suppliers={suppliers}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function RecurringRow({
  item,
  category,
  registered,
  onEdit,
}: {
  item: RecurringExpense
  category: Category | undefined
  registered: boolean
  onEdit: () => void
}) {
  const source = EXPENSE_SOURCES[item.source]
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className={cx(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50',
          !item.is_active && 'opacity-70',
        )}
      >
        <CategoryIcon icon={category?.icon ?? '📌'} color={category?.color ?? '#a8a29e'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.name}</span>
          <span className="block truncate text-sm text-stone-500">
            Día {item.due_day} · {source.emoji} {source.label} · {PAYMENT_METHODS[item.payment_method].short}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">{item.amount ? formatMoney(item.amount) : 'Variable'}</span>
          {item.is_active ? (
            <span className={cx('text-xs font-medium', registered ? 'text-brand-700' : 'text-amber-700')}>
              {registered ? '✓ Registrado' : 'Pendiente'}
            </span>
          ) : (
            <span className="text-xs text-stone-500">Pausado</span>
          )}
        </span>
      </button>
    </li>
  )
}

function RecurringEditor({
  item,
  categories,
  suppliers,
  onDone,
}: {
  item: RecurringExpense | null
  categories: Category[]
  suppliers: Supplier[]
  onDone: () => void
}) {
  const toast = useToast()
  const selectableCategories = categories.filter((category) => category.is_active || category.id === item?.category_id)

  const [name, setName] = useState(item?.name ?? '')
  const [amount, setAmount] = useState<number | null>(item?.amount ?? null)
  const [dueDay, setDueDay] = useState(item?.due_day ?? 1)
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [source, setSource] = useState<ExpenseSource>(item?.source ?? 'manager')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(item?.payment_method ?? 'transfer')
  const [pickedPaymentByHand, setPickedPaymentByHand] = useState(Boolean(item))
  const [supplierId, setSupplierId] = useState(item?.supplier_id ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function applySuggestion(suggestion: (typeof RECURRING_SUGGESTIONS)[number]) {
    setName(suggestion.name)
    const match = selectableCategories.find(
      (category) => normalizeText(category.name) === normalizeText(suggestion.category),
    )
    if (match) setCategoryId(match.id)
  }

  function pickSource(next: ExpenseSource) {
    setSource(next)
    // La caja menor casi siempre paga en efectivo; solo se ajusta si no se eligió el pago a mano.
    if (!pickedPaymentByHand) setPaymentMethod(next === 'petty_cash' ? 'cash' : 'transfer')
  }

  function run(action: () => Promise<ActionResult<unknown>>, successMessage: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success(successMessage)
        onDone()
      } catch {
        setError('No se pudo completar. Revisa tu conexión e intenta de nuevo.')
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryId) {
      setError('Elige una categoría.')
      return
    }
    run(
      () =>
        saveRecurring({
          id: item?.id,
          name,
          amount,
          categoryId,
          supplierId: supplierId || null,
          paymentMethod,
          source,
          dueDay,
        }),
      item ? 'Gasto fijo actualizado' : 'Gasto fijo creado',
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!item && (
        <div>
          <p className={fieldLabel}>Toca una sugerencia o escribe el tuyo</p>
          <div className="flex flex-wrap gap-2">
            {RECURRING_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                aria-pressed={name === suggestion.name}
                className={cx(
                  'h-9 rounded-full px-3 text-sm font-medium transition',
                  name === suggestion.name ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
                )}
              >
                <span aria-hidden>{suggestion.icon}</span> {suggestion.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="recurring-name" className={fieldLabel}>
          Nombre
        </label>
        <input
          id="recurring-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          autoComplete="off"
          placeholder="Ej: Arriendo del local"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="recurring-amount" className={fieldLabel}>
          Monto <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <MoneyInput id="recurring-amount" value={amount} onChange={setAmount} placeholder="Monto variable" />
        <p className={fieldHelp}>Déjalo vacío si cambia cada mes, como la luz o el agua.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="recurring-day" className={fieldLabel}>
            Se paga el
          </label>
          <select
            id="recurring-day"
            value={dueDay}
            onChange={(event) => setDueDay(Number(event.target.value))}
            className={input}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                Día {day}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recurring-payment" className={fieldLabel}>
            Forma de pago
          </label>
          <select
            id="recurring-payment"
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value as PaymentMethod)
              setPickedPaymentByHand(true)
            }}
            className={input}
          >
            {PAYMENT_METHOD_KEYS.map((key) => (
              <option key={key} value={key}>
                {PAYMENT_METHODS[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="recurring-category" className={fieldLabel}>
          Categoría
        </label>
        <select
          id="recurring-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={input}
        >
          <option value="" disabled>
            Elige una categoría
          </option>
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={fieldLabel}>¿Quién lo paga?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1">
          {EXPENSE_SOURCE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={source === key}
              onClick={() => pickSource(key)}
              className={cx(
                'flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition',
                source === key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
              )}
            >
              <span aria-hidden>{EXPENSE_SOURCES[key].emoji}</span>
              {EXPENSE_SOURCES[key].label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="recurring-supplier" className={fieldLabel}>
          Proveedor <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <select
          id="recurring-supplier"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          className={input}
        >
          <option value="">Sin proveedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={cx(buttonClass(), 'w-full')}>
        {isPending ? 'Guardando…' : item ? 'Guardar cambios' : 'Crear gasto fijo'}
      </button>

      {item && (
        <div className="space-y-2 border-t border-stone-100 pt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => setRecurringActive(item.id, !item.is_active),
                item.is_active ? 'Gasto fijo pausado' : 'Gasto fijo reactivado',
              )
            }
            className={cx(buttonClass('secondary'), 'w-full')}
          >
            {item.is_active ? (
              <>
                <Pause className="size-5" />
                Pausar
              </>
            ) : (
              <>
                <Play className="size-5" />
                Reactivar
              </>
            )}
          </button>
          {item.is_active && (
            <p className="text-center text-xs text-stone-500">
              Al pausarlo deja de aparecer como pendiente, sin borrarlo.
            </p>
          )}

          {confirmingDelete ? (
            <div className="rounded-2xl bg-red-50 p-3">
              <p className="text-center text-sm font-medium text-red-700">¿Eliminar “{item.name}”?</p>
              <p className="mt-1 text-center text-xs text-red-700/80">Los gastos que ya registraste se conservan.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} className={buttonClass('secondary')}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => deleteRecurring(item.id), 'Gasto fijo eliminado')}
                  className={buttonClass('danger')}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className={cx(buttonClass('dangerGhost'), 'w-full')}
            >
              <Trash2 className="size-5" />
              Eliminar gasto fijo
            </button>
          )}
        </div>
      )}
    </form>
  )
}
