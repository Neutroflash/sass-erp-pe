import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { Tenant } from "@prisma/client";

/**
 * Lee el slug que middleware.ts adjuntó como header interno (x-tenant-slug) y resuelve el Tenant
 * real. Server-only (usa next/headers) — llamar desde Server Components / Route Handlers bajo
 * /sites/[tenant]/**, nunca desde el sitio de marketing ni el panel de plataforma (ahí no hay
 * tenant en contexto, y headers().get("x-tenant-slug") sería null).
 *
 * TODO cuando existan más tenants que quepan cómodos en cada request: cachear esta lectura
 * (React `cache()` por request como mínimo; considerar además un cache de aplicación con TTL
 * corto una vez que el volumen lo justifique) — hoy pega a Postgres en cada navegación.
 */
export async function getCurrentTenant(): Promise<Tenant> {
  const slug = headers().get("x-tenant-slug");
  if (!slug) {
    // Alguien llegó a una ruta bajo /sites/[tenant] sin pasar por el middleware (o el matcher
    // no cubrió este path) — tratarlo como "tenant no encontrado", nunca asumir uno por defecto.
    notFound();
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    notFound();
  }

  return tenant;
}
