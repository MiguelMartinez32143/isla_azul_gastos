import { CalendarClock, ChevronRight, Download, LogOut, Tags, Truck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/actions/auth'
import { requireUser } from '@/lib/auth'
import { CURRENCY, TIME_ZONE } from '@/lib/config'
import { EXPENSE_SOURCES, EXPENSE_SOURCE_KEYS } from '@/lib/constants'
import { formatMonth, shiftMonth, todayISO } from '@/lib/dates'
import { buttonClass, card, fieldLabel, input, sectionTitle } from '@/lib/styles'
import { cx } from '@/lib/utils'

export const metadata: Metadata = { title: 'Ajustes' }

export default async function SettingsPage() {
  const { email } = await requireUser()
  const currentMonth = todayISO().slice(0, 7)
  const exportMonths = Array.from({ length: 24 }, (_, index) => shiftMonth(currentMonth, -index))

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </header>

      <section>
        <h2 className={sectionTitle}>Tus datos</h2>
        <nav className={cx(card, 'divide-y divide-stone-100 overflow-hidden')}>
          <SettingsLink
            href="/gastos-fijos"
            icon={<CalendarClock className="size-5" />}
            title="Gastos fijos"
            description="Arriendo, servicios, nómina: lo que pagas cada mes"
          />
          <SettingsLink
            href="/proveedores"
            icon={<Truck className="size-5" />}
            title="Proveedores"
            description="Nombres, teléfonos y categoría habitual"
          />
          <SettingsLink
            href="/categorias"
            icon={<Tags className="size-5" />}
            title="Categorías y presupuestos"
            description="Organiza en qué se va el dinero"
          />
        </nav>
      </section>

      <section>
        <h2 className={sectionTitle}>Exportar</h2>
        <form action="/api/exportar" method="get" className={cx(card, 'space-y-4 p-5')}>
          <p className="text-sm text-stone-600">
            Descarga los gastos de un mes en un archivo que abre Excel o Google Sheets. Útil para tu contador.
          </p>
          <div>
            <label htmlFor="export-month" className={fieldLabel}>
              Mes
            </label>
            <select id="export-month" name="mes" defaultValue={currentMonth} className={input}>
              {exportMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="export-source" className={fieldLabel}>
              Qué gastos
            </label>
            <select id="export-source" name="origen" defaultValue="" className={input}>
              <option value="">Todos (caja menor y jefe)</option>
              {EXPENSE_SOURCE_KEYS.map((key) => (
                <option key={key} value={EXPENSE_SOURCES[key].slug}>
                  {EXPENSE_SOURCES[key].emoji} Solo gastos {EXPENSE_SOURCES[key].ofLabel}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={cx(buttonClass('secondary'), 'w-full')}>
            <Download className="size-5" />
            Descargar archivo
          </button>
        </form>
      </section>

      <section>
        <h2 className={sectionTitle}>Instalar en el celular</h2>
        <div className={cx(card, 'space-y-3 p-5 text-sm text-stone-600')}>
          <p>Usa la app como cualquier otra, con su ícono en la pantalla de inicio:</p>
          <p>
            <span className="font-semibold text-stone-800">Android (Chrome):</span> toca el menú ⋮ y luego “Agregar a la
            pantalla principal”.
          </p>
          <p>
            <span className="font-semibold text-stone-800">iPhone (Safari):</span> toca el botón Compartir y luego
            “Agregar a inicio”.
          </p>
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Cuenta</h2>
        <div className={cx(card, 'p-5')}>
          <p className="text-sm text-stone-500">Sesión iniciada como</p>
          <p className="truncate font-medium">{email ?? 'Usuario'}</p>
          <form action={signOut} className="mt-4">
            <button type="submit" className={cx(buttonClass('secondary'), 'w-full')}>
              <LogOut className="size-5" />
              Cerrar sesión
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-stone-400">
            Moneda: {CURRENCY} · Zona horaria: {TIME_ZONE}
          </p>
        </div>
      </section>
    </div>
  )
}

function SettingsLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-stone-50">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-stone-500">{description}</span>
      </span>
      <ChevronRight className="size-5 text-stone-300" />
    </Link>
  )
}
