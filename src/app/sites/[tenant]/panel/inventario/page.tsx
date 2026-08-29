import Link from "next/link";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { InventoryTable } from "@/components/panel/InventoryTable";
import { Button } from "@/components/ui/button";
import type { AdminProduct } from "@/types/panel";

export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true, category: true } satisfies Prisma.ProductInclude;

export default async function InventoryPage() {
  const tenant = await getCurrentTenant();
  const rows = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

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
      costPrice: Number(v.costPrice),
      stock: v.stock,
      reservedStock: v.reservedStock,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">Inventario</h1>
        <Link href="/panel/inventario/nuevo">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </Link>
      </div>
      <InventoryTable products={products} />
    </div>
  );
}
