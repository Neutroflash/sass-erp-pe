import type { Prisma } from "@prisma/client";
import { createOrderWithStockReservation, type CartLineInput, type CreateOrderResult } from "./reserve-stock";

export interface CreatePosSaleParams {
  tenantId: string;
  sellerId: string;
  customerName?: string;
  items: CartLineInput[];
}

/**
 * Venta presencial: se cobra en el momento (efectivo/tarjeta en el mostrador), así que no hay
 * espera de confirmación ni hold que expire — a diferencia del checkout online, acá se reutiliza
 * el mismo lock de fila para reservar stock y, dentro de LA MISMA transacción, se decrementa el
 * stock físico y se marca `PAID` de inmediato (sin pasar por `markOrderPaid`, que abre su propia
 * transacción — acá ya estamos dentro de una).
 */
export async function createPosSale(tx: Prisma.TransactionClient, params: CreatePosSaleParams): Promise<CreateOrderResult> {
  const result = await createOrderWithStockReservation(tx, {
    tenantId: params.tenantId,
    userId: params.sellerId,
    channel: "POS",
    customerName: params.customerName?.trim() || "Cliente de mostrador",
    items: params.items,
  });

  await tx.order.update({ where: { id: result.orderId }, data: { status: "PAID" } });
  for (const item of params.items) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { decrement: item.quantity }, reservedStock: { decrement: item.quantity } },
    });
  }

  return result;
}
