import type { PrismaClient, InvoiceType } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";

/**
 * upsert+increment atómico sobre la clave compuesta (tenantId, type, series) — mismo mecanismo
 * que Flashkings. `series` es parte de la clave (no solo `type`) porque una nota de crédito/débito
 * puede tener más de una serie posible según qué corrija (FC01 vs BC01) — ver el comentario en
 * schema.prisma sobre InvoiceCounter. Compartido entre issue-invoice.ts e issue-note.ts para que
 * ambos reserven correlativos exactamente de la misma forma.
 */
export async function reserveInvoiceNumber(prisma: PrismaClient, tenantId: string, type: InvoiceType, series: string): Promise<number> {
  const counter = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.invoiceCounter.upsert({
      where: { tenantId_type_series: { tenantId, type, series } },
      create: { tenantId, type, series, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    }),
  );
  return counter.lastNumber;
}
