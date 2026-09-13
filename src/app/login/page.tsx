import { ReceiptText } from 'lucide-react'
import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/config'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-700 text-white shadow-lg shadow-brand-700/30">
            <ReceiptText className="size-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{APP_NAME}</h1>
          <p className="mt-1 text-stone-500">Inicia sesión para registrar tus gastos.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
