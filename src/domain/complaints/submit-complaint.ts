import type { ComplaintType, PrismaClient } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";

export interface SubmitComplaintInput {
  type: ComplaintType;
  consumerName: string;
  consumerDocType: string;
  consumerDocNumber: string;
  consumerAddress: string;
  consumerPhone?: string;
  consumerEmail: string;
  productDescription: string;
  claimedAmount?: number;
  purchaseDate?: Date;
  detail: string;
  request: string;
}

/**
 * Folio correlativo por tenant (Tenant.complaintCounter) — mismo mecanismo que
 * reserveInvoiceNumber (domain/invoicing/counter.ts): increment atómico de Prisma, sin lock
 * manual, porque acá no hace falta reservar el número ANTES de una llamada externa (a diferencia
 * de SUNAT) — todo pasa dentro de esta única transacción.
 */
export async function submitComplaint(prisma: PrismaClient, tenantId: string, input: SubmitComplaintInput) {
  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, tenantId);

    const tenant = await tx.tenant.update({
      where: { id: tenantId },
      data: { complaintCounter: { increment: 1 } },
      select: { complaintCounter: true },
    });

    return tx.complaint.create({
      data: { tenantId, folio: tenant.complaintCounter, ...input },
    });
  });
}
