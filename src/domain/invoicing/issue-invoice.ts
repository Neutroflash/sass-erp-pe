import type { PrismaClient, Prisma } from "@prisma/client";
import { invoicingGateway } from "@/lib/invoicing-gateway";
import { calculateTaxBreakdown } from "./tax";
import { OrderNotPaidError, InvoiceAlreadyIssuedError, InvoicePlanLimitError } from "./errors";
import { resolvePlanLimits, startOfCurrentMonth } from "@/domain/plan-limits";

const SERIES: Record<"BOLETA" | "FACTURA", string> = { BOLETA: "B001", FACTURA: "F001" };

export interface IssueInvoiceParams {
  tenantId: string;
  orderId: string;
  type: "BOLETA" | "FACTURA";
  documentType: string;
  documentNumber: string;
  businessName?: string;
}

/**
 * No corre dentro de un único `$transaction` de punta a punta a propósito: el correlativo se
 * reserva ANTES de llamar al gateway porque un PSE real necesita su propio número para emitir el
 * documento (no se le puede asignar después). Si `gateway.issueInvoice` o el guardado fallaran
 * tras reservar, ese número queda quemado — mismo criterio que Flashkings (`PrismaInvoiceRepository`):
 * es la misma realidad que cualquier punto de venta físico, un número usado se anula, no se
 * reutiliza.
 */
export async function issueInvoiceForOrder(prisma: PrismaClient, params: IssueInvoiceParams) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, tenantId: params.tenantId },
    include: { items: { include: { variant: { select: { name: true, sku: true } } } }, invoice: true },
  });
  if (!order) {
    throw new Error("Orden no encontrada");
  }
  if (order.status !== "PAID") {
    throw new OrderNotPaidError();
  }
  if (order.invoice) {
    throw new InvoiceAlreadyIssuedError();
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: params.tenantId },
    select: { planTier: true, planProductLimit: true, planInvoiceLimit: true },
  });
  const { invoiceLimit } = resolvePlanLimits(tenant);
  if (invoiceLimit !== null) {
    const issuedThisMonth = await prisma.invoice.count({
      where: { tenantId: params.tenantId, createdAt: { gte: startOfCurrentMonth() } },
    });
    if (issuedThisMonth >= invoiceLimit) {
      throw new InvoicePlanLimitError(
        `Alcanzaste el límite de ${invoiceLimit} comprobantes este mes en tu plan (${tenant.planTier}). Sube de plan para emitir más.`,
      );
    }
  }

  const totalAmount = Number(order.totalAmount);
  const orderBreakdown = calculateTaxBreakdown(totalAmount);

  const items = order.items.map((item) => {
    const itemTotal = Number(item.price) * item.quantity;
    const { igvAmount } = calculateTaxBreakdown(itemTotal);
    return {
      variantId: item.variantId,
      description: `${item.variant.name} (${item.variant.sku})`,
      quantity: item.quantity,
      unitPrice: Number(item.price),
      igvAmount,
      totalAmount: itemTotal,
    };
  });

  // upsert+increment sobre la clave compuesta (tenantId, type) — mismo mecanismo que
  // Flashkings, con la clave compuesta agregada para que cada negocio numere sus boletas/facturas
  // de forma independiente (B001-1/F001-1 por tenant, no globalmente).
  const counter = await prisma.invoiceCounter.upsert({
    where: { tenantId_type: { tenantId: params.tenantId, type: params.type } },
    create: { tenantId: params.tenantId, type: params.type, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const series = SERIES[params.type];
  const number = counter.lastNumber;

  const result = await invoicingGateway.issueInvoice({
    tenantId: params.tenantId,
    type: params.type,
    series,
    number,
    documentType: params.documentType,
    documentNumber: params.documentNumber,
    businessName: params.businessName,
    items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    totalAmount,
  });

  return prisma.invoice.create({
    data: {
      tenantId: params.tenantId,
      orderId: order.id,
      type: params.type,
      status: result.status,
      series,
      number,
      documentType: params.documentType,
      documentNumber: params.documentNumber,
      businessName: params.businessName,
      taxedAmount: orderBreakdown.taxedAmount,
      exemptAmount: orderBreakdown.exemptAmount,
      unaffectedAmount: orderBreakdown.unaffectedAmount,
      igvAmount: orderBreakdown.igvAmount,
      totalAmount,
      pdfUrl: result.pdfUrl,
      xmlUrl: result.xmlUrl,
      providerResponse: result.raw as unknown as Prisma.InputJsonValue,
      issuedAt: result.status === "ISSUED" ? new Date() : null,
      items: {
        create: items.map((i) => ({
          variantId: i.variantId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          igvAmount: i.igvAmount,
          totalAmount: i.totalAmount,
        })),
      },
    },
    include: { items: true },
  });
}
