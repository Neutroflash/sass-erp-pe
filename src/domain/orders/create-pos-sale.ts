import type { Prisma } from "@prisma/client";
import { createOrderWithStockReservation, type CartLineInput, type CreateOrderResult } from "./reserve-stock";

export interface CreatePosSaleParams {
  tenantId: string;
  sellerId: string;
  customerName?: string;
  items: CartLineInput[];
  /** CASH cobra en el momento; CREDIT entrega y deja la deuda abierta. */
  paymentTerm?: "CASH" | "CREDIT";
  /** Ficha del cliente. Obligatoria a crédito: no se puede cobrar una deuda de un nombre suelto. */
  customerId?: string | null;
  dueDate?: Date | null;
}

/**
 * Venta presencial. En ambas condiciones de pago la mercadería sale en el momento, así que no hay
 * espera de confirmación ni hold que expire: se reutiliza el mismo lock de fila para reservar
 * stock y, dentro de LA MISMA transacción, se decrementa el stock físico (sin pasar por
 * `markOrderPaid`, que abre su propia transacción — acá ya estamos dentro de una).
 *
 * Lo único que cambia entre contado y crédito es el estado final: `PAID` si se cobró, o
 * `PENDING_COLLECTION` si se fió. El stock se descuenta igual en los dos casos porque en los dos
 * la tela ya salió del mostrador.
 *
 * A crédito NUNCA se usa `PENDING_PAYMENT`, aunque semánticamente suene correcto: el worker de
 * holds cancela cualquier pedido en ese estado a los 15 minutos y devuelve el stock (ver
 * stock-hold-queue.ts). La venta se autodestruiría mientras el cliente maneja de vuelta.
 */
export async function createPosSale(tx: Prisma.TransactionClient, params: CreatePosSaleParams): Promise<CreateOrderResult> {
  const onCredit = params.paymentTerm === "CREDIT";

  const result = await createOrderWithStockReservation(tx, {
    tenantId: params.tenantId,
    userId: params.sellerId,
    channel: "POS",
    customerId: params.customerId,
    customerName: params.customerName?.trim() || "Cliente de mostrador",
    items: params.items,
  });

  await tx.order.update({
    where: { id: result.orderId },
    data: {
      status: onCredit ? "PENDING_COLLECTION" : "PAID",
      paymentTerm: onCredit ? "CREDIT" : "CASH",
      dueDate: onCredit ? params.dueDate ?? null : null,
    },
  });
  for (const item of params.items) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { decrement: item.quantity }, reservedStock: { decrement: item.quantity } },
    });
  }

  return result;
}
