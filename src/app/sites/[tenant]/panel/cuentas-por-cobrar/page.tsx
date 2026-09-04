import Link from "next/link";
import { AlertTriangle, Phone, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { getCollectedSince, getReceivables, type CustomerDebt } from "@/domain/reports/accounts-receivable";
import { KpiCard } from "@/components/panel/reportes/KpiCard";
import { Badge } from "@/components/ui/badge";
import { formatPrice, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Antigüedad de la deuda vencida. Los cortes son los que usa cualquier negocio que fía: a los 30
 *  días se llama, a los 60 se insiste, a los 90 la cobranza ya es otro problema. */
function agingLabel(days: number): { label: string; tone: "warn" | "bad" | "worst" } {
  if (days >= 90) return { label: "+90 días", tone: "worst" };
  if (days >= 60) return { label: "+60 días", tone: "bad" };
  if (days >= 30) return { label: "+30 días", tone: "bad" };
  return { label: `${days} ${days === 1 ? "día" : "días"}`, tone: "warn" };
}

function DebtRow({ debt }: { debt: CustomerDebt }) {
  const aging = debt.daysOverdue !== null && debt.daysOverdue > 0 ? agingLabel(debt.daysOverdue) : null;

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-accent/40">
      <td className="px-4 py-3">
        <Link href={`/panel/clientes/${debt.customerId}`} className="font-medium text-foreground hover:text-primary">
          {debt.name}
        </Link>
        <span className="block text-xs text-muted-foreground">
          {debt.openOrders} {debt.openOrders === 1 ? "venta abierta" : "ventas abiertas"}
        </span>
      </td>
      {/* Teléfono y dirección en la fila, no dentro de la ficha: esta pantalla se abre para salir
          a cobrar, y tener que entrar a cada cliente para conseguir el número la vuelve inútil. */}
      <td className="px-4 py-3 text-sm">
        {debt.phone ? (
          <a href={`tel:${debt.phone}`} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
            <Phone className="h-3 w-3" />
            {debt.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">sin teléfono</span>
        )}
        <span className="block text-xs text-muted-foreground">{debt.address ?? "sin dirección"}</span>
      </td>
      <td className="px-4 py-3">
        {aging ? (
          <Badge variant={aging.tone === "warn" ? "warning" : "destructive"}>{aging.label}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">al día</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-amber-500">{formatPrice(debt.outstanding)}</td>
      <td className={cn("px-4 py-3 text-right tabular-nums", debt.overdue > 0 ? "text-destructive" : "text-muted-foreground")}>
        {debt.overdue > 0 ? formatPrice(debt.overdue) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/panel/clientes/${debt.customerId}/nota-de-deuda`}
          className="text-xs text-primary hover:underline"
        >
          Nota de deuda
        </Link>
      </td>
    </tr>
  );
}

export default async function ReceivablesPage() {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "creditSales");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [receivables, collections] = await Promise.all([
    getReceivables(prisma, tenant.id),
    getCollectedSince(prisma, tenant.id, startOfMonth),
  ]);

  const overdueFirst = receivables.byCustomer.filter((d) => d.overdue > 0);
  const current = receivables.byCustomer.filter((d) => d.overdue === 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cuentas por cobrar</h1>
        <p className="text-sm text-muted-foreground">Quién debe, cuánto y desde cuándo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Por cobrar"
          value={formatPrice(receivables.summary.totalOutstanding)}
          sublabel={`${receivables.summary.customersWithDebt} ${receivables.summary.customersWithDebt === 1 ? "cliente" : "clientes"}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Vencido"
          value={formatPrice(receivables.summary.totalOverdue)}
          sublabel={overdueFirst.length > 0 ? `${overdueFirst.length} por reclamar` : "nada atrasado"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        {/* Cobrado ≠ vendido: este número es plata que entró de deudas, no ventas del mes. */}
        <KpiCard
          label="Cobrado este mes"
          value={formatPrice(collections.collected)}
          sublabel={`${collections.paymentCount} ${collections.paymentCount === 1 ? "abono recibido" : "abonos recibidos"}`}
        />
      </div>

      {receivables.orphanOrderIds.length > 0 && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Hay {receivables.orphanOrderIds.length} venta(s) a crédito sin cliente asociado: no se pueden cobrar desde acá
          porque no hay a quién reclamarle. Revísalas en Pedidos.
        </p>
      )}

      {receivables.byCustomer.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card/60 px-4 py-10 text-center text-muted-foreground backdrop-blur-md">
          Nadie debe nada. Las ventas a crédito aparecen acá apenas se registran desde el punto de venta.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Atraso</th>
                <th className="px-4 py-3 text-right font-medium">Debe</th>
                <th className="px-4 py-3 text-right font-medium">Vencido</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {overdueFirst.map((debt) => (
                <DebtRow key={debt.customerId} debt={debt} />
              ))}
              {overdueFirst.length > 0 && current.length > 0 && (
                <tr>
                  <td colSpan={6} className="border-b border-border/40 bg-accent/30 px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    Todavía no vencido
                  </td>
                </tr>
              )}
              {current.map((debt) => (
                <DebtRow key={debt.customerId} debt={debt} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
