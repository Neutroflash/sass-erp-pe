import type { PrismaClient } from "@prisma/client";
import { resolveSunatCredentials } from "./sunat-credentials";
import { decryptSecretString } from "./crypto";
import type { GreCredentials } from "@/domain/dispatch-guides/gre-client";
import type { SunatCertificateConfig } from "@/domain/invoicing/sunat/types";

export interface ResolvedGreCredentials {
  gre: GreCredentials;
  certificate: SunatCertificateConfig;
}

/**
 * Requiere las credenciales SUNAT base (SOL + certificado, para firmar) Y el par OAuth2 de la API
 * GRE — ambas piezas completas, o `null`. Mismo criterio que `resolveSunatCredentials`: un negocio
 * a medio configurar no debe intentar un envío real con datos incompletos.
 */
export async function resolveGreCredentials(prisma: PrismaClient, tenantId: string): Promise<ResolvedGreCredentials | null> {
  const sunat = await resolveSunatCredentials(prisma, tenantId);
  if (!sunat) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { sunatGreClientId: true, sunatGreClientSecretEnc: true },
  });
  if (!tenant?.sunatGreClientId || !tenant.sunatGreClientSecretEnc) return null;

  return {
    gre: {
      ruc: sunat.ruc,
      solUser: sunat.solUser,
      solPassword: sunat.solPassword,
      clientId: tenant.sunatGreClientId,
      clientSecret: decryptSecretString(Buffer.from(tenant.sunatGreClientSecretEnc)),
    },
    certificate: sunat.certificate,
  };
}
