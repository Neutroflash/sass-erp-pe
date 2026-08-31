import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { withTenantRLS } from "@/lib/tenant-rls";
import { toPublicProduct } from "@/domain/inventory/product";
import { formatPrice } from "@/lib/utils";
import { AddToCartButton } from "@/components/storefront/AddToCartButton";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { FadeIn } from "@/components/storefront/FadeIn";
import { CatalogGrid } from "@/components/storefront/CatalogGrid";

export const dynamic = "force-dynamic";

const productInclude = {
  variants: true,
  images: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const product = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: params.slug } },
      select: { name: true, description: true },
    }),
  );
  if (!product) return {};
  return { title: product.name, description: product.description ?? undefined };
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const tenant = await getCurrentTenant();
  const row = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: params.slug } },
      include: productInclude,
    }),
  );
  if (!row) notFound();

  const product = toPublicProduct(row);

  // Mismo categoryId primero (más relevante para el cliente); si el producto no tiene categoría,
  // o esa categoría no tiene más productos, se completa con lo más reciente del negocio.
  const relatedRows = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findMany({
      where: {
        tenantId: tenant.id,
        id: { not: row.id },
        ...(row.categoryId ? { categoryId: row.categoryId } : {}),
      },
      include: { variants: true, images: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Catálogo", href: "/catalogo" },
          ...(row.category ? [{ label: row.category.name, href: `/catalogo?category=${row.category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <FadeIn>
          <ProductGallery images={product.images} productName={product.name} />
        </FadeIn>

        <FadeIn delay={0.1} className="flex flex-col gap-4">
          {product.brand && <span className="text-sm text-muted-foreground">{product.brand}</span>}
          <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

          <div className="flex flex-col gap-2">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-3"
              >
                <span className="text-sm text-foreground">{variant.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary">{formatPrice(variant.price)}</span>
                  <AddToCartButton
                    variantId={variant.id}
                    productSlug={product.slug}
                    productName={product.name}
                    variantName={variant.name}
                    price={variant.price}
                    inStock={variant.inStock}
                  />
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      {relatedRows.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold text-foreground">También te puede interesar</h2>
          <CatalogGrid products={relatedRows.map(toPublicProduct)} />
        </section>
      )}
    </div>
  );
}
