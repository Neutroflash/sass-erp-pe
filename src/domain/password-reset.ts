import { generateSecureToken, hashSecureToken } from "./secure-token";

export const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 30);

export const generateResetToken = generateSecureToken;
export const hashResetToken = hashSecureToken;

export function resetTokenExpiresAt(): Date {
  return new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}
