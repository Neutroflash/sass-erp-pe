import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/domain/plan-limits";
import { PLAN_PRICE_PEN } from "@/domain/platform-billing/pricing";

const PLAN_META = {
  FREE: { label: "Gratis", highlight: false, extraFeatures: ["Inventario y kardex", "Tienda online"] },
  STARTER: { label: "Starter", highlight: true, extraFeatures: ["Todo lo del plan Gratis", "Punto de venta (POS)", "Reportes"] },
  PRO: { label: "Pro", highlight: false, extraFeatures: ["Todo lo del plan Starter", "Soporte prioritario"] },
} as const;

const PLANS = (Object.keys(PLAN_META) as (keyof typeof PLAN_META)[]).map((tier) => {
  const limits = PLAN_LIMITS[tier];
  const meta = PLAN_META[tier];
  return {
    tier,
    label: meta.label,
    highlight: meta.highlight,
    price: PLAN_PRICE_PEN[tier],
    features: [
      limits.productLimit === null ? "Productos ilimitados" : `Hasta ${limits.productLimit} productos`,
      limits.invoiceLimit === null ? "Comprobantes ilimitados" : `${limits.invoiceLimit} comprobantes al mes`,
      ...meta.extraFeatures,
    ],
  };
});

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Planes</h1>
        <p className="text-muted-foreground">Empieza gratis. Sube de plan cuando tu negocio lo necesite.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={cn(
              "flex flex-col rounded-2xl border p-6 backdrop-blur-md",
              plan.highlight ? "border-yellow-500/50 bg-card/80" : "border-border/80 bg-card/60",
            )}
          >
            {plan.highlight && (
              <span className="mb-2 w-fit rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                Más popular
              </span>
            )}
            <h2 className="text-lg font-bold text-foreground">{plan.label}</h2>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {plan.price === 0 ? "Gratis" : `S/ ${plan.price}`}
              {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mes</span>}
            </p>
            <ul className="my-4 flex flex-1 flex-col gap-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/registro">
              <Button variant={plan.highlight ? "default" : "outline"} className="w-full">
                Empezar
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
