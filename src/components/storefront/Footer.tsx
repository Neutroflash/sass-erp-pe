import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface Props {
  tenantId: string;
  businessName: string;
  izipayEnabled: boolean;
}

// A diferencia del footer de Flashkings, no hay métodos de pago hardcodeados: cada tenant tiene
// los suyos propios (Izipay opcional, o cobro manual Yape/Plin/efectivo fuera de la plataforma) —
// la columna solo aparece si el tenant configuró Izipay de verdad.
export async function Footer({ tenantId, businessName, izipayEnabled }: Props) {
  const categories = await prisma.category.findMany({
    where: { tenantId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return (
    <footer className="mt-24 border-t border-zinc-800/80 bg-black/40">
      <div className={`mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 ${izipayEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <div className="flex flex-col gap-3">
          <span className="text-lg font-bold text-zinc-100">{businessName}</span>
          <p className="text-sm text-zinc-400">Tienda en línea — pedidos, catálogo y atención directa.</p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Categorías</h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-400">
            {categories.length > 0 ? (
              categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/catalogo?category=${category.slug}`} className="hover:text-primary">
                    {category.name}
                  </Link>
                </li>
              ))
            ) : (
              <li>
                <Link href="/catalogo" className="hover:text-primary">
                  Ver catálogo
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Ayuda</h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-400">
            <li>
              <Link href="/catalogo" className="hover:text-primary">
                Catálogo completo
              </Link>
            </li>
          </ul>
        </div>

        {izipayEnabled && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Métodos de pago</h3>
            <div className="flex flex-wrap gap-2">
              {["Tarjeta", "Yape", "Plin"].map((method) => (
                <span
                  key={method}
                  className="rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-300"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} {businessName}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
