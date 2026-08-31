"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import type { PublicProduct } from "@/domain/inventory/product";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { ProductImage } from "./ProductImage";

// Hasta 3 valores del JSON libre de atributos de la variante principal (ej. { talla: "M", color:
// "Negro" }) para el overlay de specs al hacer hover — mismo patrón que Flashkings.
function getSpecHighlights(product: PublicProduct): string[] {
  const attributes = product.variants[0]?.attributes ?? {};
  return Object.values(attributes)
    .map((value) => String(value))
    .slice(0, 3);
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  const image = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const cheapestVariant = product.variants.reduce((min, v) => (v.price < min.price ? v : min), product.variants[0]);
  const quickAddVariant = product.variants.find((v) => v.inStock);
  const specs = getSpecHighlights(product);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!quickAddVariant) return;

    addItem({
      variantId: quickAddVariant.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: quickAddVariant.name,
      price: quickAddVariant.price,
    });
    setAdded(true);
    openCart();
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-glow">
      <Link href={`/producto/${product.slug}`} className="absolute inset-0 z-10" aria-label={product.name} />

      <div className="relative aspect-square w-full overflow-hidden bg-black/30">
        <ProductImage
          src={image?.url}
          alt={image?.altText ?? product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {!product.inStock && (
          <span className="absolute left-2 top-2 z-20 rounded bg-neutral-800 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300">
            Agotado
          </span>
        )}

        {specs.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {specs.map((spec) => (
              <span
                key={spec}
                className="rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {quickAddVariant && (
          // Gris neutro a propósito, no --primary: el acento de marca se reserva para el precio y
          // los CTAs principales (Ver catálogo, carrito) — este es un botón secundario/rápido.
          <motion.button
            onClick={handleQuickAdd}
            whileTap={{ scale: 0.94 }}
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 translate-y-2 items-center gap-1.5 rounded-full bg-neutral-800/90 px-4 py-2 text-xs font-bold text-white opacity-0 backdrop-blur-sm transition-all duration-300 ease-out hover:bg-neutral-700 group-hover:translate-y-0 group-hover:opacity-100"
            aria-label={`Agregar ${product.name} al carrito`}
          >
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" /> Agregado
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </>
            )}
          </motion.button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand && <span className="text-xs uppercase tracking-wide text-neutral-400">{product.brand}</span>}
        <h3 className="line-clamp-2 font-semibold text-zinc-100">{product.name}</h3>
        <div className="mt-auto pt-2 text-lg font-bold text-primary">{formatPrice(cheapestVariant.price)}</div>
      </div>
    </div>
  );
}
