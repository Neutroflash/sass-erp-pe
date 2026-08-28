import { prisma } from "@/lib/prisma";

// Nunca estática: la lista de negocios cambia constantemente y esto es un panel operativo, no
// contenido de marketing — jamás debe servirse cacheado desde el build.
export const dynamic = "force-dynamic";

// Panel del SUPERADMIN de la plataforma (admin.tusaas.pe) — lista todos los negocios registrados.
// Sin guard de auth todavía: ver docs/ROADMAP.md fase 1 (autenticación de PlatformAdmin).
export default async function PlatformTenantsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main>
      <h1>Negocios registrados</h1>
      <ul>
        {tenants.map((tenant) => (
          <li key={tenant.id}>
            {tenant.businessName} — {tenant.slug}.tusaas.pe ({tenant.planTier})
          </li>
        ))}
      </ul>
    </main>
  );
}
