'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SignInState = { error: string | null; email: string }

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Escribe tu correo y tu contraseña.', email }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const message =
      error.code === 'invalid_credentials'
        ? 'El correo o la contraseña no son correctos.'
        : error.code === 'email_not_confirmed'
          ? 'Este correo aún no está confirmado en Supabase.'
          : 'No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.'
    return { error: message, email }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
