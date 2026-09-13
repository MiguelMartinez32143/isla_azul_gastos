export default function Loading() {
  return (
    <div className="flex min-h-dvh animate-pulse flex-col bg-white px-4 pb-6 pt-16" aria-busy="true" aria-label="Cargando">
      <div className="mx-auto h-12 w-40 rounded-xl bg-stone-100" />
      <div className="mt-10 grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="h-[4.25rem] rounded-2xl bg-stone-100" />
        ))}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="h-12 rounded-2xl bg-stone-100" />
        ))}
      </div>
    </div>
  )
}
