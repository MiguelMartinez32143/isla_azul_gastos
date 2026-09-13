'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

type SheetProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

/**
 * Hoja que sube desde abajo en el celular (y un diálogo centrado en pantallas grandes).
 * El contenido solo se monta mientras está abierta, así cada apertura empieza limpia.
 * Un elemento con `data-autofocus` recibe el foco al abrir.
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // Tocar el fondo oscuro cierra la hoja.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </>
      )}
    </dialog>
  )
}
