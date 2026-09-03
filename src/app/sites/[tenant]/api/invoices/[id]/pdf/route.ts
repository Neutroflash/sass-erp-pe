import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { generatePDFComprobante } from "@/domain/invoicing/sunat/pdf";
import { buildInvoicePdfPayload } from "@/domain/invoicing/sunat/build-payload";
import { extractDocumentDigestValue } from "@/domain/invoicing/sunat/extract-digest";

/**
 * Genera el PDF bajo demanda (nunca se almacena — ver el comentario en sunat/gateway.ts sobre por
 * qué `pdfUrl` siempre queda `null`) reconstruyendo el mismo `SunatInvoicePayload` que se usó para
 * armar el XML, a partir de lo ya guardado en `Invoice`/`InvoiceItem`. Solo Boleta/Factura por
 * ahora — una nota de crédito/débito necesitaría su propia representación (DiscrepancyResponse no
 * tiene sentido en la misma plantilla), no está cableada todavía.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const invoice = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.invoice.findFirst({
      where: { id: params.id, tenantId: auth.tenantId },
      include: { items: true, order: { select: { customerName: true } } },
    }),
  );
  if (!invoice) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }
  if (invoice.type !== "BOLETA" && invoice.type !== "FACTURA") {
    return NextResponse.json({ error: "La representación en PDF de notas de crédito/débito no está disponible todavía" }, { status: 501 });
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { ruc: true, businessName: true, fiscalAddress: true },
  });

  const payload = buildInvoicePdfPayload(invoice, tenant);
  // invoice.signedXml siempre está presente para BOLETA/FACTURA emitidas vía SunatInvoicingGateway
  // (se firma antes de enviar) — solo faltaría en un comprobante emitido por el gateway fake, que
  // en la práctica no llega a este punto en un negocio con SUNAT real configurado.
  const documentDigest = invoice.signedXml ? extractDocumentDigestValue(invoice.signedXml) : "";
  const pdfBuffer = await generatePDFComprobante(payload, documentDigest);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.series}-${invoice.number}.pdf"`,
    },
  });
}
