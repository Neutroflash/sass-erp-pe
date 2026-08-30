import { generateSecureToken, hashSecureToken } from "./secure-token";

// TTL mucho más largo que el de reset de contraseña (30 min) a propósito: confirmar un email es
// de bajo riesgo (no habilita ninguna acción sensible por sí sola, ver el comentario en
// POST /api/tenants sobre por qué no bloquea el panel), así que no tiene sentido apurar al dueño
// de un negocio recién registrado a hacer clic en minutos.
export const EMAIL_VERIFICATION_TOKEN_TTL_DAYS = 7;

export const generateEmailVerificationToken = generateSecureToken;
export const hashEmailVerificationToken = hashSecureToken;

export function emailVerificationTokenExpiresAt(): Date {
  return new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
