import Link from 'next/link'
import { buttonClass } from '@/lib/styles'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl" aria-hidden>
        🤔
      </span>
      <h1 className="mt-4 text-xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 max-w-sm text-stone-500">Puede que el gasto se haya eliminado o que el enlace esté mal escrito.</p>
      <Link href="/" className={`${buttonClass()} mt-6`}>
        Volver al inicio
      </Link>
    </main>
  )
}
