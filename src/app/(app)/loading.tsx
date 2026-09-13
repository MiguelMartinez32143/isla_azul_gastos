export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 pt-2" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-stone-200" />
        <div className="h-7 w-48 rounded-lg bg-stone-200" />
      </div>
      <div className="h-14 rounded-2xl bg-stone-200" />
      <div className="h-40 rounded-3xl bg-stone-200" />
      <div className="h-72 rounded-3xl bg-stone-200" />
    </div>
  )
}
