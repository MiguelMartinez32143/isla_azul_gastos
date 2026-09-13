// Ajustes regionales. Se cambian con variables de entorno (ver .env.example).

function readDecimals(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3 ? parsed : 0
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Gastos del Restaurante'
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE || 'es-CO'
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'COP'
export const CURRENCY_DECIMALS = readDecimals(process.env.NEXT_PUBLIC_CURRENCY_DECIMALS)
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'America/Bogota'
