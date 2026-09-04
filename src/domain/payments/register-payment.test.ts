import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerPayment } from "./register-payment";
import { OverpaymentError, CustomerNotFoundError } from "./errors";
import { getCustomerOutstanding, getReceivables } from "@/domain/reports/accounts-receivable";

/**
 * Contra Postgres real, mismo criterio que reserve-stock.test.ts: lo que puede salir mal acá
 * —dos abonos concurrentes repartiendo sobre las mismas ventas, un centavo perdido en una cadena
 * de restas, un pedido que no llega a cerrarse— solo se ve contra una base de verdad. Un Prisma
 * mockeado pasaría estos tests sin probar nada de eso.
 */
const setupClient = new PrismaClient();

let tenantId: string;
let variantId: string;
let customerId: string;

beforeAll(async () => {
  const tenant = await setupClient.tenant.create({
    data: { slug: `test-credito-${Date.now()}`, businessName: "Test Crédito" },
  });
  tenantId = tenant.id;

  const product = await setupClient.product.create({
    data: { tenantId, name: "Tela de prueba", slug: "tela-de-prueba" },
  });
  const variant = await setupClient.productVariant.create({
    data: { tenantId, productId: product.id, sku: "TEST-CREDITO", name: "Variante", price: 10, costPrice: 5, stock: 100000 },
  });
  variantId = variant.id;
});

// Cada test arranca con el mismo cliente y sin deudas: son escenarios de saldos, y arrastrar el
// estado de uno al siguiente haría que un fallo real se disfrace de fallo en cascada.
beforeEach(async () => {
  await setupClient.paymentAllocation.deleteMany({ where: { payment: { tenantId } } });
  await setupClient.payment.deleteMany({ where: { tenantId } });
  await setupClient.orderItem.deleteMany({ where: { order: { tenantId } } });
  await setupClient.order.deleteMany({ where: { tenantId } });
  await setupClient.customer.deleteMany({ where: { tenantId } });

  const customer = await setupClient.customer.create({
    data: { tenantId, name: "Juan Pablo", address: "Jr. Puno 123", phone: "999888777" },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await setupClient.tenant.delete({ where: { id: tenantId } });
  await setupClient.$disconnect();
});

/** Una venta a crédito ya entregada, con el saldo abierto. */
async function creditSale(total: number, opts: { createdAt?: Date; dueDate?: Date } = {}): Promise<string> {
  const order = await setupClient.order.create({
    data: {
      tenantId,
      channel: "POS",
      status: "PENDING_COLLECTION",
      paymentTerm: "CREDIT",
      totalAmount: total,
      customerId,
      customerName: "Juan Pablo",
      dueDate: opts.dueDate,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      items: { create: [{ variantId, quantity: 1, price: total }] },
    },
  });
  return order.id;
}

async function statusOf(orderId: string): Promise<string> {
  const order = await setupClient.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  return order.status;
}

describe("registerPayment — reparto de abonos", () => {
  test("un abono que cubre la venta entera la cierra", async () => {
    const orderId = await creditSale(100);

    const result = await registerPayment(prisma, { tenantId, customerId, amount: 100 });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toMatchObject({ orderId, applied: 100, remaining: 0, closed: true });
    expect(result.outstandingAfter).toBe(0);
    expect(await statusOf(orderId)).toBe("PAID");
  });

  test("un abono parcial deja la venta abierta con el saldo correcto", async () => {
    const orderId = await creditSale(100);

    const result = await registerPayment(prisma, { tenantId, customerId, amount: 30 });

    expect(result.allocations[0]).toMatchObject({ applied: 30, remaining: 70, closed: false });
    expect(result.ordersClosed).toBe(0);
    expect(await statusOf(orderId)).toBe("PENDING_COLLECTION");
    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(70);
  });

  // El comportamiento que el negocio pidió: "me pagó S/ 100" sin decir contra qué venta.
  test("un abono se reparte de la venta más antigua a la más nueva", async () => {
    const ayer = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const hoy = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const vieja = await creditSale(50, { createdAt: ayer });
    const nueva = await creditSale(80, { createdAt: hoy });

    const result = await registerPayment(prisma, { tenantId, customerId, amount: 100 });

    // 50 cierran la vieja; los 50 restantes se aplican a la nueva, que queda debiendo 30.
    expect(result.allocations).toEqual([
      { orderId: vieja, applied: 50, remaining: 0, closed: true },
      { orderId: nueva, applied: 50, remaining: 30, closed: false },
    ]);
    expect(await statusOf(vieja)).toBe("PAID");
    expect(await statusOf(nueva)).toBe("PENDING_COLLECTION");
    expect(result.outstandingAfter).toBe(30);
  });

  test("varios abonos sucesivos terminan cerrando la venta", async () => {
    const orderId = await creditSale(100);

    await registerPayment(prisma, { tenantId, customerId, amount: 30 });
    await registerPayment(prisma, { tenantId, customerId, amount: 40 });
    expect(await statusOf(orderId)).toBe("PENDING_COLLECTION");

    await registerPayment(prisma, { tenantId, customerId, amount: 30 });
    expect(await statusOf(orderId)).toBe("PAID");
    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(0);
  });

  // Con floats, repartir en tercios deja un residuo que nunca llega a cero y el pedido no cierra.
  test("montos que no dividen exacto no dejan céntimos colgados", async () => {
    const orderId = await creditSale(100);

    await registerPayment(prisma, { tenantId, customerId, amount: 33.33 });
    await registerPayment(prisma, { tenantId, customerId, amount: 33.33 });
    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(33.34);

    await registerPayment(prisma, { tenantId, customerId, amount: 33.34 });
    expect(await statusOf(orderId)).toBe("PAID");
    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(0);
  });
});

describe("registerPayment — lo que debe rechazar", () => {
  test("un abono mayor a la deuda se rechaza sin escribir nada", async () => {
    await creditSale(100);

    await expect(registerPayment(prisma, { tenantId, customerId, amount: 150 })).rejects.toThrow(OverpaymentError);

    expect(await setupClient.payment.count({ where: { tenantId } })).toBe(0);
    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(100);
  });

  test("cobrarle a un cliente sin deudas se rechaza con un mensaje que lo dice", async () => {
    await expect(registerPayment(prisma, { tenantId, customerId, amount: 10 })).rejects.toThrow(
      "no tiene deudas pendientes",
    );
  });

  test("un monto cero o negativo se rechaza", async () => {
    await creditSale(100);
    await expect(registerPayment(prisma, { tenantId, customerId, amount: 0 })).rejects.toThrow(OverpaymentError);
    await expect(registerPayment(prisma, { tenantId, customerId, amount: -50 })).rejects.toThrow(OverpaymentError);
  });

  test("un cliente de otro negocio no existe para este", async () => {
    const otro = await setupClient.tenant.create({
      data: { slug: `test-credito-otro-${Date.now()}`, businessName: "Otro" },
    });
    const ajeno = await setupClient.customer.create({ data: { tenantId: otro.id, name: "Ajeno" } });

    await expect(registerPayment(prisma, { tenantId, customerId: ajeno.id, amount: 10 })).rejects.toThrow(
      CustomerNotFoundError,
    );

    await setupClient.tenant.delete({ where: { id: otro.id } });
  });
});

describe("registerPayment — concurrencia real contra Postgres", () => {
  // Dos personas del mostrador cobrando al mismo cliente a la vez. Sin el FOR UPDATE ambas leen
  // el mismo saldo, ambas reparten sobre las mismas ventas, y el cliente termina figurando como
  // que pagó de más.
  // Este confirma la regla (uno solo puede pasar) pero no siempre llega a interleavear; el de
  // diez abonos de abajo es el que falla de verdad si se quita el FOR UPDATE.
  test("con deuda de 100 y dos abonos concurrentes de 60, exactamente uno pasa", async () => {
    const orderId = await creditSale(100);

    const results = await Promise.allSettled([
      registerPayment(prisma, { tenantId, customerId, amount: 60 }),
      registerPayment(prisma, { tenantId, customerId, amount: 60 }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);

    expect(await getCustomerOutstanding(prisma, tenantId, customerId)).toBe(40);
    expect(await statusOf(orderId)).toBe("PENDING_COLLECTION");
    expect(await setupClient.payment.count({ where: { tenantId } })).toBe(1);
  });

  test("diez abonos concurrentes de 10 sobre una deuda de 100 cobran exactamente 100", async () => {
    const orderId = await creditSale(100);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => registerPayment(prisma, { tenantId, customerId, amount: 10 })),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);

    const total = await setupClient.paymentAllocation.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });
    expect(Number(total._sum.amount)).toBe(100);
    expect(await statusOf(orderId)).toBe("PAID");
  });
});

