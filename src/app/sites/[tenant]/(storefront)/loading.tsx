// Streaming placeholder mientras el Server Component de page.tsx resuelve sus queries — antes de
// esto, una conexión lenta mostraba una pantalla en blanco hasta que TODO (Hero + destacados)
// terminaba de cargar.
export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4">
      <div className="flex flex-col items-center gap-6 py-16 sm:py-20">
        <div className="h-6 w-32 rounded-full bg-zinc-800/60" />
        <div className="h-12 w-2/3 max-w-lg rounded-lg bg-zinc-800/60" />
        <div className="h-4 w-1/2 max-w-md rounded bg-zinc-800/60" />
        <div className="h-12 w-40 rounded-full bg-zinc-800/60" />
      </div>
      <div className="grid grid-cols-2 gap-4 pb-16 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-zinc-800/40" />
        ))}
      </div>
    </div>
  );
}
