import type { PrismaClient, Prisma } from "@prisma/client";
import { resolveInvoicingGateway } from "@/lib/invoicing-gateway";
import { sunatRetryScheduler } from "@/lib/sunat-retry-queue";
import { withTenantRLS } from "@/lib/tenant-rls";
import { calculateTaxBreakdown, sumTaxBreakdowns } from "./tax";
import { RelatedInvoiceNotIssuedError, InvalidNoteReasonError } from "./errors";
import { reserveInvoiceNumber } from "./counter";
import { getTenantForInvoicing } from "./tenant-invoicing-info";
import { findNoteReason, resolveNoteSeries } from "./sunat/note-catalogs";
import { lineTotal, toQty } from "@/domain/inventory/quantity";
import { DEFAULT_UNIT_CODE } from "@/domain/inventory/units";
import { DEFAULT_TAX_AFFECTATION } from "./tax-affectation";

export interface IssueCreditDebitNoteParams {
  tenantId: string;
  relatedInvoiceId: string;
  type: "NOTA_CREDITO" | "NOTA_DEBITO";
  reasonCode: string;
  /**
   * FULL: la nota espeja exactamente los ítems/monto del comprobante original — el caso de
   * anulación total o devolución completa. CUSTOM: un solo ítem descriptivo por `customAmount` —
   * cubre ajustes/descuentos/cargos que no corresponden a una línea específica del original. No
   * hay selección de ítems parciales del original (ver docs/ROADMAP.md): un negocio que necesite
   * devolver 2 de 5 unidades de un ítem puntual usa CUSTOM con una descripción explicando qué se
   * devuelve, en vez de una UI de selección línea por línea.
   */
  mode: "FULL" | "CUSTOM";
  customAmount?: number;
  customDescription?: string;
}

/**
 * Mismo criterio que issue-invoice.ts: el correlativo se reserva antes de llamar al gateway, y no
 * corre todo dentro de un único `$transaction` por la misma razón (un PSE/SUNAT real necesita su
 * propio número para poder emitir el documento).
 */

/**
 * Afectación de una línea de ajuste CUSTOM, que no corresponde a ningún ítem del original.
 *
 * Si todo el comprobante corregido comparte una afectación, el ajuste hereda esa: un descuento
 * sobre una venta enteramente exonerada no puede llevar IGV. Si el original mezclaba afectaciones
 * no hay una respuesta correcta derivable — cae a gravado, el default de cualquier venta, y el
 * negocio corrige con una nota si hacía falta otra cosa.
 */
function adjustmentAffectation(items: { taxAffectationCode: string }[]): string {
  const codes = new Set(items.map((i) => i.taxAffectationCode));
  return codes.size === 1 ? [...codes][0] : DEFAULT_TAX_AFFECTATION;
}

export async function issueCreditDebitNoteForInvoice(prisma: PrismaClient, params: IssueCreditDebitNoteParams) {
  const relatedInvoice = await withTenantRLS(prisma, params.tenantId, (tx) =>
    tx.invoice.findFirst({
      where: { id: params.relatedInvoiceId, tenantId: params.tenantId },
      include: { items: true },
    }),
  );
  if (!relatedInvoice) {
    throw new Error("Comprobante no encontrado");
  }
  if (relatedInvoice.status !== "ISSUED") {
    throw new RelatedInvoiceNotIssuedError();
  }
  if (relatedInvoice.type !== "BOLETA" && relatedInvoice.type !== "FACTURA") {
    throw new RelatedInvoiceNotIssuedError("Una nota solo puede corregir una boleta o factura, no otra nota");
  }

  const reason = findNoteReason(params.type, params.reasonCode);
  if (!reason) {
    throw new InvalidNoteReasonError();
  }

  const tenant = await getTenantForInvoicing(prisma, params.tenantId);

  const items =
    params.mode === "FULL"
      ? relatedInvoice.items.map((item) => ({
          variantId: item.variantId,
          description: item.description,
          quantity: toQty(item.quantity),
          unitCode: item.unitCode,
          taxAffectationCode: item.taxAffectationCode,
          unitPrice: Number(item.unitPrice),
        }))
      : [
          {
            variantId: null as string | null,
            description: params.customDescription?.trim() || reason.label,
            quantity: 1,
            // Un ajuste que no mapea 1:1 con líneas del original se expresa como un concepto,
            // no como una medida: NIU es la unidad correcta para eso, no el metro del original.
            unitCode: DEFAULT_UNIT_CODE,
            taxAffectationCode: adjustmentAffectation(relatedInvoice.items),
            unitPrice: params.customAmount ?? 0,
          },
        ];

  const itemsWithTax = items.map((item) => {
    const itemTotal = lineTotal(item.quantity, item.unitPrice);
    const breakdown = calculateTaxBreakdown(itemTotal, item.taxAffectationCode);
    return { ...item, breakdown, igvAmount: breakdown.igvAmount, totalAmount: itemTotal };
  });

  const totalAmount = itemsWithTax.reduce((sum, i) => sum + i.totalAmount, 0);
  const noteBreakdown = sumTaxBreakdowns(itemsWithTax.map((i) => i.breakdown));

  const series = resolveNoteSeries(params.type, relatedInvoice.type);
  const number = await reserveInvoiceNumber(prisma, params.tenantId, params.type, series);

  const gateway = await resolveInvoicingGateway(prisma, params.tenantId);
  const result = await gateway.issueCreditDebitNote({
    tenantId: params.tenantId,
    type: params.type,
    series,
    number,
    reasonCode: params.reasonCode,
    reasonDescription: reason.label,
    relatedDocument: { type: relatedInvoice.type, series: relatedInvoice.series, number: relatedInvoice.number },
    documentType: relatedInvoice.documentType,
    documentNumber: relatedInvoice.documentNumber,
    businessName: relatedInvoice.businessName ?? undefined,
    items: itemsWithTax.map((i) => ({
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

  const note = await withTenantRLS(prisma, params.tenantId, (tx) =>
    tx.invoice.create({
      data: {
        tenantId: params.tenantId,
        orderId: null, // una nota no reclama el orderId único del pedido — ese ya lo tiene el comprobante original
        relatedInvoiceId: relatedInvoice.id,
        type: params.type,
        status: result.status,
        series,
        number,
        documentType: relatedInvoice.documentType,
        documentNumber: relatedInvoice.documentNumber,
        businessName: relatedInvoice.businessName,
        taxedAmount: noteBreakdown.taxedAmount,
        exemptAmount: noteBreakdown.exemptAmount,
        unaffectedAmount: noteBreakdown.unaffectedAmount,
        igvAmount: noteBreakdown.igvAmount,
        totalAmount,
        pdfUrl: result.pdfUrl,
        xmlUrl: result.xmlUrl,
        signedXml: result.signedXml,
        providerResponse: result.raw as unknown as Prisma.InputJsonValue,
        issuedAt: result.status === "ISSUED" ? new Date() : null,
        items: {
          create: itemsWithTax.map((i) => ({
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

  if (result.status === "PENDING_SUNAT") {
    await sunatRetryScheduler.schedule(note.id);
  }

  return note;
}
