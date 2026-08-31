import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { parseTenantFeatures } from "@/domain/tenant-features";
import { resolvePlanLimits, startOfCurrentMonth } from "@/domain/plan-limits";
import { PLAN_PRICE_PEN } from "@/domain/platform-billing/pricing";
import { verificationRecordName } from "@/domain/custom-domain";
import { formatPrice } from "@/lib/utils";
import { SettingsForm } from "@/components/panel/SettingsForm";
import { SunatCredentialsForm } from "@/components/panel/SunatCredentialsForm";
import { IzipayCredentialsForm } from "@/components/panel/IzipayCredentialsForm";
import { CustomDomainForm } from "@/components/panel/CustomDomainForm";
import { PlanSelector } from "@/components/panel/PlanSelector";
import { Badge } from "@/components/ui/badge";

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = { ACTIVE: "Al día", PAST_DUE: "Pago pendiente", CANCELLED: "Cancelada" };

export const dynamic = "force-dynamic";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = limit !== null && used >= limit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={nearLimit ? "text-red-400" : "text-muted-foreground"}>{limit === null ? `${used} · ilimitado` : `${used} / ${limit}`}</span>
      </div>
      {limit !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-accent">
          <div className={`h-full ${nearLimit ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// Solo OWNER: identidad fiscal/comercial y qué módulos tiene activos el negocio no son cosas que
// un SELLER deba poder tocar, aunque panel/layout.tsx ya lo deje entrar al resto del panel.
export default async function ConfiguracionPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const row = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: {
      businessName: true,
      ruc: true,
      fiscalAddress: true,
      logoUrl: true,
      coverImageUrl: true,
      whatsappNumber: true,
      primaryColor: true,
      termsAndConditions: true,
      privacyPolicy: true,
      lowStockThreshold: true,
      features: true,
      planTier: true,
      planProductLimit: true,
      planInvoiceLimit: true,
      sunatEnvironment: true,
      sunatSolUser: true,
      sunatCertificateEnc: true,
      sunatGreClientId: true,
      sunatGreClientSecretEnc: true,
      izipayUsername: true,
      izipayPasswordEnc: true,
      izipayPublicKey: true,
      izipayHmacKeyEnc: true,
      customDomain: true,
      customDomainPending: true,
      customDomainVerificationToken: true,
    },
  });

  const [productCount, invoicesThisMonth, subscription] = await Promise.all([
    withTenantRLS(prisma, tenant.id, (tx) => tx.product.count({ where: { tenantId: tenant.id } })),
    withTenantRLS(prisma, tenant.id, (tx) =>
      tx.invoice.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfCurrentMonth() } } }),
    ),
    // platform_subscriptions no está en el alcance de RLS (ver docs/RLS.md) — el SuperAdmin y el
    // worker de facturación necesitan cruzar todos los tenants a la vez.
    prisma.platformSubscription.findUnique({ where: { tenantId: tenant.id } }),
  ]);
  const limits = resolvePlanLimits(row);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Configuración</h1>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Plan y uso</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{row.planTier}</Badge>
            {subscription && (
              <Badge variant={subscription.status === "ACTIVE" ? "success" : subscription.status === "PAST_DUE" ? "destructive" : "outline"}>
                {SUBSCRIPTION_STATUS_LABEL[subscription.status] ?? subscription.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <UsageBar label="Productos en catálogo" used={productCount} limit={limits.productLimit} />
          <UsageBar label="Comprobantes emitidos este mes" used={invoicesThisMonth} limit={limits.invoiceLimit} />
        </div>
        {subscription && (
          <p className="mt-3 text-xs text-muted-foreground">
            {PLAN_PRICE_PEN[row.planTier] === 0
              ? "Plan gratuito, sin cobro."
              : `${formatPrice(PLAN_PRICE_PEN[row.planTier])}/mes · próximo cobro el ${new Date(subscription.currentPeriodEnd).toLocaleDateString("es-PE")}`}
          </p>
        )}
        <div className="mt-4 border-t border-border/60 pt-4">
          <PlanSelector currentPlan={row.planTier} />
        </div>
      </div>

      <SettingsForm
        initial={{
          businessName: row.businessName,
          ruc: row.ruc,
          fiscalAddress: row.fiscalAddress,
          logoUrl: row.logoUrl,
          coverImageUrl: row.coverImageUrl,
          whatsappNumber: row.whatsappNumber,
          primaryColor: row.primaryColor,
          termsAndConditions: row.termsAndConditions,
          privacyPolicy: row.privacyPolicy,
          lowStockThreshold: row.lowStockThreshold,
          features: parseTenantFeatures(row.features),
        }}
      />

      <SunatCredentialsForm
        initial={{
          configured: Boolean(row.sunatSolUser && row.sunatCertificateEnc),
          environment: row.sunatEnvironment,
          solUser: row.sunatSolUser,
          greConfigured: Boolean(row.sunatGreClientId && row.sunatGreClientSecretEnc),
        }}
      />

      <IzipayCredentialsForm
        initial={{
          configured: Boolean(row.izipayUsername && row.izipayPasswordEnc && row.izipayPublicKey && row.izipayHmacKeyEnc),
          username: row.izipayUsername,
        }}
      />

      <CustomDomainForm
        initial={{
          customDomain: row.customDomain,
          pending: row.customDomainPending,
          txtRecordName: row.customDomainPending ? verificationRecordName(row.customDomainPending) : null,
          txtRecordValue: row.customDomainVerificationToken,
        }}
      />
    </div>
  );
}
