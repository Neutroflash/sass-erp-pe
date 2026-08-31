import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { withTenantRLS } from "@/lib/tenant-rls";
import { StockMovementForm } from "@/components/panel/StockMovementForm";
import { DataTable } from "@/components/panel/data-table/data-table";
import { columns, TYPE_LABEL, type AdminMovementRow } from "@/components/panel/kardex/columns";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;

const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

function parseEnumList<T extends string>(raw: string | undefined, valid: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").filter((v): v is T => (valid as readonly string[]).includes(v));
  return values.length > 0 ? values : undefined;
}

export default async function KardexPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; sort?: string; search?: string; type?: string };
}) {
  const tenant = await getCurrentTenant();

  const page = Math.max(Number(searchParams.page) || 1, 1);
  const pageSize = Number(searchParams.pageSize) || DEFAULT_PAGE_SIZE;
  const [sortId, sortDir] = (searchParams.sort ?? "createdAt.desc").split(".");
  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.StockMovementOrderByWithRelationInput = sortId === "quantity" ? { quantity: direction } : { createdAt: direction };
  const typeFilter = parseEnumList(searchParams.type, Object.values(StockMovementType));

  const where: Prisma.StockMovementWhereInput = {
    tenantId: tenant.id,
    ...(typeFilter ? { type: { in: typeFilter } } : {}),
    ...(searchParams.search
      ? {
          OR: [
            { variant: { sku: { contains: searchParams.search, mode: "insensitive" as const } } },
            { variant: { name: { contains: searchParams.search, mode: "insensitive" as const } } },
            { variant: { product: { name: { contains: searchParams.search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [variants, movements, total] = await withTenantRLS(prisma, tenant.id, async (tx) => [
    await tx.productVariant.findMany({
      where: { tenantId: tenant.id },
      include: { product: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    await tx.stockMovement.findMany({
      where,
      include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } }, createdBy: { select: { name: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    await tx.stockMovement.count({ where }),
  ]);

  const rows: AdminMovementRow[] = movements.map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    quantity: m.quantity,
    reason: m.reason,
    productName: m.variant.product.name,
    variantName: m.variant.name,
    sku: m.variant.sku,
    createdByName: m.createdBy.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Kardex</h1>

      <StockMovementForm variants={variants.map((v) => ({ ...v, price: 0, costPrice: 0, productName: v.product.name }))} />

      <DataTable
        columns={columns}
        data={rows}
        pageCount={Math.max(Math.ceil(total / pageSize), 1)}
        total={total}
        searchPlaceholder="Buscar por producto o SKU..."
        facets={[{ columnId: "type", title: "Tipo", options: TYPE_OPTIONS }]}
        emptyMessage="Todavía no hay movimientos de stock."
      />
    </div>
  );
}
