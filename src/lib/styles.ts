// Clases compartidas para que botones, tarjetas y campos se vean igual en toda la app.

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60'

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dangerGhost: 'text-red-600 hover:bg-red-50',
}

const BUTTON_SIZES = {
  md: 'h-12 px-5 text-base',
  sm: 'h-10 px-4 text-sm',
}

export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = 'primary',
  size: keyof typeof BUTTON_SIZES = 'md',
): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`
}

export const card = 'rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/70'

/** Base de los campos de texto, sin fondo ni padding horizontal para poder personalizarlos. */
export const inputBase =
  'block h-12 w-full rounded-xl border-0 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500'

export const input = `${inputBase} bg-stone-100 px-4 focus:bg-white`

export const textarea =
  'block w-full resize-none rounded-xl border-0 bg-stone-100 px-4 py-3 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-brand-500'

export const fieldLabel = 'mb-1.5 block text-sm font-medium text-stone-700'

export const fieldHelp = 'mt-1.5 text-xs text-stone-500'

export const sectionTitle = 'px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500'

export const errorBox = 'flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700'
