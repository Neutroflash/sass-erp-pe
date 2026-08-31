import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { RespondComplaintForm } from "@/components/panel/RespondComplaintForm";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { RECLAMO: "Reclamo", QUEJA: "Queja" };
const DOC_LABEL: Record<string, string> = { DNI: "DNI", CE: "Carné de extranjería", PASAPORTE: "Pasaporte" };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="block text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{value}</span>
    </div>
  );
}

export default async function ReclamoDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const complaint = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.complaint.findFirst({ where: { id: params.id, tenantId: tenant.id } }),
  );
  if (!complaint) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">
          {TYPE_LABEL[complaint.type] ?? complaint.type} N° {complaint.folio}
        </h1>
        <Badge variant={complaint.status === "RESOLVED" ? "success" : "outline"}>
          {complaint.status === "RESOLVED" ? "Respondido" : "Pendiente"}
        </Badge>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Consumidor</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" value={complaint.consumerName} />
          <Field label="Documento" value={`${DOC_LABEL[complaint.consumerDocType] ?? complaint.consumerDocType} ${complaint.consumerDocNumber}`} />
          <Field label="Dirección" value={complaint.consumerAddress} />
          <Field label="Teléfono" value={complaint.consumerPhone} />
          <Field label="Correo" value={complaint.consumerEmail} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Bien contratado</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Producto/servicio" value={complaint.productDescription} />
          <Field label="Monto reclamado" value={complaint.claimedAmount ? formatPrice(Number(complaint.claimedAmount)) : null} />
          <Field label="Fecha de compra" value={complaint.purchaseDate?.toLocaleDateString("es-PE")} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Detalle</h2>
        <div className="flex flex-col gap-4">
          <div>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Reclamo/queja</span>
            <p className="text-sm text-zinc-300">{complaint.detail}</p>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Pedido concreto</span>
            <p className="text-sm text-zinc-300">{complaint.request}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Respuesta</h2>
        {complaint.status === "RESOLVED" ? (
          <div>
            <p className="text-sm text-zinc-300">{complaint.response}</p>
            <p className="mt-2 text-xs text-zinc-600">Respondido el {complaint.respondedAt?.toLocaleDateString("es-PE")}</p>
          </div>
        ) : (
          <RespondComplaintForm complaintId={complaint.id} />
        )}
      </div>
    </div>
  );
}
