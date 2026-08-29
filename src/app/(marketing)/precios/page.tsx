import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    tier: "FREE",
    label: "Gratis",
    productLimit: 20,
    invoiceLimit: 15,
    highlight: false,
    features: ["Hasta 20 productos", "15 comprobantes al mes", "Inventario y kardex", "Tienda online"],
  },
  {
    tier: "STARTER",
    label: "Starter",
    productLimit: 200,
    invoiceLimit: 200,
    highlight: true,
    features: ["Hasta 200 productos", "200 comprobantes al mes", "Todo lo del plan Gratis", "Punto de venta (POS)", "Reportes"],
  },
  {
    tier: "PRO",
    label: "Pro",
    productLimit: null,
    invoiceLimit: null,
    highlight: false,
    features: ["Productos ilimitados", "Comprobantes ilimitados", "Todo lo del plan Starter", "Soporte prioritario"],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-3xl font-bold text-zinc-100">Planes</h1>
        <p className="text-zinc-400">Empieza gratis. Sube de plan cuando tu negocio lo necesite.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={cn(
              "flex flex-col rounded-2xl border p-6 backdrop-blur-md",
              plan.highlight ? "border-yellow-500/50 bg-zinc-900/80" : "border-zinc-800/80 bg-zinc-900/60",
            )}
          >
            {plan.highlight && (
              <span className="mb-2 w-fit rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                Más popular
              </span>
            )}
            <h2 className="text-lg font-bold text-zinc-100">{plan.label}</h2>
            <ul className="my-4 flex flex-1 flex-col gap-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
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
