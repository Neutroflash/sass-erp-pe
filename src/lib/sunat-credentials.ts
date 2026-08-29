import type { PrismaClient } from "@prisma/client";
import { decryptSecret, decryptSecretString } from "./crypto";
import type { SunatCredentials } from "@/domain/invoicing/sunat/types";

/**
 * Server-only. Descifra las credenciales SUNAT de un tenant si las tiene configuradas —
 * `null` si le falta cualquiera de las cuatro piezas (RUC del propio Tenant, usuario/clave SOL,
 * certificado .pfx), no solo si no configuró nada: un negocio a medio configurar debe seguir
 * cayendo a `fakeInvoicingGateway`, nunca intentar un envío real con datos incompletos.
 */
export async function resolveSunatCredentials(prisma: PrismaClient, tenantId: string): Promise<SunatCredentials | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      ruc: true,
      sunatEnvironment: true,
      sunatSolUser: true,
      sunatSolPasswordEnc: true,
      sunatCertificateEnc: true,
      sunatCertificatePasswordEnc: true,
    },
  });

  if (
    !tenant?.ruc ||
    !tenant.sunatSolUser ||
    !tenant.sunatSolPasswordEnc ||
    !tenant.sunatCertificateEnc ||
    !tenant.sunatCertificatePasswordEnc
  ) {
    return null;
  }

  return {
    ruc: tenant.ruc,
    solUser: tenant.sunatSolUser,
    solPassword: decryptSecretString(Buffer.from(tenant.sunatSolPasswordEnc)),
    environment: tenant.sunatEnvironment,
    certificate: {
      pfxBuffer: decryptSecret(Buffer.from(tenant.sunatCertificateEnc)),
      password: decryptSecretString(Buffer.from(tenant.sunatCertificatePasswordEnc)),
    },
  };
}
