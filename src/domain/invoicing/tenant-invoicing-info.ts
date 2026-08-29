import type { PrismaClient, PlanTier } from "@prisma/client";
import { resolvePlanLimits, startOfCurrentMonth } from "@/domain/plan-limits";
import { InvoicePlanLimitError } from "./errors";

export interface TenantInvoicingInfo {
  planTier: PlanTier;
  ruc: string | null;
  businessName: string;
  fiscalAddress: string | null;
}

/**
 * Datos del emisor + chequeo del límite mensual de comprobantes del plan — compartido entre
 * issue-invoice.ts e issue-note.ts porque una nota de crédito/débito consume el mismo cupo que
 * una boleta/factura (ambas son "comprobantes emitidos" para SUNAT), y el conteo ya cuenta
 * cualquier fila de `Invoice` sin importar el `type`, así que basta un solo chequeo compartido.
 */
export async function getTenantForInvoicing(prisma: PrismaClient, tenantId: string): Promise<TenantInvoicingInfo> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { planTier: true, planProductLimit: true, planInvoiceLimit: true, ruc: true, businessName: true, fiscalAddress: true },
  });

  const { invoiceLimit } = resolvePlanLimits(tenant);
  if (invoiceLimit !== null) {
    const issuedThisMonth = await prisma.invoice.count({
      where: { tenantId, createdAt: { gte: startOfCurrentMonth() } },
    });
    if (issuedThisMonth >= invoiceLimit) {
      throw new InvoicePlanLimitError(
        `Alcanzaste el límite de ${invoiceLimit} comprobantes este mes en tu plan (${tenant.planTier}). Sube de plan para emitir más.`,
      );
    }
  }

  return tenant;
}