describe("getReceivables", () => {
  test("agrupa por cliente y marca lo vencido, con los datos para salir a cobrar", async () => {
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await creditSale(200, { dueDate: haceUnaSemana });
    await creditSale(120, { dueDate: enUnaSemana });

    const { byCustomer, summary } = await getReceivables(prisma, tenantId);

    expect(byCustomer).toHaveLength(1);
    expect(byCustomer[0]).toMatchObject({
      name: "Juan Pablo",
      address: "Jr. Puno 123",
      phone: "999888777",
      outstanding: 320,
      overdue: 200,
      openOrders: 2,
      daysOverdue: 7,
    });
    expect(summary).toMatchObject({ totalOutstanding: 320, totalOverdue: 200, customersWithDebt: 1 });
  });

  test("una venta ya cobrada sale de la cartera", async () => {
    await creditSale(100);
    await registerPayment(prisma, { tenantId, customerId, amount: 100 });

    const { byCustomer, summary } = await getReceivables(prisma, tenantId);
    expect(byCustomer).toHaveLength(0);
    expect(summary.totalOutstanding).toBe(0);
  });

  test("una venta a crédito sin cliente se reporta como problema de datos, no como deuda", async () => {
    await setupClient.order.create({
      data: {
        tenantId,
        channel: "POS",
        status: "PENDING_COLLECTION",
        paymentTerm: "CREDIT",
        totalAmount: 90,
        customerName: "Sin ficha",
        items: { create: [{ variantId, quantity: 1, price: 90 }] },
      },
    });

    const { byCustomer, orphanOrderIds, summary } = await getReceivables(prisma, tenantId);
    expect(byCustomer).toHaveLength(0);
    expect(orphanOrderIds).toHaveLength(1);
    expect(summary.totalOutstanding).toBe(0);
  });
});
