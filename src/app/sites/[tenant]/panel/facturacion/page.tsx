import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";

export const dynamic = "force-dynamic";

// Ejemplo concreto de requireFeature(): para el Cliente Piloto (sunatInvoicing: false), visitar
// esta URL a mano — sin pasar por el Sidebar, que ni siquiera muestra el link — redirige a
// /panel en vez de renderizar nada de esto. Ver docs/ROADMAP.md Fase 3 para la implementación real
// (hoy es solo el punto donde se engancha el guard).
export default async function FacturacionPage() {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "sunatInvoicing");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-100">Facturación SUNAT</h1>
      <p className="text-sm text-zinc-400">Módulo pendiente de implementación — ver Fase 3 del roadmap.</p>
    </div>
  );
}
