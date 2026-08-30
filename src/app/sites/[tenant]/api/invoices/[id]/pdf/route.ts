import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { generatePDFComprobante } from "@/domain/invoicing/sunat/pdf";
import { DOCUMENT_TYPE_CODE, type SunatDocumentTypeCode, type SunatInvoicePayload } from "@/domain/invoicing/sunat/types";

const BUSINESS_DOCUMENT_TYPE_TO_SUNAT: Record<string, SunatDocumentTypeCode> = {
  DNI: DOCUMENT_TYPE_CODE.DNI,
  RUC: DOCUMENT_TYPE_CODE.RUC,
  CE: DOCUMENT_TYPE_CODE.CE,
  PASAPORTE: DOCUMENT_TYPE_CODE.PASAPORTE,
};

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

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, tenantId: auth.tenantId },
    include: { items: true },
  });
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

  const payload: SunatInvoicePayload = {
    tipoDocumento: invoice.type === "FACTURA" ? "01" : "03",
    serie: invoice.series,
    numero: invoice.number,
    fechaEmision: invoice.issuedAt ?? invoice.createdAt,
    emisor: { ruc: tenant.ruc ?? "", businessName: tenant.businessName, address: tenant.fiscalAddress ?? undefined },
    cliente: {
      documentTypeCode: BUSINESS_DOCUMENT_TYPE_TO_SUNAT[invoice.documentType] ?? DOCUMENT_TYPE_CODE.SIN_DOCUMENTO,
      documentNumber: invoice.documentNumber,
      name: invoice.businessName ?? invoice.documentNumber,
    },
    lineas: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceWithTax: Number(item.unitPrice),
    })),
  };

  const pdfBuffer = await generatePDFComprobante(payload);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.series}-${invoice.number}.pdf"`,
    },
  });
}
