import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './env'

const PUBLIC_PATHS = ['/login']
const NO_CACHE_HEADERS = ['cache-control', 'expires', 'pragma']

/** Refresca la sesión de Supabase y protege las páginas privadas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })

  // Valida el token (y lo renueva si está por vencer). No agregues lógica entre createServerClient y esta llamada.
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = Boolean(data?.claims)
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname)

  if (!isLoggedIn && !isPublicPath) return redirectKeepingSession(request, response, '/login')
  if (isLoggedIn && isPublicPath) return redirectKeepingSession(request, response, '/')
  return response
}

function redirectKeepingSession(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''

  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  NO_CACHE_HEADERS.forEach((name) => {
    const value = response.headers.get(name)
    if (value) redirect.headers.set(name, value)
  })
  return redirect
}
