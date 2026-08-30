import type { PrismaClient } from "@prisma/client";
import { decryptSecretString } from "./crypto";
import type { IzipayCredentials } from "@/domain/payments/izipay-gateway";

/**
 * Server-only. Mismo criterio que `resolveSunatCredentials`: `null` si falta cualquiera de las
 * cuatro piezas, no solo si no configuró nada — un negocio a medio configurar no debe intentar un
 * pago real con datos incompletos.
 */
export async function resolveIzipayCredentials(prisma: PrismaClient, tenantId: string): Promise<IzipayCredentials | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { izipayUsername: true, izipayPasswordEnc: true, izipayPublicKey: true, izipayHmacKeyEnc: true },
  });

  if (!tenant?.izipayUsername || !tenant.izipayPasswordEnc || !tenant.izipayPublicKey || !tenant.izipayHmacKeyEnc) {
    return null;
  }

  return {
    username: tenant.izipayUsername,
    password: decryptSecretString(Buffer.from(tenant.izipayPasswordEnc)),
    publicKey: tenant.izipayPublicKey,
    hmacKey: decryptSecretString(Buffer.from(tenant.izipayHmacKeyEnc)),
  };
}
