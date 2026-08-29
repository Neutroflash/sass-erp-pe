import type { PrismaClient } from "@prisma/client";
import { fakeInvoicingGateway } from "@/domain/invoicing/fake-gateway";
import type { InvoicingGateway } from "@/domain/invoicing/gateway";
import { SunatInvoicingGateway } from "@/domain/invoicing/sunat/gateway";
import { resolveSunatCredentials } from "./sunat-credentials";

/**
 * Único punto que decide, por tenant, si un comprobante se emite de verdad contra SUNAT o con el
 * gateway simulado — ver el comentario en domain/invoicing/gateway.ts. Un tenant sin credenciales
 * SUNAT completas (ver resolveSunatCredentials) sigue usando `fakeInvoicingGateway`, exactamente
 * el mismo comportamiento que tenía antes de esta integración.
 */
export async function resolveInvoicingGateway(prisma: PrismaClient, tenantId: string): Promise<InvoicingGateway> {
  const credentials = await resolveSunatCredentials(prisma, tenantId);
  if (!credentials) return fakeInvoicingGateway;
  return new SunatInvoicingGateway(credentials);
}
