import type { PrismaClient } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";

/**
 * La norma da 30 días calendario para responder (Código de Protección al Consumidor, Art. 24) —
 * este código no impone ese plazo (no hay forma de "bloquear" una respuesta tardía, solo se
 * registra `respondedAt` para que el negocio pueda demostrar cuándo respondió si lo audita
 * INDECOPI). `null` si el reclamo no existe o no pertenece a este tenant.
 */
export async function respondToComplaint(prisma: PrismaClient, tenantId: string, complaintId: string, response: string) {
  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, tenantId);

    const result = await tx.complaint.updateMany({
      where: { id: complaintId, tenantId },
      data: { response, status: "RESOLVED", respondedAt: new Date() },
    });
    return result.count > 0;
  });
}
