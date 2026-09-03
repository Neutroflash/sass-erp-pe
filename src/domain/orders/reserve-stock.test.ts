import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockReservation } from "./reserve-stock";
import { InsufficientStockError } from "./errors";
import { toQty } from "@/domain/inventory/quantity";

/**
 * Contra Postgres real, no un Prisma mockeado — es lo único que valida de verdad el `FOR UPDATE`
 * de reserve-stock.ts (ver el comentario grande ahí). Un mock nunca podría reproducir la condición
 * de carrera real que este test existe para probar.
 *
 * `setupClient` usa DATABASE_URL directo (el rol dueño de las migraciones, sin RLS de por medio)
 * solo para crear/borrar el tenant de prueba — el propio `createOrderWithStockReservation` fija
 * su tenant vía `setTenantForTransaction` internamente, así que usar el `prisma` real de la app
 * (que puede estar detrás de RUNTIME_DATABASE_URL/RLS, igual que en producción) prueba el camino
 * real de punta a punta, no un atajo.
 */
const setupClient = new PrismaClient();

let tenantId: string;
let variantId: string;
const STARTING_STOCK = 3;

beforeAll(async () => {
  const tenant = await setupClient.tenant.create({
    data: { slug: `test-concurrency-${Date.now()}`, businessName: "Test Concurrency" },
  });
  tenantId = tenant.id;

  const product = await setupClient.product.create({
    data: { tenantId, name: "Producto de prueba (concurrencia)", slug: "producto-de-prueba-concurrencia" },
  });

  const variant = await setupClient.productVariant.create({
    data: {
      tenantId,
      productId: product.id,
      sku: "TEST-CONCURRENCY-SKU",
      name: "Variante de prueba",
      price: 10,
      costPrice: 5,
      stock: STARTING_STOCK,
      reservedStock: 0,
    },
  });
  variantId = variant.id;
});

afterAll(async () => {
  await setupClient.tenant.delete({ where: { id: tenantId } }); // cascade: product, variant, orders
  await setupClient.$disconnect();
});

describe("createOrderWithStockReservation — concurrencia real contra Postgres", () => {
  test(`con stock=${STARTING_STOCK} y 10 checkouts concurrentes de 1 unidad, exactamente ${STARTING_STOCK} tienen éxito`, async () => {
    const attempts = 10;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        prisma.$transaction((tx) =>
          createOrderWithStockReservation(tx, {
            tenantId,
            userId: null,
            channel: "ONLINE",
            customerName: "Concurrency Test",
            items: [{ variantId, quantity: 1 }],
          }),
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // La aserción central: nunca más pedidos exitosos que unidades de stock, sin importar cuántos
    // checkouts concurrentes compitan por la última unidad.
    expect(succeeded).toHaveLength(STARTING_STOCK);
    expect(failed).toHaveLength(attempts - STARTING_STOCK);

    for (const f of failed) {
      if (f.status === "rejected") {
        expect(f.reason).toBeInstanceOf(InsufficientStockError);
      }
    }

    const finalVariant = await setupClient.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(toQty(finalVariant.reservedStock)).toBe(STARTING_STOCK); // nunca sobrevendido
    expect(toQty(finalVariant.stock)).toBe(STARTING_STOCK); // el stock físico no se toca acá, solo el hold

    const orderCount = await setupClient.order.count({ where: { tenantId } });
    expect(orderCount).toBe(STARTING_STOCK); // un Order real por cada reserva exitosa, ni uno más
  });

  test("un carrito vacío rechaza antes de tocar la base de datos", async () => {
    await expect(
      prisma.$transaction((tx) =>
        createOrderWithStockReservation(tx, {
          tenantId,
          userId: null,
          channel: "ONLINE",
          customerName: "Carrito vacío",
          items: [],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
