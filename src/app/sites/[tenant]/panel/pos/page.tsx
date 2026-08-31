import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { PosTerminal, type PosVariant } from "@/components/panel/PosTerminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "posWeb");

  const variants = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.productVariant.findMany({
      where: { tenantId: tenant.id },
      include: { product: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  );

  const rows: PosVariant[] = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    productName: v.product.name,
    price: Number(v.price),
    stock: v.stock,
    reservedStock: v.reservedStock,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Punto de venta</h1>
      <PosTerminal variants={rows} />
    </div>
  );
}
