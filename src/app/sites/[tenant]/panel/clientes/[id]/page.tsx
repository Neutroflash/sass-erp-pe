import Link from "next/link";
import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { getCustomerOutstanding } from "@/domain/reports/accounts-receivable";
import { toCents, fromCents } from "@/domain/payments/money";
import { RegisterPaymentDialog } from "@/components/panel/clientes/RegisterPaymentDialog";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/domain/orders/order-status";
import { formatPrice, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "creditSales");

  const customer = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.customer.findFirst({
      where: { id: params.id, tenantId: tenant.id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: { paymentAllocations: { select: { amount: true } } },
        },
        payments: { orderBy: { paidAt: "desc" }, take: 50 },
      },
    }),
  );
  if (!customer) notFound();

  const outstanding = await getCustomerOutstanding(prisma, tenant.id, customer.id);
  const now = new Date();

  const orders = customer.orders.map((order) => {
    const applied = order.paymentAllocations.reduce((sum, a) => sum + toCents(a.amount), 0);
    const balance = fromCents(Math.max(0, toCents(order.totalAmount) - applied));
    return {
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      total: Number(order.totalAmount),
      paid: fromCents(applied),
      balance,
      dueDate: order.dueDate,
      overdue: order.status === "PENDING_COLLECTION" && order.dueDate !== null && order.dueDate < now,
      onCredit: order.paymentTerm === "CREDIT",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/panel/clientes" className="text-sm text-muted-foreground hover:text-foreground">
        ← Volver a clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[customer.phone, customer.address].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
          {customer.docNumber && (
            <p className="text-sm text-muted-foreground">
              {customer.docType} {customer.docNumber}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {outstanding > 0 && (
            <Link
              href={`/panel/clientes/${customer.id}/nota-de-deuda`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground transition-colors hover:border-primary/50"
            >
              <FileText className="h-4 w-4" />
              Nota de deuda
            </Link>
          )}
          <RegisterPaymentDialog customerId={customer.id} customerName={customer.name} outstanding={outstanding} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Deuda actual</span>
        <p className={cn("mt-1 text-3xl font-bold tabular-nums", outstanding > 0 ? "text-amber-500" : "text-emerald-400")}>
          {formatPrice(outstanding)}
        </p>
        {customer.creditLimit !== null && (
          <p className="mt-1 text-sm text-muted-foreground">
            Límite de crédito: {formatPrice(Number(customer.creditLimit))}
            {outstanding > Number(customer.creditLimit) && <span className="ml-1 text-destructive">— excedido</span>}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Compras</h2>
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Vence</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Abonado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Este cliente todavía no tiene compras registradas.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border/40 last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link href={`/panel/pedidos/${order.id}`} className="text-foreground hover:text-primary">
                      {formatDate(order.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </td>
                  <td className={cn("px-4 py-3", order.overdue ? "text-destructive" : "text-muted-foreground")}>
                    {order.dueDate ? formatDate(order.dueDate) : order.onCredit ? "sin fecha" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatPrice(order.paid)}</td>
                  <td className={cn("px-4 py-3 text-right font-medium tabular-nums", order.balance > 0 ? "text-amber-500" : "text-muted-foreground")}>
                    {order.balance > 0 ? formatPrice(order.balance) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Abonos</h2>
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Medio</th>
                <th className="px-4 py-3 font-medium">Nota</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {customer.payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Sin abonos registrados.
                  </td>
                </tr>
              )}
              {customer.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.paidAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{METHOD_LABEL[payment.method] ?? payment.method}</td>
                  <td className="px-4 py-3 text-muted-foreground">{payment.note ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-400">
                    {formatPrice(Number(payment.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
