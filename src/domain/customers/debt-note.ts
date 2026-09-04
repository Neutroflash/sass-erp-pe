import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { fromCents, toCents } from "@/domain/payments/money";
import { formatNumeroComprobante } from "@/domain/invoicing/comprobante-number";

/**
 * "Nota de deuda": el papel que el negocio le deja a quien le queda debiendo.
 *
 * Lo pidió así — «es como una boleta por pagar»— y ahí está justamente el riesgo. **No es un
 * comprobante de pago.** Si sale con la pinta de una boleta, quien la recibe va a creer que le
 * dieron comprobante y el negocio va a creer que ya declaró esa venta; los dos se equivocan y el
 * error aparece recién en una fiscalización.
 *
 * Por eso este documento no lleva serie fiscal, ni QR, ni la palabra "boleta", y sí lleva la
 * referencia a los comprobantes que SÍ se emitieron por esas ventas. Es un estado de cuenta entre
 * el negocio y su cliente, y tiene que leerse como tal.
 */

export interface DebtNoteLine {
  orderId: string;
  date: Date;
  total: number;
  paid: number;
  balance: number;
  dueDate: Date | null;
  overdue: boolean;
  /** Número del comprobante emitido por esa venta, si lo hubo — "B001-00000012". */
  comprobante: string | null;
}

export interface DebtNoteData {
  emisor: {
    businessName: string;
    ruc: string | null;
    address: string | null;
    phone: string | null;
  };
  cliente: {
    name: string;
    address: string | null;
    phone: string | null;
    docType: string | null;
    docNumber: string | null;
  };
  lines: DebtNoteLine[];
  total: number;
  overdueTotal: number;
  /** Momento en que se imprimió: un saldo sin fecha no significa nada dentro de una semana. */
  issuedAt: Date;
}

export async function buildDebtNote(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string,
  now = new Date(),
): Promise<DebtNoteData | null> {
  const [tenant, customer] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessName: true, ruc: true, fiscalAddress: true, whatsappNumber: true },
    }),
    withTenantRLS(prisma, tenantId, (tx) =>
      tx.customer.findFirst({
        where: { id: customerId, tenantId },
        include: {
          orders: {
            where: { status: "PENDING_COLLECTION" },
            orderBy: { createdAt: "asc" },
            include: {
              paymentAllocations: { select: { amount: true } },
              invoice: { select: { series: true, number: true, status: true } },
            },
          },
        },
      }),
    ),
  ]);

  if (!tenant || !customer) return null;

  let totalCents = 0;
  let overdueCents = 0;

  const lines: DebtNoteLine[] = [];
  for (const order of customer.orders) {
    const paidCents = order.paymentAllocations.reduce((sum, a) => sum + toCents(a.amount), 0);
    const balanceCents = toCents(order.totalAmount) - paidCents;
    if (balanceCents <= 0) continue;

    const overdue = order.dueDate !== null && order.dueDate < now;
    totalCents += balanceCents;
    if (overdue) overdueCents += balanceCents;

    lines.push({
      orderId: order.id,
      date: order.createdAt,
      total: Number(order.totalAmount),
      paid: fromCents(paidCents),
      balance: fromCents(balanceCents),
      dueDate: order.dueDate,
      overdue,
      // Solo un comprobante ACEPTADO cuenta como referencia: uno rechazado o pendiente de envío
      // no le sirve de respaldo a nadie, y citarlo daría una seguridad que no existe.
      comprobante:
        order.invoice && order.invoice.status === "ISSUED"
          ? formatNumeroComprobante(order.invoice.series, order.invoice.number)
          : null,
    });
  }

  return {
    emisor: {
      businessName: tenant.businessName,
      ruc: tenant.ruc,
      address: tenant.fiscalAddress,
      phone: tenant.whatsappNumber,
    },
    cliente: {
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      docType: customer.docType,
      docNumber: customer.docNumber,
    },
    lines,
    total: fromCents(totalCents),
    overdueTotal: fromCents(overdueCents),
    issuedAt: now,
  };
}
