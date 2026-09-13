'use client'

import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import { deleteSupplier, saveSupplier } from '@/actions/suppliers'
import { CategoryIcon } from '@/components/category-icon'
import { EmptyState } from '@/components/empty-state'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { normalizeText } from '@/lib/format'
import { buttonClass, card, errorBox, fieldHelp, fieldLabel, input, inputBase, textarea } from '@/lib/styles'
import type { ActionResult, Category, Supplier } from '@/lib/types'
import { cx } from '@/lib/utils'

export function SupplierManager({ suppliers, categories }: { suppliers: Supplier[]; categories: Category[] }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const normalizedQuery = normalizeText(query)
  const filtered = normalizedQuery
    ? suppliers.filter((item) => normalizeText(`${item.name} ${item.phone ?? ''}`).includes(normalizedQuery))
    : suppliers

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
            <h1 className="text-2xl font-bold">Proveedores</h1>
            <p className="text-sm text-stone-500">También puedes crearlos al registrar un gasto.</p>
          </div>
          <button type="button" onClick={() => setEditing('new')} className={cx(buttonClass('primary', 'sm'), 'shrink-0')}>
            <Plus className="size-5" />
            Nuevo
          </button>
        </div>
      </header>

      {suppliers.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proveedor"
            aria-label="Buscar proveedor"
            className={cx(inputBase, 'bg-white pl-11 pr-4 shadow-sm ring-1 ring-stone-200')}
          />
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          emoji="🚚"
          title="Aún no tienes proveedores"
          description="Agrégalos aquí o escribe el nombre cuando registres un gasto."
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">No hay proveedores que coincidan con “{query}”.</p>
      ) : (
        <ul className={cx(card, 'divide-y divide-stone-100 overflow-hidden')}>
          {filtered.map((supplier) => {
            const category = supplier.default_category_id ? categoryById.get(supplier.default_category_id) : undefined
            return (
              <li key={supplier.id}>
                <button
                  type="button"
                  onClick={() => setEditing(supplier)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
                >
                  <CategoryIcon icon={category?.icon ?? '🏪'} color={category?.color ?? '#a8a29e'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{supplier.name}</span>
                    <span className="block truncate text-sm text-stone-500">
                      {[category?.name, supplier.phone].filter(Boolean).join(' · ') || 'Sin categoría habitual'}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-stone-300" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo proveedor' : 'Editar proveedor'}
      >
        {editing !== null && (
          <SupplierEditor
            supplier={editing === 'new' ? null : editing}
            categories={categories}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function SupplierEditor({
  supplier,
  categories,
  onDone,
}: {
  supplier: Supplier | null
  categories: Category[]
  onDone: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(supplier?.name ?? '')
  const [categoryId, setCategoryId] = useState(supplier?.default_category_id ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectableCategories = categories.filter((item) => item.is_active || item.id === supplier?.default_category_id)

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
      () => saveSupplier({ id: supplier?.id, name, defaultCategoryId: categoryId || null, phone, notes }),
      supplier ? 'Proveedor actualizado' : 'Proveedor creado',
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="supplier-name" className={fieldLabel}>
          Nombre
        </label>
        <input
          id="supplier-name"
          data-autofocus={supplier ? undefined : true}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          autoComplete="off"
          placeholder="Ej: Carnes El Buen Corte"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="supplier-category" className={fieldLabel}>
          Categoría habitual
        </label>
        <select
          id="supplier-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={input}
        >
          <option value="">Sin categoría habitual</option>
          {selectableCategories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.icon} {item.name}
            </option>
          ))}
        </select>
        <p className={fieldHelp}>Se elige sola cuando registras un gasto de este proveedor.</p>
      </div>

      <div>
        <label htmlFor="supplier-phone" className={fieldLabel}>
          Teléfono <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="supplier-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          maxLength={30}
          autoComplete="off"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="supplier-notes" className={fieldLabel}>
          Notas <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <textarea
          id="supplier-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Ej: entrega martes y viernes"
          className={textarea}
        />
      </div>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={cx(buttonClass(), 'w-full')}>
        {isPending ? 'Guardando…' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
      </button>

      {supplier &&
        (confirmingDelete ? (
          <div className="rounded-2xl bg-red-50 p-3">
            <p className="text-center text-sm font-medium text-red-700">¿Eliminar “{supplier.name}”?</p>
            <p className="mt-1 text-center text-xs text-red-700/80">
              Sus gastos se conservan, pero quedarán sin proveedor.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} className={buttonClass('secondary')}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => deleteSupplier(supplier.id), 'Proveedor eliminado')}
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
            Eliminar proveedor
          </button>
        ))}
    </form>
  )
}
