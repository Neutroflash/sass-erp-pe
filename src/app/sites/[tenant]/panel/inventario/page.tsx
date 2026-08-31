import Link from "next/link";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { InventoryDataTable } from "@/components/panel/inventario/InventoryDataTable";
import { Button } from "@/components/ui/button";
import type { AdminProduct } from "@/types/panel";

export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true, category: true } satisfies Prisma.ProductInclude;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; sort?: string; search?: string; category?: string };
}) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  const canSeeCost = user?.role === "OWNER";

  const page = Math.max(Number(searchParams.page) || 1, 1);
  const pageSize = Number(searchParams.pageSize) || DEFAULT_PAGE_SIZE;
  const [sortId, sortDir] = (searchParams.sort ?? "name.asc").split(".");
  const direction: Prisma.SortOrder = sortDir === "desc" ? "desc" : "asc";
  const orderBy: Prisma.ProductOrderByWithRelationInput = sortId === "createdAt" ? { createdAt: direction } : { name: direction };
  const categoryIds = searchParams.category?.split(",").filter(Boolean);

  const where: Prisma.ProductWhereInput = {
    tenantId: tenant.id,
    ...(categoryIds && categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
    ...(searchParams.search
      ? {
          OR: [
            { name: { contains: searchParams.search, mode: "insensitive" as const } },
            { brand: { contains: searchParams.search, mode: "insensitive" as const } },
            { variants: { some: { sku: { contains: searchParams.search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [rows, total, categories] = await withTenantRLS(prisma, tenant.id, async (tx) => [
    await tx.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    await tx.product.count({ where }),
    await tx.category.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
  ]);

  // costPrice ni siquiera se manda al cliente si no es OWNER — no es solo "ocultar la columna",
  // ver el comentario en columns.tsx sobre por qué (Fase 4, roles más finos).
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
        <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
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
      <InventoryDataTable
        products={products}
        categories={categories}
        canSeeCost={canSeeCost}
        lowStockThreshold={tenant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD}
        pageCount={Math.max(Math.ceil(total / pageSize), 1)}
        total={total}
      />
    </div>
  );
}
