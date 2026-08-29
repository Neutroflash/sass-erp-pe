import type { PrismaClient, Prisma } from "@prisma/client";
import { resolveSunatCredentials } from "@/lib/sunat-credentials";
import { sunatRetryScheduler } from "@/lib/sunat-retry-queue";
import { sendToSunat } from "./soap-client";
import { SUNAT_DOCUMENT_TYPE_CODE } from "./types";

/**
 * Reintenta un envío que quedó en PENDING_SUNAT — reenvía el `signedXml` ya persistido tal cual
 * está, nunca lo vuelve a generar ni a firmar (el documento ya es válido; lo que falló fue la
 * disponibilidad de SUNAT, no el contenido). Idempotente: si la orden entre medio pasó a
 * ISSUED/FAILED por otra vía, es un no-op.
 */
export async function retryPendingSunatInvoice(prisma: PrismaClient, invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status !== "PENDING_SUNAT" || !invoice.signedXml) return;

  const credentials = await resolveSunatCredentials(prisma, invoice.tenantId);
  if (!credentials) return; // el tenant borró sus credenciales entre medio — nada que reintentar

  const fileName = `${credentials.ruc}-${SUNAT_DOCUMENT_TYPE_CODE[invoice.type]}-${invoice.series}-${invoice.number}`;
  const result = await sendToSunat(invoice.signedXml, credentials, fileName);

  if (result.transient) {
    const nextAttempt = invoice.sunatRetryCount + 1;
    const maxAttempts = Number(process.env.SUNAT_RETRY_MAX_ATTEMPTS ?? 5);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { sunatRetryCount: nextAttempt } });
    // Se agotaron los reintentos automáticos — queda PENDING_SUNAT visible en /panel/facturacion
    // para que el OWNER lo reintente a mano más tarde, en vez de seguir insistiendo indefinidamente.
    if (nextAttempt < maxAttempts) {
      await sunatRetryScheduler.schedule(invoice.id, nextAttempt);
    }
    return;
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: result.accepted ? "ISSUED" : "FAILED",
      issuedAt: result.accepted ? new Date() : null,
      providerResponse: { responseCode: result.responseCode, description: result.description } as unknown as Prisma.InputJsonValue,
    },
  });
}
