import type { Invoice, InvoiceItem } from "@prisma/client";
import { DOCUMENT_TYPE_CODE, type SunatDocumentTypeCode, type SunatInvoicePayload } from "./types";
import { toQty } from "@/domain/inventory/quantity";

const BUSINESS_DOCUMENT_TYPE_TO_SUNAT: Record<string, SunatDocumentTypeCode> = {
  DNI: DOCUMENT_TYPE_CODE.DNI,
  RUC: DOCUMENT_TYPE_CODE.RUC,
  CE: DOCUMENT_TYPE_CODE.CE,
  PASAPORTE: DOCUMENT_TYPE_CODE.PASAPORTE,
};

/**
 * Reconstruye el mismo `SunatInvoicePayload` usado para armar el XML original, a partir de lo ya
 * guardado en `Invoice`/`InvoiceItem` — usado tanto por la descarga bajo demanda
 * (`/api/invoices/[id]/pdf`) como por el envío automático por correo. Solo BOLETA/FACTURA: una
 * nota de crédito/débito necesitaría su propia representación (`DiscrepancyResponse` no tiene
 * sentido en esta plantilla), no está cableada todavía.
 */
export function buildInvoicePdfPayload(
  invoice: Invoice & { items: InvoiceItem[] },
  tenant: { ruc: string | null; businessName: string; fiscalAddress: string | null },
): SunatInvoicePayload {
  return {
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
      quantity: toQty(item.quantity),
      unitCode: item.unitCode,
      taxAffectationCode: item.taxAffectationCode,
      unitPriceWithTax: Number(item.unitPrice),
    })),
  };
}
