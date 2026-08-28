import { cookies } from "next/headers";

export const TENANT_ACCESS_COOKIE = "tenant_access_token";
export const TENANT_REFRESH_COOKIE = "tenant_refresh_token";
export const PLATFORM_ACCESS_COOKIE = "platform_access_token";
export const PLATFORM_REFRESH_COOKIE = "platform_refresh_token";

const ACCESS_MAX_AGE = 15 * 60; // 15 minutos, espeja tenantUserJwt/platformAdminJwt.signAccess
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 días

// Deliberadamente SIN `domain`: sin ese atributo, la cookie queda "host-only" — válida solo para
// el subdominio exacto que la emitió. Es lo que evita que la sesión de un usuario del negocio A
// viaje a una request hacia el negocio B, aunque ambos compartan el dominio raíz tusaas.pe — a
// diferencia de Flashkings (un solo negocio, backend y frontend en dominios distintos), acá no
// hay ningún escenario cross-domain que resolver: todo vive bajo el mismo dominio raíz, cada
// tenant en su propio subdominio, y ese aislamiento por subdominio es justo lo que se necesita.
const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export function setTenantSessionCookies(accessToken: string, refreshToken: string): void {
  cookies().set(TENANT_ACCESS_COOKIE, accessToken, { ...baseCookieOptions, maxAge: ACCESS_MAX_AGE });
  cookies().set(TENANT_REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, maxAge: REFRESH_MAX_AGE });
}

export function clearTenantSessionCookies(): void {
  cookies().set(TENANT_ACCESS_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  cookies().set(TENANT_REFRESH_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

export function setPlatformAdminSessionCookies(accessToken: string, refreshToken: string): void {
  cookies().set(PLATFORM_ACCESS_COOKIE, accessToken, { ...baseCookieOptions, maxAge: ACCESS_MAX_AGE });
  cookies().set(PLATFORM_REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, maxAge: REFRESH_MAX_AGE });
}

export function clearPlatformAdminSessionCookies(): void {
  cookies().set(PLATFORM_ACCESS_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  cookies().set(PLATFORM_REFRESH_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}
