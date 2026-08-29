import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { OrdersTable, type AdminOrderRow } from "@/components/panel/OrdersTable";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "orderValidation");

  const orders = await prisma.order.findMany({
    where: { tenantId: tenant.id },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows: AdminOrderRow[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    channel: o.channel,
    totalAmount: Number(o.totalAmount),
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    createdAt: o.createdAt.toISOString(),
    itemCount: o._count.items,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Pedidos</h1>
      <OrdersTable orders={rows} />
    </div>
  );
}
