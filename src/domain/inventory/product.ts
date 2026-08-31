import type { Product, ProductImage, ProductVariant } from "@prisma/client";

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

/** Mirrors la vista pública: sin costPrice, sin reservedStock exacto — solo si hay stock o no. */
export interface PublicVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  inStock: boolean;
  attributes: Record<string, unknown>;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  isFeatured: boolean;
  createdAt: Date;
  images: ProductImage[];
  variants: PublicVariant[];
  inStock: boolean;
}

export function toPublicVariant(variant: ProductVariant): PublicVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    price: Number(variant.price),
    inStock: variant.stock - variant.reservedStock > 0,
    attributes: variant.attributes as Record<string, unknown>,
  };
}

/**
 * Sanitiza un producto para consumidores no-admin (tienda pública, cliente final) — nunca expone
 * costPrice ni el conteo exacto de reservedStock, solo "hay stock o no". Usar SIEMPRE que la
 * respuesta pueda llegar a alguien que no sea OWNER/SELLER del tenant dueño del producto.
 */
export function toPublicProduct(product: ProductWithRelations): PublicProduct {
  const variants = product.variants.map(toPublicVariant);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    isFeatured: product.isFeatured,
    createdAt: product.createdAt,
    images: product.images,
    variants,
    inStock: variants.some((v) => v.inStock),
  };
}
