import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
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
