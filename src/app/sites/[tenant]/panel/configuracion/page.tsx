import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { parseTenantFeatures } from "@/domain/tenant-features";
import { resolvePlanLimits, startOfCurrentMonth } from "@/domain/plan-limits";
import { SettingsForm } from "@/components/panel/SettingsForm";
import { SunatCredentialsForm } from "@/components/panel/SunatCredentialsForm";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = limit !== null && used >= limit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={nearLimit ? "text-red-400" : "text-zinc-500"}>{limit === null ? `${used} · ilimitado` : `${used} / ${limit}`}</span>
      </div>
      {limit !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full ${nearLimit ? "bg-red-500" : "bg-yellow-400"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// Solo OWNER: identidad fiscal/comercial y qué módulos tiene activos el negocio no son cosas que
// un SELLER deba poder tocar, aunque panel/layout.tsx ya lo deje entrar al resto del panel.
export default async function ConfiguracionPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser();
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
      primaryColor: true,
      features: true,
      planTier: true,
      planProductLimit: true,
      planInvoiceLimit: true,
      sunatEnvironment: true,
      sunatSolUser: true,
      sunatCertificateEnc: true,
    },
  });

  const [productCount, invoicesThisMonth] = await Promise.all([
    prisma.product.count({ where: { tenantId: tenant.id } }),
    prisma.invoice.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfCurrentMonth() } } }),
  ]);
  const limits = resolvePlanLimits(row);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Configuración</h1>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-yellow-400/80">Plan y uso</h2>
          <Badge variant="outline">{row.planTier}</Badge>
        </div>
        <div className="flex flex-col gap-4">
          <UsageBar label="Productos en catálogo" used={productCount} limit={limits.productLimit} />
          <UsageBar label="Comprobantes emitidos este mes" used={invoicesThisMonth} limit={limits.invoiceLimit} />
        </div>
      </div>

      <SettingsForm
        initial={{
          businessName: row.businessName,
          ruc: row.ruc,
          fiscalAddress: row.fiscalAddress,
          logoUrl: row.logoUrl,
          primaryColor: row.primaryColor,
          features: parseTenantFeatures(row.features),
        }}
      />

      <SunatCredentialsForm
        initial={{
          configured: Boolean(row.sunatSolUser && row.sunatCertificateEnc),
          environment: row.sunatEnvironment,
          solUser: row.sunatSolUser,
        }}
      />
    </div>
  );
}
