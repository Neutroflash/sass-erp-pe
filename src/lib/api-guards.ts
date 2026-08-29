import { NextResponse } from "next/server";
import { CurrentTenantUser, getCurrentTenantUser } from "./auth";
import { getCurrentTenant } from "./tenant-context";

export interface TenantStaffContext {
  user: CurrentTenantUser;
  tenantId: string;
}

/**
 * Para Route Handlers bajo /sites/[tenant]/api/**: exige sesión válida, del mismo tenant que la
 * URL, y con rol OWNER/SELLER (CUSTOMER nunca puede gestionar el negocio, aunque tenga sesión en
 * este mismo tenant). Uso:
 *
 *   const auth = await requireTenantStaff();
 *   if (auth instanceof NextResponse) return auth;
 *   const { tenantId } = auth;
 */
export async function requireTenantStaff(): Promise<TenantStaffContext | NextResponse> {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser();

  if (!user || user.tenantId !== tenant.id || user.role === "CUSTOMER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return { user, tenantId: tenant.id };
}

/**
 * Más estricto que requireTenantStaff(): solo OWNER, no SELLER. Para acciones que tocan la
 * identidad fiscal/comercial del negocio o qué módulos tiene activos (/panel/configuracion) — un
 * vendedor no debería poder cambiar el RUC del negocio ni prenderse a sí mismo módulos nuevos.
 */
export async function requireTenantOwner(): Promise<TenantStaffContext | NextResponse> {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser();

  if (!user || user.tenantId !== tenant.id || user.role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return { user, tenantId: tenant.id };
}
