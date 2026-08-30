import type { PrismaClient } from "@prisma/client";
import { checkTicketStatus } from "./gre-client";
import { resolveGreCredentials } from "@/lib/gre-credentials";
import { greTicketScheduler } from "@/lib/gre-ticket-queue";

const MAX_ATTEMPTS = 6; // 30s, 60s, 2min, 4min, 8min, 16min — ~30min de ventana total

/**
 * Idempotente: si la guía ya salió de PENDING_SUNAT (por otra corrida de este mismo job, no
 * debería pasar por el jobId único, pero por las dudas) es un no-op.
 */
export async function resolveDispatchGuideTicket(prisma: PrismaClient, dispatchGuideId: string, attempt = 0): Promise<void> {
  const guide = await prisma.dispatchGuide.findUnique({ where: { id: dispatchGuideId } });
  if (!guide || guide.status !== "PENDING_SUNAT" || !guide.numTicket) return;

  const credentials = await resolveGreCredentials(prisma, guide.tenantId);
  if (!credentials) return; // el tenant borró sus credenciales entre medio — nada que consultar

  const status = await checkTicketStatus(guide.numTicket, credentials.gre);

  if (status.state === "PENDING") {
    if (attempt + 1 < MAX_ATTEMPTS) {
      await greTicketScheduler.schedule(guide.id, attempt + 1);
    } else {
      // Se agotó la ventana de reintentos — queda PENDING_SUNAT visible para revisar a mano
      // (mismo criterio que boletas/facturas: no insistir indefinidamente).
      console.error(`[gre-ticket] guía ${guide.id}: ticket ${guide.numTicket} sigue "en proceso" tras ${MAX_ATTEMPTS} consultas`);
    }
    return;
  }

  if (status.state === "ISSUED") {
    await prisma.dispatchGuide.update({
      where: { id: guide.id },
      data: { status: "ISSUED", issuedAt: new Date(), sunatResponseCode: "0" },
    });
    return;
  }

  await prisma.dispatchGuide.update({
    where: { id: guide.id },
    data: { status: "FAILED", sunatResponseCode: status.errorCode, sunatDescription: status.errorDescription },
  });
}
