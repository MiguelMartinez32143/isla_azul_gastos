'use client'

import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useOptimistic, useState, useTransition } from 'react'
import { deleteCategory, moveCategory, saveCategory, setCategoryActive } from '@/actions/categories'
import { CategoryIcon } from '@/components/category-icon'
import { MoneyInput } from '@/components/money-input'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/constants'
import { formatMoney } from '@/lib/format'
import { buttonClass, card, errorBox, fieldHelp, fieldLabel, input } from '@/lib/styles'
import type { ActionResult, Category } from '@/lib/types'
import { cx, plural } from '@/lib/utils'

type Direction = 'up' | 'down'

type CategoryManagerProps = {
  categories: Category[]
  /** Cantidad total de gastos registrados en cada categoría. */
  entriesByCategory: Record<string, number>
}

export function CategoryManager({ categories, entriesByCategory }: CategoryManagerProps) {
  const toast = useToast()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [, startMoving] = useTransition()

  const active = categories.filter((item) => item.is_active)
  const archived = categories.filter((item) => !item.is_active)
  const [orderedActive, moveOptimistically] = useOptimistic(active, reorder)

  function move(id: string, direction: Direction) {
    startMoving(async () => {
      moveOptimistically({ id, direction })
      try {
        const result = await moveCategory(id, direction)
        if (!result.ok) toast.error(result.error)
      } catch {
        toast.error('No se pudo cambiar el orden. Revisa tu conexión.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-sm text-stone-500">Toca una para editarla o ponerle presupuesto.</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className={cx(buttonClass('primary', 'sm'), 'shrink-0')}>
          <Plus className="size-5" />
          Nueva
        </button>
      </header>

      <ul className={cx(card, 'divide-y divide-stone-100 overflow-hidden')}>
        {orderedActive.map((category, index) => (
          <li key={category.id} className="flex items-center pr-2">
            <button
              type="button"
              onClick={() => setEditing(category)}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition hover:bg-stone-50"
            >
              <CategoryIcon icon={category.icon} color={category.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{category.name}</span>
                {category.monthly_budget ? (
                  <span className="block truncate text-sm font-medium text-brand-700">
                    Presupuesto: {formatMoney(category.monthly_budget)} al mes
                  </span>
                ) : (
                  <span className="block truncate text-sm text-stone-500">{category.hint ?? 'Sin presupuesto'}</span>
                )}
              </span>
            </button>
            <MoveButton label={`Subir ${category.name}`} disabled={index === 0} onClick={() => move(category.id, 'up')}>
              <ArrowUp className="size-5" />
            </MoveButton>
            <MoveButton
              label={`Bajar ${category.name}`}
              disabled={index === orderedActive.length - 1}
              onClick={() => move(category.id, 'down')}
            >
              <ArrowDown className="size-5" />
            </MoveButton>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
            className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-medium text-stone-600"
          >
            Archivadas ({archived.length})
            <ChevronDown className={cx('size-5 transition', showArchived && 'rotate-180')} />
          </button>
          {showArchived && (
            <ul className={cx(card, 'mt-1 divide-y divide-stone-100 overflow-hidden')}>
              {archived.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(category)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left opacity-70 transition hover:bg-stone-50 hover:opacity-100"
                  >
                    <CategoryIcon icon={category.icon} color={category.color} />
                    <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                    <span className="text-xs text-stone-500">Archivada</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="px-1 text-sm text-stone-500">
        💡 Ponle presupuesto a las categorías que más te preocupan (por ejemplo, Alimentos) y en el inicio verás cuánto
        te queda cada mes.
      </p>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva categoría' : 'Editar categoría'}
      >
        {editing !== null && (
          <CategoryEditor
            category={editing === 'new' ? null : editing}
            entries={editing === 'new' ? 0 : (entriesByCategory[editing.id] ?? 0)}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function reorder(list: Category[], { id, direction }: { id: string; direction: Direction }): Category[] {
  const index = list.findIndex((item) => item.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-xl text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function CategoryEditor({ category, entries, onDone }: { category: Category | null; entries: number; onDone: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [hint, setHint] = useState(category?.hint ?? '')
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICONS[0])
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[7])
  const [budget, setBudget] = useState<number | null>(category?.monthly_budget ?? null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
    run(
      () => saveCategory({ id: category?.id, name, hint, icon, color, monthlyBudget: budget }),
      category ? 'Categoría actualizada' : 'Categoría creada',
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <div className="min-w-0">
          <p className={cx('truncate font-semibold', !name && 'text-stone-400')}>{name || 'Nombre de la categoría'}</p>
          <p className="truncate text-sm text-stone-500">{hint || 'Qué incluye'}</p>
        </div>
      </div>

      <div>
        <label htmlFor="category-name" className={fieldLabel}>
          Nombre
        </label>
        <input
          id="category-name"
          data-autofocus={category ? undefined : true}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          required
          autoComplete="off"
          placeholder="Ej: Carnes"
          className={input}
        />
      </div>

      <fieldset>
        <legend className={fieldLabel}>Ícono</legend>
        <div className="grid grid-cols-8 gap-1">
          {CATEGORY_ICONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIcon(option)}
              aria-label={`Ícono ${option}`}
              aria-pressed={icon === option}
              className={cx(
                'grid aspect-square place-items-center rounded-xl text-2xl transition',
                icon === option ? 'bg-brand-50 ring-2 ring-brand-500' : 'hover:bg-stone-100',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              aria-label={`Color ${option}`}
              aria-pressed={color === option}
              className={cx(
                'grid size-9 place-items-center rounded-full transition',
                color === option && 'ring-2 ring-stone-900 ring-offset-2',
              )}
              style={{ backgroundColor: option }}
            >
              {color === option && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="category-hint" className={fieldLabel}>
          Qué incluye <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="category-hint"
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          maxLength={80}
          autoComplete="off"
          placeholder="Ej: res, cerdo, pollo"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="category-budget" className={fieldLabel}>
          Presupuesto mensual <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <MoneyInput id="category-budget" value={budget} onChange={setBudget} placeholder="Sin presupuesto" />
        <p className={fieldHelp}>En el inicio verás cuánto llevas gastado frente a este monto.</p>
      </div>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={cx(buttonClass(), 'w-full')}>
        {isPending ? 'Guardando…' : category ? 'Guardar cambios' : 'Crear categoría'}
      </button>

      {category && (
        <div className="space-y-2 border-t border-stone-100 pt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => setCategoryActive(category.id, !category.is_active),
                category.is_active ? 'Categoría archivada' : 'Categoría restaurada',
              )
            }
            className={cx(buttonClass('secondary'), 'w-full')}
          >
            {category.is_active ? (
              <>
                <Archive className="size-5" />
                Archivar
              </>
            ) : (
              <>
                <ArchiveRestore className="size-5" />
                Restaurar
              </>
            )}
          </button>
          {category.is_active && (
            <p className="text-center text-xs text-stone-500">
              Archivar la oculta al registrar gastos, pero conserva su historial.
            </p>
          )}

          {entries > 0 ? (
            <p className="pt-1 text-center text-xs text-stone-500">
              Tiene {plural(entries, 'gasto registrado', 'gastos registrados')}, por eso no se puede eliminar.
            </p>
          ) : confirmingDelete ? (
            <div className="rounded-2xl bg-red-50 p-3">
              <p className="text-center text-sm font-medium text-red-700">¿Eliminar “{category.name}” para siempre?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} className={buttonClass('secondary')}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => deleteCategory(category.id), 'Categoría eliminada')}
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
              Eliminar categoría
            </button>
          )}
        </div>
      )}
    </form>
  )
}
