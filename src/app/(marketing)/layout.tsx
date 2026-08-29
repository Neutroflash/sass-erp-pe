import Link from "next/link";
import { Button } from "@/components/ui/button";

// Header compartido de tusaas.pe/tusaas.pe/precios — no confundir con panel/layout.tsx (ese
// guarda el panel de UN tenant); acá no hay sesión que verificar, es contenido público.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-zinc-100">
            Tu<span className="text-yellow-400">SaaS</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/precios" className="text-sm text-zinc-400 hover:text-zinc-100">
              Precios
            </Link>
            <Link href="/registro">
              <Button size="sm">Crear mi tienda</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
