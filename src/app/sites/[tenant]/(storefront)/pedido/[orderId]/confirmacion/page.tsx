import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { withTenantRLS } from "@/lib/tenant-rls";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatQty, lineTotal, toQty } from "@/domain/inventory/quantity";
import { unitShort } from "@/domain/inventory/units";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export default async function OrderConfirmationPage({ params }: { params: { orderId: string } }) {
  const tenant = await getCurrentTenant();
  const order = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.order.findFirst({
      where: { id: params.orderId, tenantId: tenant.id },
      include: { items: { include: { variant: { select: { sku: true, name: true, unitCode: true } } } } },
    }),
  );
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pedido recibido</h1>
        <Badge variant={order.status === "PAID" ? "success" : order.status === "CANCELLED" ? "destructive" : "outline"}>
          {STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Guarda este enlace para consultar el estado de tu pedido. Un asesor confirmará tu pago (Yape/Plin/efectivo) a la
        brevedad.
      </p>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm text-foreground/90">
            <span>
              {item.variant.name} <span className="text-muted-foreground">({item.variant.sku})</span> x{formatQty(item.quantity)}{" "}
              <span className="text-muted-foreground">{unitShort(item.variant.unitCode)}</span>
            </span>
            <span>{formatPrice(lineTotal(item.quantity, item.price))}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-foreground">
          <span>Total</span>
          <span className="text-primary">{formatPrice(Number(order.totalAmount))}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground/70">Pedido #{order.id}</p>
    </div>
  );
}
