import { randomBytes, createHash } from "crypto";

/** Token de alta entropía para links de un solo uso (reset de contraseña, verificación de email).
 * Compartido entre password-reset.ts y email-verification.ts — misma mecánica, distinto TTL. */
export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

/** Lo que se guarda en DB — nunca el token en texto plano (mismo criterio que una contraseña: si
 * la base se filtra, no se pueden reconstruir links válidos a partir de lo guardado). SHA-256
 * alcanza acá porque el token ya es de alta entropía, no elegido por un humano. */
export function hashSecureToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
