import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { fromCents, toCents } from "@/domain/payments/money";

/**
 * Cuentas por cobrar: quién le debe cuánto al negocio.
 *
 * Vive aparte de tenant-reports.ts a propósito. Ese módulo mide **ventas** (qué salió por la
 * puerta); este mide **deuda** (qué falta entrar por la caja). Desde que existe el crédito son dos
 * números distintos, y mezclarlos en el mismo archivo es la forma más rápida de que alguien acabe
 * mostrando uno con la etiqueta del otro.
 *
 * El saldo se calcula por CLIENTE, no por pedido, porque así es como el negocio piensa la deuda:
 * "Juan me debe S/ 450", venga de una compra o de cinco. El desglose por venta existe, pero es el
 * detalle al que se entra, no el titular.
 */

export interface CustomerDebt {
  customerId: string;
  name: string;
  /** A dónde ir a cobrar. Es un dato de la lista, no de la ficha: se sale a cobrar con esto. */
  address: string | null;
  phone: string | null;
  outstanding: number;
  /** Parte del saldo cuya fecha de vencimiento ya pasó. */
  overdue: number;
  openOrders: number;
  /** Días desde el vencimiento más antiguo sin pagar. `null` si nada está vencido. */
  daysOverdue: number | null;
  oldestDueDate: Date | null;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  totalOverdue: number;
  customersWithDebt: number;
}

interface OpenOrderShape {
  id: string;
  customerId: string | null;
  totalAmount: unknown;
  dueDate: Date | null;
  customer: { name: string; address: string | null; phone: string | null } | null;
}

/**
 * Una venta a crédito sin cliente asociado no puede cobrarse (no hay a quién), así que quedaría
 * invisible en esta pantalla. No debería existir —la API exige cliente para fiar— pero si alguna
 * aparece por datos migrados a mano, es mejor que salte acá que quedar en un limbo silencioso.
 */
export interface Receivables {
  byCustomer: CustomerDebt[];
  summary: ReceivablesSummary;
  /** Ventas a crédito abiertas sin ficha de cliente — un problema de datos, no una deuda cobrable. */
  orphanOrderIds: string[];
}

export async function getReceivables(prisma: PrismaClient, tenantId: string, now = new Date()): Promise<Receivables> {
  const [orders, allocations] = await withTenantRLS(prisma, tenantId, async (tx) => [
    (await tx.order.findMany({
      where: { tenantId, status: "PENDING_COLLECTION" },
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
        dueDate: true,
        customer: { select: { name: true, address: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as OpenOrderShape[],
    await tx.paymentAllocation.groupBy({
      by: ["orderId"],
      where: { order: { tenantId, status: "PENDING_COLLECTION" } },
      _sum: { amount: true },
    }),
  ]);

  const appliedByOrder = new Map(allocations.map((a) => [a.orderId, toCents(a._sum.amount ?? 0)]));

  const byCustomer = new Map<string, CustomerDebt & { outstandingCents: number; overdueCents: number }>();
  const orphanOrderIds: string[] = [];

  for (const order of orders) {
    const outstandingCents = toCents(order.totalAmount) - (appliedByOrder.get(order.id) ?? 0);
    if (outstandingCents <= 0) continue; // saldado pero sin cerrar — no es deuda, no se reporta

    if (!order.customerId || !order.customer) {
      orphanOrderIds.push(order.id);
      continue;
    }

    const overdue = order.dueDate !== null && order.dueDate < now;

    const entry = byCustomer.get(order.customerId) ?? {
      customerId: order.customerId,
      name: order.customer.name,
      address: order.customer.address,
      phone: order.customer.phone,
      outstanding: 0,
      overdue: 0,
      openOrders: 0,
      daysOverdue: null,
      oldestDueDate: null,
      outstandingCents: 0,
      overdueCents: 0,
    };

    entry.outstandingCents += outstandingCents;
    entry.openOrders += 1;
    if (overdue) {
      entry.overdueCents += outstandingCents;
      if (entry.oldestDueDate === null || order.dueDate! < entry.oldestDueDate) {
        entry.oldestDueDate = order.dueDate;
      }
    }

    byCustomer.set(order.customerId, entry);
  }

  const rows: CustomerDebt[] = [...byCustomer.values()]
    .map((entry) => ({
      customerId: entry.customerId,
      name: entry.name,
      address: entry.address,
      phone: entry.phone,
      outstanding: fromCents(entry.outstandingCents),
      overdue: fromCents(entry.overdueCents),
      openOrders: entry.openOrders,
      oldestDueDate: entry.oldestDueDate,
      daysOverdue: entry.oldestDueDate === null ? null : daysBetween(entry.oldestDueDate, now),
    }))
    // Lo más vencido primero: esta lista se usa para decidir a quién llamar hoy, no para
    // consultar un cliente puntual (para eso está el buscador).
    .sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);

  return {
    byCustomer: rows,
    summary: {
      totalOutstanding: round2(rows.reduce((sum, r) => sum + r.outstanding, 0)),
      totalOverdue: round2(rows.reduce((sum, r) => sum + r.overdue, 0)),
      customersWithDebt: rows.length,
    },
    orphanOrderIds,
  };
}

/**
 * Saldo pendiente de cada cliente, en soles. Solo aparecen los que deben algo.
 *
 * Se exporta para que el listado de clientes no vuelva a implementar la misma resta: hay una sola
 * definición de "cuánto debe alguien" en el proyecto, y es esta.
 */
export async function getOutstandingByCustomer(prisma: PrismaClient, tenantId: string): Promise<Map<string, number>> {
  const [orders, allocations] = await withTenantRLS(prisma, tenantId, async (tx) => [
    await tx.order.findMany({
      where: { tenantId, status: "PENDING_COLLECTION", customerId: { not: null } },
      select: { id: true, customerId: true, totalAmount: true },
    }),
    await tx.paymentAllocation.groupBy({
      by: ["orderId"],
      where: { order: { tenantId, status: "PENDING_COLLECTION" } },
      _sum: { amount: true },
    }),
  ]);

  const appliedByOrder = new Map(allocations.map((a) => [a.orderId, toCents(a._sum.amount ?? 0)]));
  const centsByCustomer = new Map<string, number>();

  for (const order of orders) {
    if (!order.customerId) continue;
    const outstanding = toCents(order.totalAmount) - (appliedByOrder.get(order.id) ?? 0);
    if (outstanding <= 0) continue;
    centsByCustomer.set(order.customerId, (centsByCustomer.get(order.customerId) ?? 0) + outstanding);
  }

  return new Map([...centsByCustomer].map(([id, cents]) => [id, fromCents(cents)]));
}

/** Saldo de un solo cliente — lo que la ficha necesita sin traer la cartera entera. */
export async function getCustomerOutstanding(prisma: PrismaClient, tenantId: string, customerId: string): Promise<number> {
  const [orders, allocations] = await withTenantRLS(prisma, tenantId, async (tx) => [
    await tx.order.findMany({
      where: { tenantId, customerId, status: "PENDING_COLLECTION" },
      select: { id: true, totalAmount: true },
    }),
    await tx.paymentAllocation.groupBy({
      by: ["orderId"],
      where: { order: { tenantId, customerId, status: "PENDING_COLLECTION" } },
      _sum: { amount: true },
    }),
  ]);

  const appliedByOrder = new Map(allocations.map((a) => [a.orderId, toCents(a._sum.amount ?? 0)]));
  const cents = orders.reduce((sum, o) => sum + Math.max(0, toCents(o.totalAmount) - (appliedByOrder.get(o.id) ?? 0)), 0);
  return fromCents(cents);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
