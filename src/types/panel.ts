export interface AdminProductVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  reservedStock: number;
  /** Catálogo 03 de SUNAT: la tabla muestra "12.5 m", no "12.5". */
  unitCode: string;
}

export interface AdminProductImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  isFeatured: boolean;
  category?: { id: string; name: string; slug: string } | null;
  images: AdminProductImage[];
  variants: AdminProductVariant[];
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
}
