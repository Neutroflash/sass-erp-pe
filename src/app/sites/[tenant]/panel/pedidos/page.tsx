import { Prisma, OrderStatus, OrderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { STATUS_LABEL } from "@/domain/orders/order-status";
import { DataTable } from "@/components/panel/data-table/data-table";
import { columns, type AdminOrderRow } from "@/components/panel/pedidos/columns";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
const CHANNEL_OPTIONS = [
  { value: "ONLINE", label: "Tienda online" },
  { value: "POS", label: "Punto de venta" },
];

function parseEnumList<T extends string>(raw: string | undefined, valid: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").filter((v): v is T => (valid as readonly string[]).includes(v));
  return values.length > 0 ? values : undefined;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; sort?: string; search?: string; status?: string; channel?: string };
}) {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "orderValidation");

  const page = Math.max(Number(searchParams.page) || 1, 1);
  const pageSize = Number(searchParams.pageSize) || DEFAULT_PAGE_SIZE;
  const [sortId, sortDir] = (searchParams.sort ?? "createdAt.desc").split(".");
  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.OrderOrderByWithRelationInput = sortId === "totalAmount" ? { totalAmount: direction } : { createdAt: direction };
  const statusFilter = parseEnumList(searchParams.status, Object.values(OrderStatus));
  const channelFilter = parseEnumList(searchParams.channel, Object.values(OrderChannel));

  const where: Prisma.OrderWhereInput = {
    tenantId: tenant.id,
    ...(searchParams.search ? { customerName: { contains: searchParams.search, mode: "insensitive" as const } } : {}),
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...(channelFilter ? { channel: { in: channelFilter } } : {}),
  };

  const [orders, total] = await withTenantRLS(prisma, tenant.id, async (tx) => [
    await tx.order.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    await tx.order.count({ where }),
  ]);

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
      <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
      <DataTable
        columns={columns}
        data={rows}
        pageCount={Math.max(Math.ceil(total / pageSize), 1)}
        total={total}
        searchPlaceholder="Buscar por cliente..."
        facets={[
          { columnId: "status", title: "Estado", options: STATUS_OPTIONS },
          { columnId: "channel", title: "Canal", options: CHANNEL_OPTIONS },
        ]}
        emptyMessage="Todavía no hay pedidos."
      />
    </div>
  );
}
