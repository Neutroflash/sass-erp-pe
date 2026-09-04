import type { PaymentMethod, PrismaClient } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";
import { CustomerNotFoundError, OverpaymentError } from "./errors";
import { fromCents, toCents } from "./money";

export interface RegisterPaymentParams {
  tenantId: string;
  customerId: string;
  /** Monto entregado por el cliente, en soles. Siempre positivo. */
  amount: number;
  method?: PaymentMethod;
  paidAt?: Date;
  note?: string;
  createdById?: string;
}

export interface PaymentAllocationResult {
  orderId: string;
  applied: number;
  /** Saldo del pedido DESPUÉS de aplicar este abono. Cero = quedó cerrado. */
  remaining: number;
  closed: boolean;
}

export interface RegisterPaymentResult {
  paymentId: string;
  allocations: PaymentAllocationResult[];
  ordersClosed: number;
  /** Deuda total del cliente después de este abono. */
  outstandingAfter: number;
}

interface OpenOrderRow {
  id: string;
  /** `numeric` llega como string desde $queryRaw, igual que en reserve-stock.ts. */
  total_amount: string;
}

/**
 * Registra un abono de un cliente y lo reparte entre sus ventas a crédito abiertas, de la más
 * antigua a la más nueva.
 *
 * **Por qué el pago no cuelga de un pedido.** El negocio no cobra por venta, cobra por persona:
 * alguien que compró tres veces y aparece con S/ 100 está abonando a lo que debe, no pagando "el
 * pedido del martes". Obligar a elegir contra qué venta se aplica cada billete convierte un gesto
 * de dos segundos en un formulario, y encima uno que se llena mal, porque el negocio no lleva esa
 * cuenta. Acá el negocio escribe un número y el sistema resuelve el resto; la repartición queda
 * registrada en PaymentAllocation para que cada pedido pueda cerrarse cuando le toca y el
 * historial explique de dónde salió cada centavo.
 *
 * **Por qué el bloqueo de filas.** Dos personas del mostrador registrando abonos del mismo cliente
 * al mismo tiempo leerían el mismo saldo, repartirían sobre las mismas ventas abiertas y el
 * cliente terminaría figurando como que pagó de más. El `FOR UPDATE` sobre los pedidos abiertos es
 * el mismo mecanismo que reserve-stock.ts usa para la última unidad de stock, y con el mismo
 * criterio de orden estable para no generar deadlocks entre dos abonos concurrentes.
 *
 * Ese lock sobre `orders` es además el mutex de `payment_allocations`: esta función es la única
 * que las escribe y siempre bloquea antes de leer, así que nadie puede insertar una repartición
 * sobre un pedido que otra transacción está repartiendo.
 */
export async function registerPayment(
  prisma: PrismaClient,
  params: RegisterPaymentParams,
): Promise<RegisterPaymentResult> {
  const amountCents = toCents(params.amount);
  if (amountCents <= 0) {
    throw new OverpaymentError(0);
  }

  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, params.tenantId); // RLS, ver docs/RLS.md

    const customer = await tx.customer.findFirst({
      where: { id: params.customerId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!customer) {
      throw new CustomerNotFoundError();
    }

    // tenant_id en el WHERE del lock, no validado después: así el lock también confirma que los
    // pedidos son de ESTE negocio. Orden estable (created_at, id) por la misma razón que
    // reserve-stock.ts ordena por variantId — dos abonos concurrentes del mismo cliente adquieren
    // los locks en el mismo orden y nunca compiten en direcciones opuestas.
    const openOrders = await tx.$queryRaw<OpenOrderRow[]>`
      SELECT id, total_amount FROM orders
      WHERE tenant_id = ${params.tenantId}
        AND customer_id = ${params.customerId}
        AND status = 'PENDING_COLLECTION'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    `;

    const allocatedByOrder = await sumAllocationsByOrder(
      tx,
      openOrders.map((o) => o.id),
    );

    const balances = openOrders.map((order) => ({
      id: order.id,
      outstanding: toCents(order.total_amount) - (allocatedByOrder.get(order.id) ?? 0),
    }));

    const totalOutstanding = balances.reduce((sum, b) => sum + b.outstanding, 0);
    if (amountCents > totalOutstanding) {
      throw new OverpaymentError(fromCents(totalOutstanding));
    }

    const payment = await tx.payment.create({
      data: {
        tenantId: params.tenantId,
        customerId: params.customerId,
        amount: fromCents(amountCents),
        method: params.method ?? "EFECTIVO",
        paidAt: params.paidAt ?? new Date(),
        note: params.note,
        createdById: params.createdById,
      },
      select: { id: true },
    });

    let remainingCents = amountCents;
    const allocations: PaymentAllocationResult[] = [];

    for (const balance of balances) {
      if (remainingCents === 0) break;
      if (balance.outstanding <= 0) continue; // defensivo: un pedido ya saldado no debería estar abierto

      const appliedCents = Math.min(remainingCents, balance.outstanding);
      remainingCents -= appliedCents;
      const leftCents = balance.outstanding - appliedCents;

      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, orderId: balance.id, amount: fromCents(appliedCents) },
      });

      // Solo se cierra cuando el saldo llega exactamente a cero. El WHERE repite el estado
      // esperado (mismo patrón que markOrderPaid en resolve-order.ts): la transición es explícita
      // y no puede pisar un pedido que ya salió de PENDING_COLLECTION por otra vía.
      if (leftCents === 0) {
        await tx.order.updateMany({
          where: { id: balance.id, tenantId: params.tenantId, status: "PENDING_COLLECTION" },
          data: { status: "PAID" },
        });
      }

      allocations.push({
        orderId: balance.id,
        applied: fromCents(appliedCents),
        remaining: fromCents(leftCents),
        closed: leftCents === 0,
      });
    }

    return {
      paymentId: payment.id,
      allocations,
      ordersClosed: allocations.filter((a) => a.closed).length,
      outstandingAfter: fromCents(totalOutstanding - amountCents),
    };
  });
}

/** Cuánto se ha aplicado ya a cada pedido, en céntimos. Un pedido sin abonos no aparece en el mapa. */
async function sumAllocationsByOrder(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  orderIds: string[],
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();

  const grouped = await tx.paymentAllocation.groupBy({
    by: ["orderId"],
    where: { orderId: { in: orderIds } },
    _sum: { amount: true },
  });

  return new Map(grouped.map((g) => [g.orderId, toCents(g._sum.amount ?? 0)]));
}
