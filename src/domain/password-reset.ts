import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 30);

/** El token en sí (lo que va en la URL del correo) — alta entropía, nunca se guarda tal cual. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** Lo que SÍ se guarda en DB — un hash del token, no el token mismo (mismo criterio que una
 * contraseña: si la base de datos se filtra, un atacante no puede reconstruir links de reset
 * válidos a partir de lo guardado). SHA-256 alcanza acá (a diferencia de una contraseña elegida
 * por un humano, este token ya es de alta entropía — no hace falta un hash lento tipo bcrypt). */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiresAt(): Date {
  return new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}
