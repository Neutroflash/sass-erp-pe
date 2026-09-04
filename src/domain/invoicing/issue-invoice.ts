import type { PrismaClient, Prisma } from "@prisma/client";
import { resolveInvoicingGateway } from "@/lib/invoicing-gateway";
import { sunatRetryScheduler } from "@/lib/sunat-retry-queue";
import { withTenantRLS } from "@/lib/tenant-rls";
import { calculateTaxBreakdown, sumTaxBreakdowns } from "./tax";
import { OrderNotPaidError, InvoiceAlreadyIssuedError } from "./errors";
import { reserveInvoiceNumber } from "./counter";
import { getTenantForInvoicing } from "./tenant-invoicing-info";
import { notifyInvoiceIssued } from "./notify-invoice-issued";
import { lineTotal, toQty } from "@/domain/inventory/quantity";

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
  const order = await withTenantRLS(prisma, params.tenantId, (tx) =>
    tx.order.findFirst({
      where: { id: params.orderId, tenantId: params.tenantId },
      include: { items: { include: { variant: { select: { name: true, sku: true, unitCode: true, taxAffectationCode: true } } } }, invoice: true },
    }),
  );
  if (!order) {
    throw new Error("Orden no encontrada");
  }
  // PENDING_COLLECTION cuenta igual que PAID: en una venta a crédito la obligación tributaria
  // nace con la ENTREGA, no con el cobro. El comprobante sale al entregar, con el saldo abierto, y
  // los abonos posteriores no lo modifican ni generan notas.
  if (order.status !== "PAID" && order.status !== "PENDING_COLLECTION") {
    throw new OrderNotPaidError();
  }
  if (order.invoice) {
    throw new InvoiceAlreadyIssuedError();
  }

  const tenant = await getTenantForInvoicing(prisma, params.tenantId);

  const totalAmount = Number(order.totalAmount);

  const items = order.items.map((item) => {
    const itemTotal = lineTotal(item.quantity, item.price);
    const breakdown = calculateTaxBreakdown(itemTotal, item.variant.taxAffectationCode);
    return {
      variantId: item.variantId,
      description: `${item.variant.name} (${item.variant.sku})`,
      quantity: toQty(item.quantity),
      // La unidad y la afectación se copian del producto y quedan congeladas acá: el comprobante
      // debe seguir diciendo lo mismo que se le envió a SUNAT aunque el producto cambie después.
      unitCode: item.variant.unitCode,
      taxAffectationCode: item.variant.taxAffectationCode,
      unitPrice: Number(item.price),
      breakdown,
      igvAmount: breakdown.igvAmount,
      totalAmount: itemTotal,
    };
  });

  // La cabecera se arma sumando las líneas, no descomponiendo `order.totalAmount`: con
  // afectaciones mezcladas no hay una sola tasa que aplicarle al total, y aun con todo gravado la
  // suma de líneas es lo que SUNAT contrasta contra el XML (que se arma exactamente así). Puede
  // diferir un céntimo de `totalAmount` por redondeo de línea — `totalAmount` sigue siendo lo que
  // el cliente pagó, y es el que se guarda como tal.
  const orderBreakdown = sumTaxBreakdowns(items.map((i) => i.breakdown));

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
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitCode: i.unitCode,
      taxAffectationCode: i.taxAffectationCode,
      unitPrice: i.unitPrice,
    })),
    totalAmount,
    emisorRuc: tenant.ruc ?? undefined,
    emisorBusinessName: tenant.businessName,
    emisorAddress: tenant.fiscalAddress ?? undefined,
  });

  const invoice = await withTenantRLS(prisma, params.tenantId, (tx) =>
    tx.invoice.create({
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
            unitCode: i.unitCode,
            taxAffectationCode: i.taxAffectationCode,
            unitPrice: i.unitPrice,
            igvAmount: i.igvAmount,
            totalAmount: i.totalAmount,
          })),
        },
      },
      include: { items: true },
    }),
  );

  // SUNAT no respondió (no es un rechazo) — el documento ya está firmado y guardado, solo falta
  // reintentar la conexión. Nunca se vuelve a firmar ni a reservar un número nuevo en el retry.
  if (result.status === "PENDING_SUNAT") {
    await sunatRetryScheduler.schedule(invoice.id);
  } else if (result.status === "ISSUED") {
    await notifyInvoiceIssued(prisma, params.tenantId, invoice.id);
  }

  return invoice;
}
