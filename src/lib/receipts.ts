import type { SupabaseServerClient } from './supabase/server'

export const RECEIPTS_BUCKET = 'receipts'

/** Peso máximo de una foto ya comprimida. */
export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024

/** Formatos permitidos y la extensión con la que se guardan. */
export const RECEIPT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Las fotos se guardan como "<id del usuario>/<uuid>.<ext>": las políticas de Storage
 * solo dejan a cada usuario ver y borrar lo que está en su propia carpeta.
 */
export function isOwnReceiptPath(path: unknown, userId: string): path is string {
  return typeof path === 'string' && new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)
}

/** URL temporal (1 hora) para ver una foto privada. */
export async function getReceiptUrl(supabase: SupabaseServerClient, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}
