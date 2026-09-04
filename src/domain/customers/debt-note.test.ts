import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDebtNote } from "./debt-note";
import { registerPayment } from "@/domain/payments/register-payment";
import { getCollectedSince } from "@/domain/reports/accounts-receivable";

/**
 * Contra Postgres real. Esta nota se le ENTREGA a un tercero como constancia de cuánto debe: si el
 * número está mal, el negocio le reclama de más o de menos a una persona real. Y si cita un
 * comprobante que SUNAT nunca aceptó, le da un respaldo que no existe.
 */
const setupClient = new PrismaClient();

let tenantId: string;
let variantId: string;
let customerId: string;

beforeAll(async () => {
  const tenant = await setupClient.tenant.create({
    data: { slug: `test-nota-${Date.now()}`, businessName: "Textiles del Sur", ruc: "20123456789", fiscalAddress: "Av. Grau 123" },
  });
  tenantId = tenant.id;

  const product = await setupClient.product.create({ data: { tenantId, name: "Tela", slug: "tela" } });
  const variant = await setupClient.productVariant.create({
    data: { tenantId, productId: product.id, sku: "TEST-NOTA", name: "V", price: 10, costPrice: 5, stock: 100000 },
  });
  variantId = variant.id;
});

beforeEach(async () => {
  await setupClient.paymentAllocation.deleteMany({ where: { payment: { tenantId } } });
  await setupClient.payment.deleteMany({ where: { tenantId } });
  await setupClient.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await setupClient.invoice.deleteMany({ where: { tenantId } });
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

async function attachInvoice(orderId: string, number: number, status: "ISSUED" | "FAILED") {
  await setupClient.invoice.create({
    data: {
      tenantId,
      orderId,
      type: "BOLETA",
      status,
      series: "B001",
      number,
      documentType: "DNI",
      documentNumber: "44556677",
      totalAmount: 100,
    },
  });
}

describe("buildDebtNote", () => {
  test("suma solo lo que falta cobrar, no el total vendido", async () => {
    await creditSale(200);
    await creditSale(120);
    await registerPayment(prisma, { tenantId, customerId, amount: 150 });

    const note = await buildDebtNote(prisma, tenantId, customerId);

    expect(note!.total).toBe(170); // 320 vendido - 150 abonado
    expect(note!.lines).toHaveLength(2);
    expect(note!.lines[0]).toMatchObject({ total: 200, paid: 150, balance: 50 });
    expect(note!.lines[1]).toMatchObject({ total: 120, paid: 0, balance: 120 });
  });

  test("una venta ya saldada no aparece en la nota", async () => {
    await creditSale(100);
    await creditSale(80);
    await registerPayment(prisma, { tenantId, customerId, amount: 100 });

    const note = await buildDebtNote(prisma, tenantId, customerId);

    expect(note!.lines).toHaveLength(1);
    expect(note!.lines[0].balance).toBe(80);
    expect(note!.total).toBe(80);
  });

  test("separa lo vencido del total", async () => {
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await creditSale(200, { dueDate: haceUnaSemana });
    await creditSale(120, { dueDate: enUnaSemana });

    const note = await buildDebtNote(prisma, tenantId, customerId);

    expect(note!.total).toBe(320);
    expect(note!.overdueTotal).toBe(200);
    expect(note!.lines.filter((l) => l.overdue)).toHaveLength(1);
  });

  // Citar un comprobante que SUNAT nunca aceptó le daría al cliente un respaldo inexistente.
  test("solo cita comprobantes aceptados por SUNAT", async () => {
    const aceptada = await creditSale(100);
    const rechazada = await creditSale(50);
    await attachInvoice(aceptada, 12, "ISSUED");
    await attachInvoice(rechazada, 13, "FAILED");

    const note = await buildDebtNote(prisma, tenantId, customerId);

    const byOrder = new Map(note!.lines.map((l) => [l.orderId, l.comprobante]));
    expect(byOrder.get(aceptada)).toBe("B001-00000012");
    expect(byOrder.get(rechazada)).toBeNull();
  });

  test("lleva los datos del negocio y del cliente para poder cobrar con el papel en la mano", async () => {
    await creditSale(100);
    const note = await buildDebtNote(prisma, tenantId, customerId);

    expect(note!.emisor).toMatchObject({ businessName: "Textiles del Sur", ruc: "20123456789" });
    expect(note!.cliente).toMatchObject({ name: "Juan Pablo", address: "Jr. Puno 123", phone: "999888777" });
  });

  test("un cliente sin deuda devuelve una nota vacía, no un error", async () => {
    const note = await buildDebtNote(prisma, tenantId, customerId);
    expect(note!.lines).toEqual([]);
    expect(note!.total).toBe(0);
  });

  test("un cliente de otro negocio no existe para este", async () => {
    const otro = await setupClient.tenant.create({ data: { slug: `test-nota-otro-${Date.now()}`, businessName: "Otro" } });
    const ajeno = await setupClient.customer.create({ data: { tenantId: otro.id, name: "Ajeno" } });

    expect(await buildDebtNote(prisma, tenantId, ajeno.id)).toBeNull();

    await setupClient.tenant.delete({ where: { id: otro.id } });
  });
});

describe("getCollectedSince", () => {
  // El número que NO se puede confundir con "ventas del día".
  test("mide lo cobrado, no lo vendido", async () => {
    await creditSale(500);
    await registerPayment(prisma, { tenantId, customerId, amount: 120 });
    await registerPayment(prisma, { tenantId, customerId, amount: 80 });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const { collected, paymentCount } = await getCollectedSince(prisma, tenantId, hoy);
    // Se vendió 500 y se cobró 200: son dos números distintos y este es el segundo.
    expect(collected).toBe(200);
    expect(paymentCount).toBe(2);
  });

  test("no cuenta abonos anteriores al corte", async () => {
    await creditSale(500);
    await registerPayment(prisma, { tenantId, customerId, amount: 100 });

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect((await getCollectedSince(prisma, tenantId, manana)).collected).toBe(0);
  });
});
