export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Agrega transparencia a un color hex: ("#ef4444", 0.16) → "#ef444429". */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

/** Arma una URL solo con los parámetros que tienen valor: ("/historial", { mes: "2026-09" }) → "/historial?mes=2026-09". */
export function buildHref(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function success<T = null>(data: T = null as T): { ok: true; data: T } {
  return { ok: true, data }
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}
