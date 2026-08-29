import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

// Nunca estática: la lista de negocios cambia constantemente y esto es un panel operativo, no
// contenido de marketing — jamás debe servirse cacheado desde el build.
export const dynamic = "force-dynamic";

// Panel del SUPERADMIN de la plataforma (admin.tusaas.pe) — lista todos los negocios registrados.
export default async function PlatformTenantsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-zinc-100">Negocios registrados</h2>

      {tenants.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay negocios registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-3">Negocio</th>
                <th className="p-3">Subdominio</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-zinc-800/60">
                  <td className="p-3 text-sm text-zinc-100">{tenant.businessName}</td>
                  <td className="p-3 text-sm">
                    <Link
                      href={`https://${tenant.slug}.tusaas.pe`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-400 hover:underline"
                    >
                      {tenant.slug}.tusaas.pe
                    </Link>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{tenant.planTier}</Badge>
                  </td>
                  <td className="p-3 text-sm text-zinc-500">{new Date(tenant.createdAt).toLocaleDateString("es-PE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
