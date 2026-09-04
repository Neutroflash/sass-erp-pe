import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { listCustomers } from "@/domain/customers/list-customers";
import { getReceivables } from "@/domain/reports/accounts-receivable";
import { KpiCard } from "@/components/panel/reportes/KpiCard";
import { formatPrice, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "creditSales");

  const [customers, receivables] = await Promise.all([
    listCustomers(prisma, tenant.id, searchParams.q),
    getReceivables(prisma, tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
      </div>

      {/* La cartera primero: al abrir esta pantalla lo que se quiere saber es cuánto falta cobrar
          y cuánto ya está vencido, no la agenda completa. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Por cobrar"
          value={formatPrice(receivables.summary.totalOutstanding)}
          sublabel={`${receivables.summary.customersWithDebt} ${receivables.summary.customersWithDebt === 1 ? "cliente debe" : "clientes deben"}`}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard label="Vencido" value={formatPrice(receivables.summary.totalOverdue)} sublabel="pasó la fecha de pago" />
        <KpiCard label="Clientes" value={String(customers.length)} sublabel="en la agenda del negocio" />
      </div>

      {receivables.orphanOrderIds.length > 0 && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Hay {receivables.orphanOrderIds.length} venta(s) a crédito sin cliente asociado. No se pueden cobrar desde acá
          porque no hay a quién: revísalas en Pedidos.
        </p>
      )}

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar por nombre, teléfono o documento..."
          className="h-10 w-full max-w-md rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
        />
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Dirección</th>
              <th className="px-4 py-3 text-right font-medium">Debe</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {searchParams.q ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes. Se crean al vender a crédito desde el POS."}
                </td>
              </tr>
            )}
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-border/40 last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3">
                  <Link href={`/panel/clientes/${customer.id}`} className="font-medium text-foreground hover:text-primary">
                    {customer.name}
                  </Link>
                  {customer.docNumber && (
                    <span className="block text-xs text-muted-foreground">
                      {customer.docType} {customer.docNumber}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{customer.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{customer.address ?? "—"}</td>
                <td className={cn("px-4 py-3 text-right font-medium tabular-nums", customer.outstanding > 0 ? "text-amber-500" : "text-muted-foreground")}>
                  {customer.outstanding > 0 ? formatPrice(customer.outstanding) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
