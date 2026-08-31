import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { parseTenantFeatures } from "@/domain/tenant-features";
import { generatePDFComprobante } from "./sunat/pdf";
import { buildInvoicePdfPayload } from "./sunat/build-payload";
import { extractDocumentDigestValue } from "./sunat/extract-digest";
import { sendInvoiceEmail } from "@/lib/email";

/**
 * Best-effort, nunca lanza — un fallo de envío no debe revertir ni bloquear una emisión que SUNAT
 * ya aceptó; el comprobante sigue disponible para descarga manual en `/panel/facturacion`. Se
 * llama tanto desde la emisión síncrona (`issueInvoiceForOrder`) como desde el retry asíncrono
 * (`sunat/retry.ts`) — es el único punto que decide si corresponde mandar el correo, para no
 * duplicar el chequeo de feature flag / tipo de documento / email del cliente en cada llamador.
 */
export async function notifyInvoiceIssued(prisma: PrismaClient, tenantId: string, invoiceId: string): Promise<void> {
  try {
    const invoice = await withTenantRLS(prisma, tenantId, (tx) =>
      tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          order: { select: { customerEmail: true, customerName: true } },
          tenant: { select: { ruc: true, businessName: true, fiscalAddress: true, features: true } },
        },
      }),
    );
    if (!invoice || invoice.status !== "ISSUED") return;
    // Mismo límite que /api/invoices/[id]/pdf: notas de crédito/débito no tienen plantilla de PDF.
    if (invoice.type !== "BOLETA" && invoice.type !== "FACTURA") return;
    if (!invoice.order?.customerEmail) return;
    if (!parseTenantFeatures(invoice.tenant.features).autoSendInvoiceEmail) return;

    const payload = buildInvoicePdfPayload(invoice, invoice.tenant);
    const documentDigest = invoice.signedXml ? extractDocumentDigestValue(invoice.signedXml) : "";
    const pdfBuffer = await generatePDFComprobante(payload, documentDigest);

    await sendInvoiceEmail({
      to: invoice.order.customerEmail,
      recipientName: invoice.order.customerName,
      businessName: invoice.tenant.businessName,
      invoiceLabel: `${invoice.series}-${invoice.number}`,
      pdfBuffer,
    });
    console.log(`[notify-invoice-issued] comprobante ${invoice.series}-${invoice.number} enviado a ${invoice.order.customerEmail}`);
  } catch (err) {
    console.error(`[notify-invoice-issued] no se pudo enviar el comprobante ${invoiceId} por correo:`, err);
  }
}
