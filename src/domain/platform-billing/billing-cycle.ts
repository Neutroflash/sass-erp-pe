import type { PrismaClient, Prisma } from "@prisma/client";
import { PLAN_PRICE_PEN } from "./pricing";
import { fakePlatformPaymentGateway } from "./fake-gateway";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Procesa UN ciclo de facturación para un tenant — se llama tanto desde el job recurrente
 * (runDueBillingCycles) como desde el trigger manual del SuperAdmin. Idempotente respecto al
 * período actual: si `currentPeriodEnd` todavía no llegó, es un no-op (nunca cobra dos veces el
 * mismo período).
 *
 * FREE nunca genera un `PlatformCharge` — el período simplemente se corre hacia adelante. Un
 * cobro fallido (`success: false`) deja la suscripción en `PAST_DUE` y NO avanza el período,
 * a propósito: el mismo período sigue "debiéndose" hasta que un cobro tenga éxito, en vez de
 * generar un charge nuevo cada vez que se reintenta.
 */
export async function runBillingCycleForTenant(prisma: PrismaClient, tenantId: string): Promise<void> {
  const subscription = await prisma.platformSubscription.findUnique({
    where: { tenantId },
    include: { tenant: { select: { planTier: true, businessName: true } } },
  });
  if (!subscription) return; // tenant sin suscripción (no debería pasar — se crea al registrarse)
  if (subscription.status === "CANCELLED") return;
  if (subscription.currentPeriodEnd > new Date()) return; // todavía no toca cobrar

  const price = PLAN_PRICE_PEN[subscription.tenant.planTier];

  if (price === 0) {
    await prisma.platformSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: subscription.currentPeriodEnd,
        currentPeriodEnd: new Date(subscription.currentPeriodEnd.getTime() + ONE_MONTH_MS),
      },
    });
    return;
  }

  const charge = await prisma.platformCharge.create({
    data: {
      subscriptionId: subscription.id,
      tenantId,
      planTier: subscription.tenant.planTier,
      amount: price,
      periodStart: subscription.currentPeriodEnd,
      periodEnd: new Date(subscription.currentPeriodEnd.getTime() + ONE_MONTH_MS),
      status: "PENDING",
    },
  });

  const result = await fakePlatformPaymentGateway.charge({
    tenantId,
    amount: price,
    description: `Suscripción ${subscription.tenant.planTier} — ${subscription.tenant.businessName}`,
  });

  await prisma.platformCharge.update({
    where: { id: charge.id },
    data: {
      status: result.success ? "PAID" : "FAILED",
      providerChargeId: result.providerChargeId,
      providerResponse: result.raw as unknown as Prisma.InputJsonValue,
      paidAt: result.success ? new Date() : null,
    },
  });

  await prisma.platformSubscription.update({
    where: { id: subscription.id },
    data: result.success
      ? { status: "ACTIVE", currentPeriodStart: charge.periodStart, currentPeriodEnd: charge.periodEnd }
      : { status: "PAST_DUE" },
  });
}

/** Escanea todas las suscripciones vencidas y las procesa — lo que llama el job recurrente. */
export async function runDueBillingCycles(prisma: PrismaClient): Promise<number> {
  const due = await prisma.platformSubscription.findMany({
    where: { status: { not: "CANCELLED" }, currentPeriodEnd: { lte: new Date() } },
    select: { tenantId: true },
  });
  for (const { tenantId } of due) {
    await runBillingCycleForTenant(prisma, tenantId);
  }
  return due.length;
}
