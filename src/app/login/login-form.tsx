'use client'

import { CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useActionState, useState } from 'react'
import { signIn } from '@/actions/auth'
import { buttonClass, card, errorBox, fieldLabel, input, inputBase } from '@/lib/styles'
import { cx } from '@/lib/utils'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, { error: null, email: '' })
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className={cx(card, 'space-y-4 p-6')}>
      <div>
        <label htmlFor="email" className={fieldLabel}>
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          placeholder="tucorreo@ejemplo.com"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className={fieldLabel}>
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={cx(inputBase, 'bg-stone-100 pl-4 pr-12 focus:bg-white')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-200/60"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className={errorBox}>
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={cx(buttonClass(), 'w-full')}>
        {isPending ? (
          <>
            <LoaderCircle className="size-5 animate-spin" />
            Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </button>
    </form>
  )
}
