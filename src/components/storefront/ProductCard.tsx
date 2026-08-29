import Link from "next/link";
import Image from "next/image";
import type { PublicProduct } from "@/domain/inventory/product";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: PublicProduct }) {
  const image = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const minPrice = Math.min(...product.variants.map((v) => v.price));

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md transition-colors hover:border-yellow-500/40"
    >
      <div className="relative aspect-square bg-black/30">
        {image ? (
          <Image src={image.url} alt={image.altText ?? product.name} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">Sin imagen</div>
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded bg-zinc-800 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300">
            Agotado
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        {product.brand && <span className="text-xs text-zinc-500">{product.brand}</span>}
        <span className="font-semibold text-zinc-100">{product.name}</span>
        <span className="font-bold text-yellow-400">{formatPrice(minPrice)}</span>
      </div>
    </Link>
  );
}
