const PLANS = [
  { tier: "FREE", label: "Gratis", productLimit: 20, invoiceLimit: 15 },
  { tier: "STARTER", label: "Starter", productLimit: 200, invoiceLimit: 200 },
  { tier: "PRO", label: "Pro", productLimit: null, invoiceLimit: null },
] as const;

export default function PricingPage() {
  return (
    <main>
      <h1>Planes</h1>
      <ul>
        {PLANS.map((plan) => (
          <li key={plan.tier}>
            {plan.label}: {plan.productLimit ?? "productos ilimitados"} / {plan.invoiceLimit ?? "comprobantes ilimitados"} al mes
          </li>
        ))}
      </ul>
    </main>
  );
}
