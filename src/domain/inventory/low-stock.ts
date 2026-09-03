import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { sendLowStockDigestEmail } from "@/lib/email";
import { subQty } from "./quantity";

export interface LowStockVariant {
  sku: string;
  name: string;
  available: number;
  unitCode: string;
  threshold: number;
}

/**
 * "Disponible" = stock - reservedStock, mismo cálculo que `inStock` en `toPublicProduct` — una
 * unidad reservada por un checkout en curso no cuenta como disponible para reponer.
 */
export async function getLowStockVariants(prisma: PrismaClient, tenantId: string, threshold: number): Promise<LowStockVariant[]> {
  const variants = await withTenantRLS(prisma, tenantId, (tx) =>
    tx.productVariant.findMany({
      where: { tenantId },
      select: { sku: true, name: true, stock: true, reservedStock: true, unitCode: true },
    }),
  );
  return variants
    .map((v) => ({ sku: v.sku, name: v.name, available: subQty(v.stock, v.reservedStock), unitCode: v.unitCode, threshold }))
    .filter((v) => v.available <= threshold)
    .sort((a, b) => a.available - b.available);
}

/**
 * Un correo por negocio (no por variante — evita mandar 10 correos si 10 SKUs bajan a la vez el
 * mismo día), a cada `User` con rol OWNER. Nunca lanza: un fallo de envío para un tenant no debe
 * frenar el resto del recorrido (mismo criterio best-effort que `notifyInvoiceIssued`).
 */
export async function runLowStockDigest(prisma: PrismaClient): Promise<number> {
  const tenants = await prisma.tenant.findMany({
    where: { lowStockThreshold: { not: null } },
    select: { id: true, businessName: true, lowStockThreshold: true },
  });

  let notified = 0;
  for (const tenant of tenants) {
    try {
      const threshold = tenant.lowStockThreshold!;
      const lowStock = await getLowStockVariants(prisma, tenant.id, threshold);
      if (lowStock.length === 0) continue;

      const owners = await withTenantRLS(prisma, tenant.id, (tx) =>
        tx.user.findMany({ where: { tenantId: tenant.id, role: "OWNER" }, select: { email: true, name: true } }),
      );
      for (const owner of owners) {
        await sendLowStockDigestEmail({ to: owner.email, recipientName: owner.name, businessName: tenant.businessName, items: lowStock });
      }
      notified++;
    } catch (err) {
      console.error(`[low-stock] no se pudo procesar el negocio ${tenant.id}:`, err);
    }
  }
  return notified;
}
