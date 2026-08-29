import type { PrismaClient, Prisma } from "@prisma/client";
import { resolveInvoicingGateway } from "@/lib/invoicing-gateway";
import { sunatRetryScheduler } from "@/lib/sunat-retry-queue";
import { calculateTaxBreakdown } from "./tax";
import { OrderNotPaidError, InvoiceAlreadyIssuedError } from "./errors";
import { reserveInvoiceNumber } from "./counter";
import { getTenantForInvoicing } from "./tenant-invoicing-info";

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

  const tenant = await getTenantForInvoicing(prisma, params.tenantId);

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

  const series = SERIES[params.type];
  const number = await reserveInvoiceNumber(prisma, params.tenantId, params.type, series);

  const gateway = await resolveInvoicingGateway(prisma, params.tenantId);
  const result = await gateway.issueInvoice({
    tenantId: params.tenantId,
    type: params.type,
    series,
    number,
    documentType: params.documentType,
    documentNumber: params.documentNumber,
    businessName: params.businessName,
    items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    totalAmount,
    emisorRuc: tenant.ruc ?? undefined,
    emisorBusinessName: tenant.businessName,
    emisorAddress: tenant.fiscalAddress ?? undefined,
  });

  const invoice = await prisma.invoice.create({
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
      signedXml: result.signedXml,
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

  // SUNAT no respondió (no es un rechazo) — el documento ya está firmado y guardado, solo falta
  // reintentar la conexión. Nunca se vuelve a firmar ni a reservar un número nuevo en el retry.
  if (result.status === "PENDING_SUNAT") {
    await sunatRetryScheduler.schedule(invoice.id);
  }

  return invoice;
}
