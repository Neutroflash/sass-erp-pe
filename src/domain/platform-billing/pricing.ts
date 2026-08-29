import type { PlanTier } from "@prisma/client";

/** Precio mensual en soles — fuente de verdad en código, mismo criterio que PLAN_LIMITS
 * (src/domain/plan-limits.ts): cambiar cuánto cuesta un plan es un cambio acá, no una migración
 * de datos. FREE nunca genera un PlatformCharge (ver billing-cycle.ts). */
export const PLAN_PRICE_PEN: Record<PlanTier, number> = {
  FREE: 0,
  STARTER: 49,
  PRO: 149,
};
