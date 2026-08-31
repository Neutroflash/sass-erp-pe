import Link from "next/link";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { InventoryTable } from "@/components/panel/InventoryTable";
import { Button } from "@/components/ui/button";
import type { AdminProduct } from "@/types/panel";

export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true, category: true } satisfies Prisma.ProductInclude;

export default async function InventoryPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  const canSeeCost = user?.role === "OWNER";

  const rows = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findMany({
      where: { tenantId: tenant.id },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    }),
  );

  // costPrice ni siquiera se manda al cliente si no es OWNER — no es solo "ocultar la columna",
  // ver el comentario en InventoryTable.tsx sobre por qué (Fase 4, roles más finos).
  const products: AdminProduct[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    isFeatured: p.isFeatured,
    category: p.category,
    images: p.images,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: Number(v.price),
      costPrice: canSeeCost ? Number(v.costPrice) : 0,
      stock: v.stock,
      reservedStock: v.reservedStock,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">Inventario</h1>
        {/* Crear un producto fija su costo inicial — decisión de OWNER, ver POST /api/products. */}
        {canSeeCost && (
          <Link href="/panel/inventario/nuevo">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </Link>
        )}
      </div>
      <InventoryTable products={products} canSeeCost={canSeeCost} />
    </div>
  );
}
