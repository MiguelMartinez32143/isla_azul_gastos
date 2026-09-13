'use client'

import { House, type LucideIcon, Plus, ReceiptText, Settings, Tags } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: LucideIcon; matches: (pathname: string) => boolean }

const LEFT_ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio', icon: House, matches: (pathname) => pathname === '/' },
  { href: '/historial', label: 'Historial', icon: ReceiptText, matches: (pathname) => pathname.startsWith('/historial') },
]

const RIGHT_ITEMS: NavItem[] = [
  { href: '/categorias', label: 'Categorías', icon: Tags, matches: (pathname) => pathname.startsWith('/categorias') },
  {
    href: '/ajustes',
    label: 'Ajustes',
    icon: Settings,
    matches: (pathname) => ['/ajustes', '/proveedores', '/gastos-fijos'].some((prefix) => pathname.startsWith(prefix)),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Menú principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {LEFT_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={item.matches(pathname)} />
        ))}
        <Link
          href="/agregar"
          className="flex flex-col items-center justify-end gap-1 pb-2 text-xs font-medium text-stone-600"
        >
          <span className="-mt-5 grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-700/30 ring-4 ring-white transition active:scale-95">
            <Plus className="size-7" strokeWidth={2.5} />
          </span>
          Agregar
        </Link>
        {RIGHT_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={item.matches(pathname)} />
        ))}
      </div>
    </nav>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex flex-col items-center justify-end gap-1 pb-2 pt-2.5 text-xs transition',
        active ? 'font-semibold text-brand-700' : 'text-stone-500 hover:text-stone-800',
      )}
    >
      <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
      {item.label}
    </Link>
  )
}
