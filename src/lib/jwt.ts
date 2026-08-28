import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

// Dos espacios de secrets completamente separados (tenant vs. plataforma) — un token de
// PlatformAdmin nunca debe poder pasar la verificación de un token de User de tenant, ni viceversa,
// ni siquiera si alguien reutiliza por error el nombre de cookie equivocado.
export interface TenantUserClaims {
  sub: string; // userId
  tenantId: string; // el usuario pertenece a exactamente un tenant — nunca firmar sin esto
  role: UserRole;
}

export interface PlatformAdminClaims {
  sub: string; // platformAdminId
}

function sign<T extends object>(claims: T, secretEnv: string, expiresIn: SignOptions["expiresIn"]): string {
  return jwt.sign(claims, requiredEnv(secretEnv), { expiresIn });
}

function verify<T>(token: string, secretEnv: string): T & JwtPayload {
  return jwt.verify(token, requiredEnv(secretEnv)) as T & JwtPayload;
}

export const tenantUserJwt = {
  signAccess: (claims: TenantUserClaims) => sign(claims, "JWT_TENANT_ACCESS_SECRET", "15m"),
  signRefresh: (claims: TenantUserClaims) => sign(claims, "JWT_TENANT_REFRESH_SECRET", "7d"),
  verifyAccess: (token: string) => verify<TenantUserClaims>(token, "JWT_TENANT_ACCESS_SECRET"),
  verifyRefresh: (token: string) => verify<TenantUserClaims>(token, "JWT_TENANT_REFRESH_SECRET"),
};

export const platformAdminJwt = {
  signAccess: (claims: PlatformAdminClaims) => sign(claims, "JWT_PLATFORM_ACCESS_SECRET", "15m"),
  signRefresh: (claims: PlatformAdminClaims) => sign(claims, "JWT_PLATFORM_REFRESH_SECRET", "7d"),
  verifyAccess: (token: string) => verify<PlatformAdminClaims>(token, "JWT_PLATFORM_ACCESS_SECRET"),
  verifyRefresh: (token: string) => verify<PlatformAdminClaims>(token, "JWT_PLATFORM_REFRESH_SECRET"),
};
