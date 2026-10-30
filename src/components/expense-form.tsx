'use client'

import { CalendarDays, Camera, Images, ListPlus, LoaderCircle, StickyNote, Store, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'
import { deleteExpense, discardReceipt, saveExpense, uploadReceipt } from '@/actions/expenses'
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
import { EXPENSE_SOURCES, PAYMENT_METHODS } from '@/lib/constants'
import { addDays, formatLongDate, formatShortDay, isValidISODate } from '@/lib/dates'
import { amountToRaw, formatMoney, formatTypedAmount } from '@/lib/format'
import { compressImage } from '@/lib/image'
import { MAX_RECEIPT_BYTES } from '@/lib/receipts'
import { buttonClass, errorBox, fieldLabel, input } from '@/lib/styles'
import type { Category, Expense, ExpenseSource, PaymentMethod, RecurringExpense, Supplier } from '@/lib/types'
import { buildHref, cx } from '@/lib/utils'

type SheetName = 'supplier' | 'date' | 'payment' | 'photo' | 'note' | 'delete'
/** Foto ya guardada en Storage, o recién tomada y aún sin subir. */
type Receipt = { kind: 'saved'; path: string; url: string | null } | { kind: 'new'; blob: Blob; previewUrl: string }

type ExpenseFormProps = {
  categories: Category[]
  suppliers: Supplier[]
  today: string
  /** Origen elegido al abrir un gasto nuevo (el último que se usó). */
  defaultSource?: ExpenseSource
  /** Forma de pago sugerida para cada origen. */
  defaultPaymentBySource?: Record<ExpenseSource, PaymentMethod>
  /** Gasto fijo con el que se llena el formulario (?fijo=…). */
  template?: RecurringExpense
  /** Si viene, el formulario edita este gasto. */
  expense?: Expense
  /** URL temporal para ver la foto guardada del gasto que se edita. */
  receiptUrl?: string | null
}

const FALLBACK_PAYMENT_BY_SOURCE: Record<ExpenseSource, PaymentMethod> = { petty_cash: 'cash', manager: 'transfer' }

export function ExpenseForm({
  categories,
  suppliers,
  today,
  defaultSource = 'petty_cash',
  defaultPaymentBySource = FALLBACK_PAYMENT_BY_SOURCE,
  template,
  expense,
  receiptUrl = null,
}: ExpenseFormProps) {
  const router = useRouter()
  const toast = useToast()
  const isEditing = expense !== undefined
  const recurringId = expense?.recurring_id ?? template?.id ?? null

  const [amount, setAmount] = useState(() => {
    if (expense) return amountToRaw(expense.amount)
    return template?.amount ? amountToRaw(template.amount) : ''
  })
  const [source, setSource] = useState<ExpenseSource>(expense?.source ?? template?.source ?? defaultSource)
  const [categoryId, setCategoryId] = useState<string | null>(expense?.category_id ?? template?.category_id ?? null)
  const [pickedCategoryByHand, setPickedCategoryByHand] = useState(isEditing || Boolean(template))
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    expense?.payment_method ?? template?.payment_method ?? defaultPaymentBySource[defaultSource],
  )
  const [pickedPaymentByHand, setPickedPaymentByHand] = useState(isEditing || Boolean(template))
  const [supplier, setSupplier] = useState<SupplierChoice | null>(() => {
    if (expense?.supplier_id) return { id: expense.supplier_id, name: expense.supplier_name ?? 'Proveedor' }
    if (template?.supplier_id) {
      const templateSupplier = suppliers.find((item) => item.id === template.supplier_id)
      return templateSupplier ? { id: templateSupplier.id, name: templateSupplier.name } : null
    }
    return null
  })
  const [description, setDescription] = useState(expense?.description ?? template?.name ?? '')
  const [receipt, setReceipt] = useState<Receipt | null>(
    expense?.receipt_path ? { kind: 'saved', path: expense.receipt_path, url: receiptUrl } : null,
  )
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [openSheet, setOpenSheet] = useState<SheetName | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const amountValue = Number(amount || '0')
  const category = categories.find((item) => item.id === categoryId) ?? null
  const missing = amountValue <= 0 ? 'amount' : category === null ? 'category' : null
  // Solo se marca en rojo lo que falta después de intentar guardar.
  const showMissing = failedAttempts > 0 ? missing : null
  const amountText = formatTypedAmount(amount)
  const originalCategory = expense ? categories.find((item) => item.id === expense.category_id) : undefined
  const receiptPreview = receipt?.kind === 'new' ? receipt.previewUrl : (receipt?.url ?? null)
  const newPreviewUrl = receipt?.kind === 'new' ? receipt.previewUrl : null

  // Libera la memoria de la vista previa cuando se cambia o se quita la foto.
  useEffect(() => {
    if (!newPreviewUrl) return
    return () => URL.revokeObjectURL(newPreviewUrl)
  }, [newPreviewUrl])

  const closeSheet = () => setOpenSheet(null)

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  function pressKey(key: string) {
    setAmount((current) => applyKey(current, key))
  }

  function pickSource(next: ExpenseSource) {
    setSource(next)
    // La caja menor casi siempre se paga en efectivo; solo se ajusta si no se eligió el pago a mano.
    if (!pickedPaymentByHand) setPaymentMethod(defaultPaymentBySource[next])
  }

  function pickCategory(id: string) {
    setCategoryId(id)
    setPickedCategoryByHand(true)
  }

  function pickSupplier(choice: SupplierChoice | null) {
    setSupplier(choice)
    closeSheet()
    if (!choice?.id || pickedCategoryByHand) return
    // Sugiere la categoría habitual del proveedor si aún no se eligió una a mano.
    const suggested = suppliers.find((item) => item.id === choice.id)?.default_category_id
    if (suggested && categories.some((item) => item.id === suggested)) setCategoryId(suggested)
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      const blob = await compressImage(file)
      if (blob.size > MAX_RECEIPT_BYTES) {
        setPhotoError('La foto quedó muy pesada. Intenta con otra.')
        return
      }
      setReceipt({ kind: 'new', blob, previewUrl: URL.createObjectURL(blob) })
    } catch {
      setPhotoError('No pudimos leer esa foto. Intenta tomarla de nuevo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function onPhotoPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite volver a elegir la misma foto si hace falta.
    event.target.value = ''
    void handlePhoto(file)
  }

  function submit() {
    if (isSaving) return
    if (missing !== null || category === null) {
      setFailedAttempts((count) => count + 1)
      return
    }

    const input = {
      id: expense?.id,
      amount: amountValue,
      categoryId: category.id,
      spentOn,
      paymentMethod,
      source,
      description,
      supplierId: supplier?.id ?? null,
      newSupplierName: supplier && !supplier.id ? supplier.name : null,
      recurringId,
    }
    const pendingReceipt = receipt

    startSaving(async () => {
      let uploadedPath: string | null = null
      try {
        let receiptPath = pendingReceipt?.kind === 'saved' ? pendingReceipt.path : null
        if (pendingReceipt?.kind === 'new') {
          const formData = new FormData()
          formData.append('file', pendingReceipt.blob, 'factura.jpg')
          const upload = await uploadReceipt(formData)
          if (!upload.ok) {
            toast.error(upload.error)
            return
          }
          receiptPath = uploadedPath = upload.data.path
        }

        const result = await saveExpense({ ...input, receiptPath })
        if (!result.ok) {
          if (uploadedPath) await discardReceipt(uploadedPath)
          toast.error(result.error)
          return
        }

        toast.success(
          isEditing
            ? 'Cambios guardados'
            : template
              ? `Gasto fijo registrado: ${template.name}`
              : `Gasto de ${formatMoney(amountValue)} guardado · ${EXPENSE_SOURCES[source].label}`,
        )
        if (isEditing) goBack()
        else router.push('/')
      } catch {
        if (uploadedPath) discardReceipt(uploadedPath).catch(() => {})
        toast.error('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
      }
    })
  }

  function removeExpense() {
    if (!expense) return
    setDeleteError(null)
    startDeleting(async () => {
      try {
        const result = await deleteExpense(expense.id)
        if (!result.ok) {
          setDeleteError(result.error)
          return
        }
        closeSheet()
        toast.success('Gasto eliminado')
        goBack()
      } catch {
        setDeleteError('No se pudo eliminar. Revisa tu conexión e intenta de nuevo.')
      }
    })
  }

  // En computador también se puede escribir el monto con el teclado y guardar con Enter.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (openSheet !== null || event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('input, textarea, select')) return

    if (/^\d$/.test(event.key)) pressKey(event.key)
    else if (event.key === 'Backspace') pressKey('back')
    else if (event.key === ',' || event.key === '.') pressKey('.')
    else if (event.key === 'Enter' && !target?.closest('button, a')) submit()
    else return
    event.preventDefault()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const saveLabel =
    missing === 'amount'
      ? 'Escribe el monto'
      : missing === 'category'
        ? 'Elige una categoría'
        : isEditing
          ? 'Guardar cambios'
          : `Guardar ${formatMoney(amountValue)}`

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={goBack}
          aria-label="Cerrar sin guardar"
          className="grid size-12 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100"
        >
          <X className="size-6" />
        </button>
        <h1 className="sr-only">{isEditing ? 'Editar gasto' : 'Nuevo gasto'}</h1>

        {/* Quién hizo el gasto */}
        <SourceToggle value={source} onChange={pickSource} />

        {isEditing ? (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setOpenSheet('delete')
            }}
            aria-label="Eliminar gasto"
            className="grid size-12 place-items-center rounded-full text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="size-5" />
          </button>
        ) : template ? (
          <span className="size-12" aria-hidden />
        ) : (
          <Link
            href={buildHref('/agregar/varios', { fecha: spentOn === today ? null : spentOn })}
            aria-label="Registrar varios gastos de un día"
            className="flex size-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium text-stone-500 transition hover:bg-stone-100"
          >
            <ListPlus className="size-5" />
            Varios
          </Link>
        )}
      </header>

      {/* Monto */}
      <div className="px-5 pt-1 text-center">
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
        <p className={cx('mt-1 h-5 truncate text-sm', showMissing === 'amount' ? 'font-medium text-red-600' : 'text-stone-500')}>
          {showMissing === 'amount'
            ? 'Escribe el monto con el teclado de abajo'
            : template && !isEditing
              ? `📌 Gasto fijo: ${template.name}`
              : category
                ? `${category.icon} ${category.name}${category.hint ? ` · ${category.hint}` : ''}`
                : ''}
        </p>
      </div>

      {/* Categoría */}
      <section className="px-4 pt-3">
        <p
          id="category-label"
          className={cx('mb-2 px-1 text-sm font-medium', showMissing === 'category' ? 'text-red-600' : 'text-stone-500')}
        >
          ¿En qué gastaste?
        </p>
        <CategoryGrid
          key={showMissing === 'category' ? `categories-${failedAttempts}` : 'categories'}
          categories={categories}
          selectedId={categoryId}
          invalid={showMissing === 'category'}
          labelledBy="category-label"
          onPick={pickCategory}
        />
      </section>

      {/* Detalles opcionales */}
      <div className="grid grid-cols-5 gap-1.5 px-4 pt-3">
        <DetailButton
          label="Proveedor"
          value={supplier?.name ?? null}
          active={supplier !== null}
          icon={<Store className="size-5" />}
          onClick={() => setOpenSheet('supplier')}
        />
        <DetailButton
          label="Fecha"
          value={formatShortDay(spentOn, today)}
          active={spentOn !== today}
          icon={<CalendarDays className="size-5" />}
          onClick={() => setOpenSheet('date')}
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
        <DetailButton
          label="Foto"
          value={receipt ? 'Adjunta' : null}
          active={receipt !== null}
          icon={<Camera className="size-5" />}
          onClick={() => {
            setPhotoError(null)
            setOpenSheet('photo')
          }}
        />
        <DetailButton
          label="Nota"
          value={description.trim() || null}
          active={description.trim() !== ''}
          icon={<StickyNote className="size-5" />}
          onClick={() => setOpenSheet('note')}
        />
      </div>

      {/* Teclado numérico */}
      <Keypad onPress={pressKey} />

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={submit}
          disabled={isSaving}
          className={cx(
            'flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition active:scale-[0.98] disabled:opacity-70',
            missing ? 'bg-stone-200 text-stone-500' : 'bg-brand-600 text-white shadow-lg shadow-brand-700/25 hover:bg-brand-700',
          )}
        >
          {isSaving ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              Guardando…
            </>
          ) : (
            saveLabel
          )}
        </button>
      </div>

      <Sheet
        open={openSheet === 'supplier'}
        onClose={closeSheet}
        title="¿A quién le pagaste?"
        description="Busca un proveedor o escribe uno nuevo."
      >
        <SupplierPicker suppliers={suppliers} categories={categories} selected={supplier} onSelect={pickSupplier} />
      </Sheet>

      <Sheet open={openSheet === 'date'} onClose={closeSheet} title="¿Cuándo fue el gasto?">
        <div className="space-y-2">
          {[
            { value: today, label: 'Hoy' },
            { value: addDays(today, -1), label: 'Ayer' },
          ].map((option) => (
            <ChoiceButton
              key={option.value}
              selected={spentOn === option.value}
              onClick={() => {
                setSpentOn(option.value)
                closeSheet()
              }}
            >
              <span className="flex-1">
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-sm text-stone-500">{formatLongDate(option.value)}</span>
              </span>
            </ChoiceButton>
          ))}
          <label className="block pt-3">
            <span className={fieldLabel}>Otra fecha</span>
            <input
              type="date"
              value={spentOn}
              onChange={(event) => {
                if (isValidISODate(event.target.value)) setSpentOn(event.target.value)
              }}
              className={input}
            />
          </label>
          <button type="button" onClick={closeSheet} className={cx(buttonClass(), 'mt-3 w-full')}>
            Listo
          </button>
          {!isEditing && !template && (
            <Link
              href={buildHref('/agregar/varios', { fecha: spentOn })}
              className="flex items-center justify-center gap-2 pt-3 text-sm font-medium text-brand-700 hover:underline"
            >
              <ListPlus className="size-4" />
              ¿Son varios gastos de ese día? Regístralos juntos
            </Link>
          )}
        </div>
      </Sheet>

      <Sheet open={openSheet === 'payment'} onClose={closeSheet} title="¿Cómo pagaste?">
        <PaymentChoices
          value={paymentMethod}
          onPick={(next) => {
            setPaymentMethod(next)
            setPickedPaymentByHand(true)
            closeSheet()
          }}
        />
      </Sheet>

      <Sheet
        open={openSheet === 'photo'}
        onClose={closeSheet}
        title="Foto de la factura"
        description="Guárdala como soporte del gasto. Solo tú puedes verla."
      >
        {receipt &&
          (receiptPreview ? (
            <div className="overflow-hidden rounded-2xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- fotos privadas o recién tomadas: no se pueden optimizar */}
              <img src={receiptPreview} alt="Foto de la factura" className="max-h-[45dvh] w-full object-contain" />
            </div>
          ) : (
            <p className="rounded-2xl bg-stone-50 p-4 text-center text-sm text-stone-500">
              La foto está guardada, pero no se pudo mostrar ahora. Revisa tu conexión.
            </p>
          ))}

        {photoError && (
          <p role="alert" className={cx(errorBox, receipt && 'mt-3')}>
            {photoError}
          </p>
        )}

        <div className={cx('grid gap-2', receipt ? 'mt-4 grid-cols-2' : 'mt-1', photoError && !receipt && 'mt-3')}>
          <label className={cx(buttonClass(receipt ? 'secondary' : 'primary'), 'cursor-pointer', photoBusy && 'pointer-events-none opacity-60')}>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhotoPicked} disabled={photoBusy} />
            <Camera className="size-5" />
            {receipt ? 'Otra foto' : 'Tomar foto'}
          </label>
          <label className={cx(buttonClass('secondary'), 'cursor-pointer', photoBusy && 'pointer-events-none opacity-60')}>
            <input type="file" accept="image/*" className="sr-only" onChange={onPhotoPicked} disabled={photoBusy} />
            <Images className="size-5" />
            {receipt ? 'Galería' : 'Elegir de la galería'}
          </label>
        </div>

        {photoBusy && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-stone-500">
            <LoaderCircle className="size-4 animate-spin" />
            Preparando la foto…
          </p>
        )}

        {receipt && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setReceipt(null)} className={buttonClass('dangerGhost')}>
              <Trash2 className="size-5" />
              Quitar
            </button>
            <button type="button" onClick={closeSheet} className={buttonClass()}>
              Listo
            </button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={openSheet === 'note'}
        onClose={closeSheet}
        title="Nota"
        description="Opcional. Por ejemplo, el número de factura o qué compraste."
      >
        <NoteField value={description} onChange={setDescription} onDone={closeSheet} />
      </Sheet>

      {expense && (
        <Sheet
          open={openSheet === 'delete'}
          onClose={closeSheet}
          title="¿Eliminar este gasto?"
          description="Esta acción no se puede deshacer. También se borra la foto de la factura, si tiene."
        >
          <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
            <CategoryIcon icon={originalCategory?.icon ?? '📋'} color={originalCategory?.color ?? '#a8a29e'} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
              <p className="truncate text-sm text-stone-500">
                {[
                  expense.supplier_name ?? originalCategory?.name,
                  EXPENSE_SOURCES[expense.source].label,
                  formatLongDate(expense.spent_on),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          {deleteError && (
            <p role="alert" className={cx(errorBox, 'mt-3')}>
              {deleteError}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={closeSheet} className={buttonClass('secondary')}>
              Cancelar
            </button>
            <button type="button" onClick={removeExpense} disabled={isDeleting} className={buttonClass('danger')}>
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
