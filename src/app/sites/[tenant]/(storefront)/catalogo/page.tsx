import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { toPublicProduct } from "@/domain/inventory/product";
import { CatalogGrid } from "@/components/storefront/CatalogGrid";
import { CatalogFilters } from "@/components/storefront/CatalogFilters";
import { withTenantRLS } from "@/lib/tenant-rls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Catálogo" };

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

// "nuevo" es un recorte honesto (creado en los últimos 30 días), no un flag que el negocio marca a
// mano — no existe ese campo en el modelo y no queríamos inventar uno solo para esta pill.
const NUEVO_WINDOW_DAYS = 30;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; filter?: string };
}) {
  const tenant = await getCurrentTenant();
  const filter = searchParams.filter === "destacados" || searchParams.filter === "nuevo" ? searchParams.filter : undefined;

  const [products, categories] = await withTenantRLS(prisma, tenant.id, async (tx) => [
    await tx.product.findMany({
      where: {
        tenantId: tenant.id,
        ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
        ...(searchParams.search
          ? { name: { contains: searchParams.search, mode: "insensitive" as const } }
          : {}),
        ...(filter === "destacados" ? { isFeatured: true } : {}),
        ...(filter === "nuevo" ? { createdAt: { gte: new Date(Date.now() - NUEVO_WINDOW_DAYS * 24 * 60 * 60 * 1000) } } : {}),
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    }),
    await tx.category.findMany({
      where: { tenantId: tenant.id },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Catálogo</h1>
      <CatalogFilters
        categories={categories}
        activeCategory={searchParams.category}
        activeFilter={filter}
        activeSearch={searchParams.search}
      />
      {products.length === 0 ? (
        <p className="text-muted-foreground">
          {searchParams.search || searchParams.category || filter ? "Ningún producto coincide con ese filtro." : "Todavía no hay productos publicados."}
        </p>
      ) : (
        <CatalogGrid products={products.map(toPublicProduct)} />
      )}
    </div>
  );
}
