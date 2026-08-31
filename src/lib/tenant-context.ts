import { cache } from "react";
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
 * Envuelto en `cache()` de React: dentro de un mismo request, layout.tsx (para inyectar el color
 * primario del tenant) y cada page.tsx bajo /sites/[tenant]/** vuelven a llamar esto de forma
 * independiente — sin memoizar, cada uno pegaba a Postgres por separado (era un TODO pendiente
 * desde antes de este cambio, que ahora se vuelve necesario en vez de solo "nice to have").
 */
async function fetchCurrentTenant(): Promise<Tenant> {
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

export const getCurrentTenant = cache(fetchCurrentTenant);
