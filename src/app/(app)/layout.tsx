import { BottomNav } from '@/components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-[max(0.75rem,env(safe-area-inset-top))]">{children}</main>
      <BottomNav />
    </>
  )
}
