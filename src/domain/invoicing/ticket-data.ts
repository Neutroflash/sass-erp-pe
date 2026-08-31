import type { PrismaClient } from "@prisma/client";
import { buildInvoicePdfPayload } from "./sunat/build-payload";
import { extractDocumentDigestValue } from "./sunat/extract-digest";
import { buildQrContent } from "./sunat/qr";
import { montoEnLetras } from "./sunat/amount-to-words";
import type { TicketComprobanteData } from "@/types/ticket";

/**
 * Compartido entre `/api/invoices/[id]/ticket-data` (JSON, por si algún consumidor externo lo
 * necesita) y la página del panel (Server Component que llama esto directamente, sin un
 * round-trip HTTP interno — mismo patrón que el resto de páginas de `/panel/**`, que consultan
 * Prisma de punta a punta en vez de auto-fetchear su propia API). `null` si el comprobante no
 * existe, es una nota, o no está ISSUED — el llamador decide cómo responder a cada caso.
 */
export async function buildTicketComprobanteData(
  prisma: PrismaClient,
  tenantId: string,
  invoiceId: string,
): Promise<TicketComprobanteData | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { items: true, order: { select: { customerName: true } } },
  });
  if (!invoice) return null;
  if (invoice.type !== "BOLETA" && invoice.type !== "FACTURA") return null;
  if (invoice.status !== "ISSUED") return null;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { ruc: true, businessName: true, fiscalAddress: true },
  });

  const payload = buildInvoicePdfPayload(invoice, tenant);
  // invoice.signedXml siempre está presente para un comprobante ISSUED vía SunatInvoicingGateway
  // (se firma antes de enviar) — solo faltaría con el gateway fake.
  const documentDigest = invoice.signedXml ? extractDocumentDigestValue(invoice.signedXml) : "";
  const qrContent = buildQrContent(payload, documentDigest);

  return {
    emisor: { businessName: tenant.businessName, ruc: tenant.ruc ?? "", address: tenant.fiscalAddress ?? "" },
    comprobante: {
      tipo: invoice.type,
      serie: invoice.series,
      numero: invoice.number,
      fechaEmision: (invoice.issuedAt ?? invoice.createdAt).toISOString(),
    },
    cliente: {
      // Razón social si es factura; si es boleta (sin businessName), el nombre real del cliente
      // de la orden — nunca el número de documento como fallback de "nombre".
      nombre: invoice.businessName ?? invoice.order?.customerName ?? invoice.documentNumber,
      documentoTipo: invoice.documentType,
      documentoNumero: invoice.documentNumber,
    },
    // "medio" se omite a propósito: no hay una columna que registre por qué canal se confirmó el
    // pago (manual vs. Izipay) — nunca se inventa un dato que no se tiene.
    pago: { forma: "CONTADO" },
    items: invoice.items.map((item) => ({
      cantidad: item.quantity,
      descripcion: item.description,
      precioUnitario: Number(item.unitPrice),
      importe: Number(item.totalAmount),
    })),
    totales: {
      opGravada: Number(invoice.taxedAmount),
      igv: Number(invoice.igvAmount),
      opExonerada: Number(invoice.exemptAmount),
      opInafecta: Number(invoice.unaffectedAmount),
      total: Number(invoice.totalAmount),
      montoEnLetras: montoEnLetras(Number(invoice.totalAmount)),
    },
    qrContent,
    hash: documentDigest,
  };
}
