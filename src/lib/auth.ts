import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

/** Cliente de Supabase con la sesión actual. Si no hay sesión, manda a /login. */
export async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/login')

  const { sub, email } = data.claims
  return { supabase, userId: sub, email: typeof email === 'string' ? email : null }
}
