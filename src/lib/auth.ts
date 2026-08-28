import { cookies } from "next/headers";
import type { PlatformAdmin, User, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { PasswordHasher } from "./password";
import { platformAdminJwt, tenantUserJwt } from "./jwt";
import { PLATFORM_ACCESS_COOKIE, TENANT_ACCESS_COOKIE } from "./session-cookies";

export interface CurrentTenantUser {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
}

/** Server-only. Lee la cookie de sesión del usuario del tenant actual, si existe y es válida —
 * nunca lanza, una cookie ausente/expirada/inválida es indistinguible de "no hay sesión". */
export async function getCurrentTenantUser(): Promise<CurrentTenantUser | null> {
  const token = cookies().get(TENANT_ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const claims = tenantUserJwt.verifyAccess(token);
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) return null;
    return { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

export async function authenticateTenantUser(tenantId: string, email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
  if (!user) return null;
  const valid = await PasswordHasher.verify(password, user.passwordHash);
  return valid ? user : null;
}

export interface CurrentPlatformAdmin {
  id: string;
  name: string;
  email: string;
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | null> {
  const token = cookies().get(PLATFORM_ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const claims = platformAdminJwt.verifyAccess(token);
    const admin = await prisma.platformAdmin.findUnique({ where: { id: claims.sub } });
    if (!admin) return null;
    return { id: admin.id, name: admin.name, email: admin.email };
  } catch {
    return null;
  }
}

export async function authenticatePlatformAdmin(email: string, password: string): Promise<PlatformAdmin | null> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin) return null;
  const valid = await PasswordHasher.verify(password, admin.passwordHash);
  return valid ? admin : null;
}
