import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { toPublicProduct } from "@/domain/inventory/product";
import { CatalogGrid } from "@/components/storefront/CatalogGrid";
import { CatalogFilters } from "@/components/storefront/CatalogFilters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Catálogo" };

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

export default async function CatalogPage({ searchParams }: { searchParams: { search?: string; category?: string } }) {
  const tenant = await getCurrentTenant();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
        ...(searchParams.search
          ? { name: { contains: searchParams.search, mode: "insensitive" as const } }
          : {}),
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { tenantId: tenant.id },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Catálogo</h1>
      <CatalogFilters categories={categories} activeCategory={searchParams.category} activeSearch={searchParams.search} />
      {products.length === 0 ? (
        <p className="text-zinc-500">
          {searchParams.search || searchParams.category ? "Ningún producto coincide con ese filtro." : "Todavía no hay productos publicados."}
        </p>
      ) : (
        <CatalogGrid products={products.map(toPublicProduct)} />
      )}
    </div>
  );
}
