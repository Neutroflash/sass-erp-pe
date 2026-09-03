import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markOrderPaid, releaseOrderHold } from "./resolve-order";
import { toQty } from "@/domain/inventory/quantity";

/**
 * markOrderPaid/releaseOrderHold son las dos funciones que corren en paralelo real en producción
 * — confirmación manual del staff vs. worker de expiración disparándose casi al mismo tiempo (ver
 * el comentario en resolve-order.ts) — así que la idempotencia no es un detalle, es la propiedad
 * que hace que esa carrera nunca decremente el stock dos veces.
 */
const setupClient = new PrismaClient();

let tenantId: string;
let variantId: string;
let orderId: string;
const RESERVED_QTY = 2;

beforeAll(async () => {
  const tenant = await setupClient.tenant.create({
    data: { slug: `test-resolve-order-${Date.now()}`, businessName: "Test Resolve Order" },
  });
  tenantId = tenant.id;

  const product = await setupClient.product.create({
    data: { tenantId, name: "Producto de prueba (resolve-order)", slug: "producto-de-prueba-resolve-order" },
  });

  const variant = await setupClient.productVariant.create({
    data: {
      tenantId,
      productId: product.id,
      sku: "TEST-RESOLVE-ORDER-SKU",
      name: "Variante de prueba",
      price: 10,
      costPrice: 5,
      stock: 5,
      reservedStock: 0,
    },
  });
  variantId = variant.id;
});

afterAll(async () => {
  await setupClient.tenant.delete({ where: { id: tenantId } });
  await setupClient.$disconnect();
});

// Cada test arranca desde una orden PENDING_PAYMENT nueva con la misma reserva — así los tests no
// dependen del orden en que corren ni del estado que dejó el anterior.
beforeEach(async () => {
  await setupClient.productVariant.update({ where: { id: variantId }, data: { stock: 5, reservedStock: RESERVED_QTY } });
  const order = await setupClient.order.create({
    data: {
      tenantId,
      channel: "ONLINE",
      status: "PENDING_PAYMENT",
      totalAmount: 20,
      customerName: "Idempotency Test",
      items: { create: [{ variantId, quantity: RESERVED_QTY, price: 10 }] },
    },
  });
  orderId = order.id;
});

describe("markOrderPaid", () => {
  test("decrementa stock y reservedStock exactamente una vez, aunque se llame dos veces en paralelo", async () => {
    const [first, second] = await Promise.all([
      markOrderPaid(prisma, tenantId, orderId),
      markOrderPaid(prisma, tenantId, orderId),
    ]);

    // Exactamente una de las dos llamadas concurrentes "ganó" la transición PENDING_PAYMENT -> PAID.
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const variant = await setupClient.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(toQty(variant.stock)).toBe(5 - RESERVED_QTY); // decrementado UNA sola vez, no dos
    expect(toQty(variant.reservedStock)).toBe(0);

    const order = await setupClient.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
  });

  test("una tercera llamada después de ya estar PAID es un no-op explícito (false, no error)", async () => {
    await markOrderPaid(prisma, tenantId, orderId);
    const result = await markOrderPaid(prisma, tenantId, orderId);
    expect(result).toBe(false);
  });
});

describe("releaseOrderHold", () => {
  test("libera reservedStock sin tocar el stock físico (nunca se había decrementado)", async () => {
    const result = await releaseOrderHold(prisma, tenantId, orderId);
    expect(result).toBe(true);

    const variant = await setupClient.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(toQty(variant.stock)).toBe(5); // intacto
    expect(toQty(variant.reservedStock)).toBe(0); // liberado

    const order = await setupClient.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
  });

  test("no puede liberar una orden que ya se pagó (evita liberar stock de un pedido ya vendido)", async () => {
    await markOrderPaid(prisma, tenantId, orderId);
    const result = await releaseOrderHold(prisma, tenantId, orderId);
    expect(result).toBe(false);

    const order = await setupClient.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID"); // no se pisó el estado
  });
});
