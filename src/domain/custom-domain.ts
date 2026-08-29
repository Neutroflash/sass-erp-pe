import { randomBytes } from "crypto";
import { resolveTxt } from "dns/promises";

/** Prefijo fijo del registro TXT que un tenant debe publicar para probar que controla el dominio
 * que está reclamando — mismo mecanismo que usan Vercel/Cloudflare/etc. para "domain verification". */
export function verificationRecordName(domain: string): string {
  return `_saas-verify.${domain}`;
}

export function generateVerificationToken(): string {
  return randomBytes(16).toString("hex");
}

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain) && domain.length <= 253;
}

/**
 * Verificación real por DNS — no una casilla de "confío en vos". Busca el registro TXT en
 * `_saas-verify.{domain}` y confirma que uno de sus valores es exactamente el token que le dimos
 * al tenant al reclamar el dominio. `resolveTxt` corre en el runtime Node (nunca en el
 * middleware/Edge, que no puede hacer DNS lookups) — ver el Route Handler que la llama.
 */
export async function verifyDomainOwnership(domain: string, expectedToken: string): Promise<boolean> {
  try {
    const records = await resolveTxt(verificationRecordName(domain));
    // Cada TXT record llega como un array de chunks de string — unirlos es lo correcto (así es
    // como se reconstruyen registros TXT largos partidos en múltiples strings de 255 bytes).
    return records.some((chunks) => chunks.join("") === expectedToken);
  } catch {
    // NXDOMAIN, sin registros TXT, timeout de DNS — todos son "no verificado todavía", no un error
    // que deba tumbar la request.
    return false;
  }
}
