import { prisma } from "@/lib/prisma";
import { PLAN_PRICE_PEN } from "@/domain/platform-billing/pricing";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RunBillingButton } from "@/components/admin/RunBillingButton";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "outline"> = {
  ACTIVE: "success",
  PAST_DUE: "destructive",
  CANCELLED: "outline",
};

export default async function PlatformSubscriptionsPage() {
  const subscriptions = await prisma.platformSubscription.findMany({
    include: { tenant: { select: { businessName: true, slug: true, planTier: true } } },
    orderBy: { currentPeriodEnd: "asc" },
  });

  const totalMonthlyRevenue = subscriptions
    .filter((s) => s.status !== "CANCELLED")
    .reduce((sum, s) => sum + PLAN_PRICE_PEN[s.tenant.planTier], 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-foreground">Suscripciones</h2>
        <RunBillingButton />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">MRR estimado</span>
        <p className="mt-1 text-2xl font-bold text-yellow-400">{formatPrice(totalMonthlyRevenue)}</p>
      </div>

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay suscripciones.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-accent text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Negocio</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Próximo cobro</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-border/60">
                  <td className="p-3 text-sm text-foreground">
                    {sub.tenant.businessName} <span className="text-muted-foreground">({sub.tenant.slug})</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{sub.tenant.planTier}</Badge>
                  </td>
                  <td className="p-3 text-sm text-foreground/90">{formatPrice(PLAN_PRICE_PEN[sub.tenant.planTier])}/mes</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[sub.status] ?? "outline"}>{sub.status}</Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{new Date(sub.currentPeriodEnd).toLocaleDateString("es-PE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
