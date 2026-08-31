import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { RECLAMO: "Reclamo", QUEJA: "Queja" };

// OWNER-only, mismo criterio que Configuración — ver el comentario en api/complaints/[id]/route.ts.
export default async function ReclamosPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const complaints = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.complaint.findMany({ where: { tenantId: tenant.id }, orderBy: { folio: "desc" } }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Reclamos</h1>
        <p className="text-sm text-zinc-500">
          Libro de Reclamaciones virtual — la norma da 30 días calendario para responder cada uno.
        </p>
      </div>

      {complaints.length === 0 ? (
        <p className="text-zinc-500">Todavía no llegó ningún reclamo o queja.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Consumidor</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/panel/reclamos/${c.id}`} className="font-medium text-primary hover:underline">
                      N° {c.folio}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{TYPE_LABEL[c.type] ?? c.type}</td>
                  <td className="px-4 py-3 text-zinc-300">{c.consumerName}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.createdAt.toLocaleDateString("es-PE")}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "RESOLVED" ? "success" : "outline"}>
                      {c.status === "RESOLVED" ? "Respondido" : "Pendiente"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
