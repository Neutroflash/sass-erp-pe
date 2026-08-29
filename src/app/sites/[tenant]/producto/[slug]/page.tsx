import { notFound } from "next/navigation";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { toPublicProduct } from "@/domain/inventory/product";
import { formatPrice } from "@/lib/utils";
import { AddToCartButton } from "@/components/storefront/AddToCartButton";

export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const tenant = await getCurrentTenant();
  const row = await prisma.product.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: params.slug } },
    include: productInclude,
  });
  if (!row) notFound();

  const product = toPublicProduct(row);
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/30">
        {primaryImage ? (
          <Image src={primaryImage.url} alt={primaryImage.altText ?? product.name} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">Sin imagen</div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {product.brand && <span className="text-sm text-zinc-500">{product.brand}</span>}
        <h1 className="text-3xl font-bold text-zinc-100">{product.name}</h1>
        {product.description && <p className="text-sm text-zinc-400">{product.description}</p>}

        <div className="flex flex-col gap-2">
          {product.variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-4 py-3"
            >
              <span className="text-sm text-zinc-200">{variant.name}</span>
              <div className="flex items-center gap-3">
                <span className="font-bold text-yellow-400">{formatPrice(variant.price)}</span>
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
      </div>
    </div>
  );
}
