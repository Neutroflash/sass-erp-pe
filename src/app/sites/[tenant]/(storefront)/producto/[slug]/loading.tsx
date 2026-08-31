export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-8">
      <div className="mb-6 h-4 w-64 rounded bg-zinc-800/50" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square rounded-2xl bg-zinc-800/40" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-24 rounded bg-zinc-800/50" />
          <div className="h-9 w-3/4 rounded bg-zinc-800/60" />
          <div className="h-16 rounded bg-zinc-800/40" />
          <div className="h-14 rounded-lg bg-zinc-800/40" />
          <div className="h-14 rounded-lg bg-zinc-800/40" />
        </div>
      </div>
    </div>
  );
}
