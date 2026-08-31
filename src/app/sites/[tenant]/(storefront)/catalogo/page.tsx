import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requirePublicStorefront } from "@/lib/feature-guards";
import { toPublicProduct } from "@/domain/inventory/product";
import { CatalogGrid } from "@/components/storefront/CatalogGrid";

export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

export default async function CatalogPage({ searchParams }: { searchParams: { search?: string; category?: string } }) {
  const tenant = await getCurrentTenant();
  await requirePublicStorefront(tenant.id);

  const products = await prisma.product.findMany({
    where: {
      tenantId: tenant.id,
      ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
      ...(searchParams.search
        ? { name: { contains: searchParams.search, mode: "insensitive" as const } }
        : {}),
    },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Catálogo</h1>
      {products.length === 0 ? (
        <p className="text-zinc-500">Todavía no hay productos publicados.</p>
      ) : (
        <CatalogGrid products={products.map(toPublicProduct)} />
      )}
    </div>
  );
}
