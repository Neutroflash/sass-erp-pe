import type { PlanTier } from "@prisma/client";

export interface PlanLimits {
  /** Total de productos que puede tener el catálogo. `null` = sin límite. */
  productLimit: number | null;
  /** Comprobantes (boleta+factura) que puede emitir POR MES CALENDARIO. `null` = sin límite. */
  invoiceLimit: number | null;
}

/**
 * Default por plan, en código — mismo criterio que DEFAULT_TENANT_FEATURES: las columnas
 * `Tenant.planProductLimit`/`planInvoiceLimit` son overrides puntuales por negocio (`null` =
 * "usa el default de su plan"), no la fuente de verdad de qué incluye cada plan. Cambiar lo que
 * incluye el plan STARTER para TODOS los negocios STARTER es un cambio acá, no una migración de
 * datos. Espeja los números ya mostrados en /precios.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: { productLimit: 20, invoiceLimit: 15 },
  STARTER: { productLimit: 200, invoiceLimit: 200 },
  PRO: { productLimit: null, invoiceLimit: null },
};

interface TenantPlanFields {
  planTier: PlanTier;
  planProductLimit: number | null;
  planInvoiceLimit: number | null;
}

export function resolvePlanLimits(tenant: TenantPlanFields): PlanLimits {
  const planDefault = PLAN_LIMITS[tenant.planTier];
  return {
    productLimit: tenant.planProductLimit ?? planDefault.productLimit,
    invoiceLimit: tenant.planInvoiceLimit ?? planDefault.invoiceLimit,
  };
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
