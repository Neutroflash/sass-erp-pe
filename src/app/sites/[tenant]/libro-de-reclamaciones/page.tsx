import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ComplaintForm } from "@/components/legal/ComplaintForm";

export const metadata: Metadata = { title: "Libro de Reclamaciones" };
export const dynamic = "force-dynamic";

// Fuera de (storefront) a propósito: el Libro de Reclamaciones es obligatorio para cualquier
// negocio que vende a consumidores, incluso uno "solo POS" con publicStorefront desactivado — ver
// el comentario sobre Complaint en schema.prisma.
export default async function LibroDeReclamacionesPage() {
  const tenant = await getCurrentTenant();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <span className="mb-1 block text-xs uppercase tracking-widest text-primary/80">Libro de Reclamaciones</span>
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">{tenant.businessName}</h1>
      <p className="mb-8 text-sm text-zinc-400">
        Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571), este negocio cuenta con un Libro de
        Reclamaciones. Completa el formulario para presentar un reclamo o una queja.
      </p>
      <ComplaintForm businessName={tenant.businessName} />
    </div>
  );
}
