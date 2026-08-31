import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { withTenantRLS } from "@/lib/tenant-rls";
import { buildTicketComprobanteData } from "@/domain/invoicing/ticket-data";
import { TicketComprobante } from "@/components/panel/TicketComprobante";
import { TicketActions } from "@/components/panel/TicketActions";

export const dynamic = "force-dynamic";

export default async function OrderTicketPage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const order = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.order.findFirst({ where: { id: params.id, tenantId: tenant.id }, include: { invoice: true } }),
  );
  if (!order?.invoice) notFound();

  const data = await buildTicketComprobanteData(prisma, tenant.id, order.invoice.id);
  if (!data) notFound();

  const fileName = `${data.comprobante.serie}-${String(data.comprobante.numero).padStart(8, "0")}`;

  return (
    <div className="flex flex-col items-center gap-4 py-4 print:gap-0 print:py-0">
      <div className="w-full max-w-md print:hidden">
        <Link href={`/panel/pedidos/${params.id}`} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Volver al pedido
        </Link>
      </div>
      <TicketComprobante data={data} />
      <TicketActions targetId="ticket-comprobante" fileName={fileName} />
    </div>
  );
}
