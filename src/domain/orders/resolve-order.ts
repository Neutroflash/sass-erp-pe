import type { PrismaClient } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";

/**
 * Idempotente: solo transiciona PENDING_PAYMENT -> PAID (guardado en el propio WHERE, no en un
 * chequeo previo separado — así es seguro correrlo dos veces en paralelo, ej. una confirmación
 * manual del staff y el worker de expiración disparándose casi al mismo tiempo). Acá, y solo
 * acá, se decrementa el stock físico — hasta este momento el stock nunca bajó, solo estaba
 * reservado.
 */
export async function markOrderPaid(prisma: PrismaClient, tenantId: string, orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, tenantId); // RLS, ver docs/RLS.md
    const result = await tx.order.updateMany({
      where: { id: orderId, tenantId, status: "PENDING_PAYMENT" },
      data: { status: "PAID" },
    });
    if (result.count === 0) return false; // ya estaba pagada/cancelada — no-op, no es un error

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity }, reservedStock: { decrement: item.quantity } },
      });
    }
    return true;
  });
}

/**
 * Idempotente: solo transiciona PENDING_PAYMENT -> CANCELLED, liberando reservedStock (nunca
 * toca `stock`, que nunca se decrementó para una orden que no llegó a pagarse). Usado tanto por
 * el rechazo manual de un pago como por el worker de expiración — mismo mecanismo, la diferencia
 * es solo quién lo dispara.
 */
export async function releaseOrderHold(prisma: PrismaClient, tenantId: string, orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, tenantId); // RLS, ver docs/RLS.md
    const result = await tx.order.updateMany({
      where: { id: orderId, tenantId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) return false;

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { reservedStock: { decrement: item.quantity } } });
    }
    return true;
  });
}
