// Client-safe: mismo origen que el panel (ver la nota sobre por qué las rutas de API de un tenant
// viven bajo /sites/[tenant]/api/**, en MULTI_TENANT_ARCHITECTURE.md) — a diferencia de
// Flashkings, acá no hay backend en otro dominio, así que no hace falta ninguna URL base ni
// credentials:include explícito (mismo origen ya envía cookies).

export interface CreateProductVariantInput {
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  attributes?: Record<string, string>;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  brand?: string;
  categoryId?: string;
  isFeatured?: boolean;
  variants: CreateProductVariantInput[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "No se pudo completar la solicitud");
  }
  return body;
}

export function createCategory(name: string) {
  return request<{ category: { id: string; name: string; slug: string } }>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function createProduct(data: CreateProductInput) {
  return request<{ product: { id: string; slug: string } }>("/api/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(productId: string, data: Partial<CreateProductInput>) {
  return request(`/api/products/${productId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function updateVariant(variantId: string, data: { price?: number; costPrice?: number; stock?: number }) {
  return request(`/api/products/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export interface ProductImageInput {
  url: string;
  altText?: string;
  isPrimary?: boolean;
}

export function addProductImage(productId: string, data: ProductImageInput) {
  return request(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify(data) });
}

export function updateProductImage(imageId: string, data: Partial<ProductImageInput>) {
  return request(`/api/products/images/${imageId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteProductImage(imageId: string) {
  return fetch(`/api/products/images/${imageId}`, { method: "DELETE" });
}

export type StockMovementInput =
  | { type: "IN" | "OUT"; variantId: string; quantity: number; reason?: string }
  | { type: "ADJUSTMENT"; variantId: string; newStock: number; reason?: string };

export function createStockMovement(data: StockMovementInput) {
  return request("/api/stock-movements", { method: "POST", body: JSON.stringify(data) });
}

export interface PosSaleInput {
  customerName?: string;
  items: { variantId: string; quantity: number }[];
}

export function createPosSale(data: PosSaleInput) {
  return request<{ orderId: string; totalAmount: number }>("/api/pos/sale", { method: "POST", body: JSON.stringify(data) });
}

export interface IssueInvoiceInput {
  type: "BOLETA" | "FACTURA";
  documentType: "DNI" | "RUC" | "CE" | "PASAPORTE";
  documentNumber: string;
  businessName?: string;
}

export function issueInvoice(orderId: string, data: IssueInvoiceInput) {
  return request(`/api/orders/${orderId}/invoice`, { method: "POST", body: JSON.stringify(data) });
}

export interface UpdateTenantSettingsInput {
  businessName?: string;
  ruc?: string;
  fiscalAddress?: string;
  logoUrl?: string;
  primaryColor?: string;
  features?: Partial<{
    sunatInvoicing: boolean;
    inventoryManagement: boolean;
    profitMargins: boolean;
    orderValidation: boolean;
    posWeb: boolean;
  }>;
}

export function updateTenantSettings(data: UpdateTenantSettingsInput) {
  return request("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
}
