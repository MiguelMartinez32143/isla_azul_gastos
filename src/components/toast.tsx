'use client'

import { Check, CircleAlert } from 'lucide-react'
import { createContext, use, useEffect, useMemo, useState } from 'react'
import { cx } from '@/lib/utils'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
type ToastApi = { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => setToast({ id: Date.now(), message, tone: 'success' }),
      error: (message) => setToast({ id: Date.now(), message, tone: 'error' }),
    }),
    [],
  )

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'flex max-w-sm animate-toast-in items-center gap-3 rounded-2xl py-3 pl-3 pr-4 text-sm font-medium text-white shadow-lg',
              toast.tone === 'success' ? 'bg-stone-900' : 'bg-red-600',
            )}
          >
            <span
              className={cx(
                'grid size-6 shrink-0 place-items-center rounded-full',
                toast.tone === 'success' ? 'bg-brand-500' : 'bg-white/25',
              )}
            >
              {toast.tone === 'success' ? <Check className="size-4" strokeWidth={3} /> : <CircleAlert className="size-4" />}
            </span>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const context = use(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
