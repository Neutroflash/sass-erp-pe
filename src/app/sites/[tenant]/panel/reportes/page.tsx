import { redirect } from "next/navigation";
import { DollarSign, Package, Receipt, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { getSalesByDay, getTopProducts, getInventoryValuation, getPreviousPeriodSales, percentChange } from "@/domain/reports/tenant-reports";
import { formatPrice } from "@/lib/utils";
import { KpiCard } from "@/components/panel/reportes/KpiCard";
import { SalesAreaChart } from "@/components/panel/reportes/SalesAreaChart";
import { TopProductsBarChart } from "@/components/panel/reportes/TopProductsBarChart";

export const dynamic = "force-dynamic";

const REPORT_WINDOW_DAYS = 30;

// OWNER-only: la valorización de inventario usa costPrice — misma línea de "roles más finos" que
// InventoryTable/panel de configuración (Fase 4 del roadmap).
export default async function ReportesPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const [salesByDay, previousPeriod, topProducts, valuation] = await Promise.all([
    getSalesByDay(prisma, tenant.id, REPORT_WINDOW_DAYS),
    getPreviousPeriodSales(prisma, tenant.id, REPORT_WINDOW_DAYS),
    getTopProducts(prisma, tenant.id, 10),
    getInventoryValuation(prisma, tenant.id),
  ]);

  const totalLast30 = salesByDay.reduce((sum, d) => sum + d.total, 0);
  const ordersLast30 = salesByDay.reduce((sum, d) => sum + d.orderCount, 0);
  const avgTicketLast30 = ordersLast30 > 0 ? totalLast30 / ordersLast30 : 0;
  const avgTicketPrevious = previousPeriod.orderCount > 0 ? previousPeriod.total / previousPeriod.orderCount : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Reportes</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`Ventas (${REPORT_WINDOW_DAYS} días)`}
          value={formatPrice(totalLast30)}
          trend={percentChange(totalLast30, previousPeriod.total)}
          sublabel="vs. período anterior"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          label="Pedidos pagados"
          value={String(ordersLast30)}
          trend={percentChange(ordersLast30, previousPeriod.orderCount)}
          sublabel="vs. período anterior"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatPrice(avgTicketLast30)}
          trend={percentChange(avgTicketLast30, avgTicketPrevious)}
          sublabel="vs. período anterior"
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiCard
          label="Valorización de inventario"
          value={formatPrice(valuation.totalValue)}
          sublabel={`${valuation.totalUnits} unidades en stock, a costo`}
          icon={<Package className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">
          Ventas por día (últimos {REPORT_WINDOW_DAYS} días)
        </h2>
        <SalesAreaChart data={salesByDay} />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Productos más vendidos</h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ventas pagadas para reportar.</p>
        ) : (
          <TopProductsBarChart data={topProducts} />
        )}
      </div>
    </div>
  );
}
