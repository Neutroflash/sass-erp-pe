import type { Complaint, PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { sendComplaintReceiptEmail, sendComplaintNotificationEmail } from "@/lib/email";

/**
 * Best-effort, nunca lanza — un fallo de envío no debe impedir que el reclamo quede registrado
 * (ya se creó en submit-complaint.ts). Mismo criterio que notify-invoice-issued.ts.
 */
export async function notifyComplaintSubmitted(prisma: PrismaClient, tenantId: string, complaint: Complaint): Promise<void> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { businessName: true } });
    if (!tenant) return;

    await sendComplaintReceiptEmail({
      to: complaint.consumerEmail,
      recipientName: complaint.consumerName,
      businessName: tenant.businessName,
      folio: complaint.folio,
      type: complaint.type,
    });

    const owners = await withTenantRLS(prisma, tenantId, (tx) =>
      tx.user.findMany({ where: { tenantId, role: "OWNER" }, select: { email: true, name: true } }),
    );
    for (const owner of owners) {
      await sendComplaintNotificationEmail({
        to: owner.email,
        recipientName: owner.name,
        businessName: tenant.businessName,
        folio: complaint.folio,
        type: complaint.type,
        consumerName: complaint.consumerName,
        detail: complaint.detail,
      });
    }
  } catch (err) {
    console.error(`[notify-complaint-submitted] no se pudo notificar el reclamo ${complaint.id}:`, err);
  }
}
