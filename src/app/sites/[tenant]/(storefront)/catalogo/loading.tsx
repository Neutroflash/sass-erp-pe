export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8">
      <div className="mb-6 h-8 w-32 rounded bg-zinc-800/60" />
      <div className="mb-6 h-10 w-full max-w-sm rounded-lg bg-zinc-800/50" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-zinc-800/40" />
        ))}
      </div>
    </div>
  );
}
