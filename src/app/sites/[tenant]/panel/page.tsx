import { getCurrentTenant } from "@/lib/tenant-context";
import { getTenantFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { withTenantRLS } from "@/lib/tenant-rls";
import { formatPrice } from "@/lib/utils";

// Nunca estática — cada tarjeta refleja el estado del negocio en este momento.
export const dynamic = "force-dynamic";

// Umbral de "stock bajo" fijo por ahora — candidato obvio a ser un campo configurable por tenant
// (o por producto) en cuanto el negocio piloto lo pida; no vale la pena esa flexibilidad todavía.
const LOW_STOCK_THRESHOLD = 5;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export default async function TenantDashboardPage() {
  const tenant = await getCurrentTenant();
  const features = await getTenantFeatures(tenant.id);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Cada query condicionada a su propio feature — no tiene sentido pagar el costo de una consulta
  // (ni mostrar el dato) de un módulo que este negocio no tiene activo.
  const [salesToday, pendingValidations, todaysMargin, lowStockCount] = await Promise.all([
    features.orderValidation || features.posWeb
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.order.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfToday } } }))
      : null,
    features.orderValidation
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.order.count({ where: { tenantId: tenant.id, status: "PENDING_PAYMENT" } }))
      : null,
    features.profitMargins
      ? withTenantRLS(prisma, tenant.id, (tx) =>
          tx.orderItem.findMany({
            where: { order: { tenantId: tenant.id, createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } } },
            select: { quantity: true, price: true, variant: { select: { costPrice: true } } },
          }),
        )
      : null,
    features.inventoryManagement
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.productVariant.count({ where: { tenantId: tenant.id, stock: { lte: LOW_STOCK_THRESHOLD } } }))
      : null,
  ]);

  const marginTotal = todaysMargin?.reduce(
    (sum, item) => sum + (Number(item.price) - Number(item.variant.costPrice)) * item.quantity,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">{tenant.businessName}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {salesToday !== null && <StatCard label="Ventas del día" value={String(salesToday)} hint="pedidos creados hoy" />}
        {pendingValidations !== null && (
          <StatCard label="Validaciones pendientes" value={String(pendingValidations)} hint="Yape / Plin por confirmar" />
        )}
        {marginTotal !== undefined && (
          <StatCard label="Margen de ganancia neto" value={formatPrice(marginTotal ?? 0)} hint="hoy, órdenes no canceladas" />
        )}
        {lowStockCount !== null && (
          <StatCard label="Alertas de stock bajo" value={String(lowStockCount)} hint={`variantes con ≤ ${LOW_STOCK_THRESHOLD} unidades`} />
        )}
      </div>
    </div>
  );
}
