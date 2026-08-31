import { NextResponse } from "next/server";
import { redirect, notFound } from "next/navigation";
import type { TenantFeatures } from "@/domain/tenant-features";
import { hasFeature } from "./features";

/**
 * Para Server Components / Server Actions bajo /sites/[tenant]/panel/**. Llamar al principio de
 * una page.tsx que dependa de un módulo específico (ej. facturación). Si el módulo está
 * desactivado, redirige al dashboard en vez de dejar renderizar la página — nunca deja pasar por
 * defecto ante cualquier duda, y nunca solo oculta el link del Sidebar y confía en eso: alguien
 * puede escribir la URL a mano.
 */
export async function requireFeature(tenantId: string, featureKey: keyof TenantFeatures): Promise<void> {
  const enabled = await hasFeature(tenantId, featureKey);
  if (!enabled) {
    redirect(`/panel?disabled=${featureKey}`);
  }
}

/**
 * Para Route Handlers (src/app/sites/[tenant]/api/**). Devuelve un 403 real (no un redirect —
 * una llamada de API no tiene a dónde "navegar") cuando el módulo está desactivado. Uso:
 *
 *   const denied = await assertFeatureOrRespond403(tenantId, "sunatInvoicing");
 *   if (denied) return denied;
 */
export async function assertFeatureOrRespond403(
  tenantId: string,
  featureKey: keyof TenantFeatures,
): Promise<NextResponse | null> {
  const enabled = await hasFeature(tenantId, featureKey);
  if (enabled) return null;

  return NextResponse.json(
    { error: `El módulo "${featureKey}" no está activo para este negocio.` },
    { status: 403 },
  );
}

/**
 * Para las páginas de la TIENDA PÚBLICA (`/`, `/catalogo`, `/producto/[slug]`, `/checkout`) —
 * a diferencia de `requireFeature`, nunca redirige a `/panel`: el visitante es (o puede ser) un
 * cliente final anónimo sin ninguna razón para terminar en la pantalla de login del negocio.
 * `notFound()` (404 real) es la respuesta correcta acá — "esta tienda no existe/no está
 * disponible", igual que cómo `getCurrentTenant()` ya trata un tenant inexistente.
 */
export async function requirePublicStorefront(tenantId: string): Promise<void> {
  const enabled = await hasFeature(tenantId, "publicStorefront");
  if (!enabled) {
    notFound();
  }
}

/** Mismo criterio que `requirePublicStorefront` pero para el Route Handler que de verdad crea
 * pedidos online (`POST /api/orders`) — defensa en profundidad: aunque la UI de checkout ya esté
 * bloqueada, nadie debería poder crear un pedido pegándole directo a la API. */
export async function assertPublicStorefrontOrRespond404(tenantId: string): Promise<NextResponse | null> {
  const enabled = await hasFeature(tenantId, "publicStorefront");
  if (enabled) return null;

  return NextResponse.json({ error: "Este negocio no tiene tienda en línea disponible." }, { status: 404 });
}
