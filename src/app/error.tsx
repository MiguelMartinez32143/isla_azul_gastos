'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { buttonClass } from '@/lib/styles'

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl" aria-hidden>
        😕
      </span>
      <h1 className="mt-4 text-xl font-bold">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-stone-500">
        No pudimos cargar la información. Revisa tu conexión a internet e intenta de nuevo.
      </p>
      <p className="mt-3 max-w-sm text-xs text-stone-400">
        Si es la primera vez que usas la app, confirma que ejecutaste el archivo supabase/schema.sql en Supabase.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass()}>
          Intentar de nuevo
        </button>
        <Link href="/" className={buttonClass('secondary')}>
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
