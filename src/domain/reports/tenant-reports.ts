import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";

export interface DailySales {
  date: string; // YYYY-MM-DD
  total: number;
  orderCount: number;
}

/**
 * Agrupa en JS, no con SQL crudo — a la escala de un negocio pyme (el público de este SaaS), el
 * volumen de pedidos pagados en 30 días nunca justifica una query agregada por día en Postgres;
 * traer las filas y sumar acá es simple y suficientemente rápido, sin acoplarse a sintaxis
 * específica de Postgres (date_trunc) que complicaría portar a otro motor más adelante.
 */
export async function getSalesByDay(prisma: PrismaClient, tenantId: string, days = 30): Promise<DailySales[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const orders = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.order.findMany({
      where: { tenantId, status: "PAID", createdAt: { gte: since } },
      select: { totalAmount: true, createdAt: true },
    }),
  );

  const byDay = new Map<string, DailySales>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, total: 0, orderCount: 0 });
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.total += Number(order.totalAmount);
      bucket.orderCount += 1;
    }
  }

  return Array.from(byDay.values());
}

export interface TopProduct {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantitySold: number;
}

export async function getTopProducts(prisma: PrismaClient, tenantId: string, limit = 10): Promise<TopProduct[]> {
  const grouped = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.orderItem.groupBy({
      by: ["variantId"],
      where: { order: { tenantId, status: "PAID" } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    }),
  );
  if (grouped.length === 0) return [];

  const variants = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.productVariant.findMany({
      where: { id: { in: grouped.map((g) => g.variantId) } },
      include: { product: { select: { name: true } } },
    }),
  );
  const variantById = new Map(variants.map((v) => [v.id, v]));

  return grouped
    .map((g) => {
      const variant = variantById.get(g.variantId);
      if (!variant) return null; // variante borrada — descartada, no tiene sentido reportarla
      return {
        variantId: g.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        quantitySold: g._sum.quantity ?? 0,
      };
    })
    .filter((row): row is TopProduct => row !== null);
}

export interface InventoryValuation {
  totalUnits: number;
  totalValue: number;
}

/** Capital inmovilizado en inventario (stock físico × costo), no incluye reservedStock aparte —
 * el stock físico ya lo incluye, reservado o no sigue siendo inventario que el negocio posee. */
export async function getInventoryValuation(prisma: PrismaClient, tenantId: string): Promise<InventoryValuation> {
  const variants = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.productVariant.findMany({
      where: { tenantId },
      select: { stock: true, costPrice: true },
    }),
  );

  return variants.reduce(
    (acc, v) => ({
      totalUnits: acc.totalUnits + v.stock,
      totalValue: acc.totalValue + v.stock * Number(v.costPrice),
    }),
    { totalUnits: 0, totalValue: 0 },
  );
}
