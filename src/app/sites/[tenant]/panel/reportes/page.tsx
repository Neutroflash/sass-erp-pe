import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { getSalesByDay, getTopProducts, getInventoryValuation } from "@/domain/reports/tenant-reports";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

// OWNER-only: la valorización de inventario usa costPrice — misma línea de "roles más finos" que
// InventoryTable/panel de configuración (Fase 4 del roadmap).
export default async function ReportesPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const [salesByDay, topProducts, valuation] = await Promise.all([
    getSalesByDay(prisma, tenant.id, 30),
    getTopProducts(prisma, tenant.id, 10),
    getInventoryValuation(prisma, tenant.id),
  ]);

  const totalLast30 = salesByDay.reduce((sum, d) => sum + d.total, 0);
  const ordersLast30 = salesByDay.reduce((sum, d) => sum + d.orderCount, 0);
  const maxDay = Math.max(1, ...salesByDay.map((d) => d.total));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Reportes</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Ventas (30 días)</span>
          <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(totalLast30)}</p>
          <p className="text-xs text-muted-foreground">{ordersLast30} pedidos pagados</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Valorización de inventario</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatPrice(valuation.totalValue)}</p>
          <p className="text-xs text-muted-foreground">{valuation.totalUnits} unidades en stock, a costo</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Ticket promedio (30 días)</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatPrice(ordersLast30 > 0 ? totalLast30 / ordersLast30 : 0)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Ventas por día (últimos 30 días)</h2>
        {/* Sin overflow-x-auto a propósito: con 30 barras a flex-1 nunca hay overflow horizontal
            real que scrollear, pero el contenedor SÍ reaccionaba al tooltip absoluto de abajo
            (que se sale del borde al hacer hover en una barra cerca del extremo) — aparecía una
            barra de scroll horizontal fantasma justo al pasar el mouse. */}
        <div className="flex h-32 items-end gap-1">
          {salesByDay.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 min-w-[6px] items-end">
              <div
                className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(2, (d.total / maxDay) * 100)}%` }}
              />
              {/* Tooltip fijo oscuro a propósito, en ambos temas — como cualquier tooltip nativo. */}
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
                {d.date}: {formatPrice(d.total)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
        <h2 className="p-5 pb-0 text-sm font-semibold uppercase tracking-wide text-primary/80">Productos más vendidos</h2>
        {topProducts.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Todavía no hay ventas pagadas para reportar.</p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead className="bg-accent text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Unidades vendidas</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.variantId} className="border-b border-border/60">
                  <td className="p-3 text-sm text-foreground">
                    {p.productName} <span className="text-muted-foreground">— {p.variantName}</span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{p.sku}</td>
                  <td className="p-3 text-sm font-medium text-foreground">{p.quantitySold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
