import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/toast'
import { APP_NAME } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Registro y control de los gastos del restaurante.',
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: 'Gastos', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f4',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
