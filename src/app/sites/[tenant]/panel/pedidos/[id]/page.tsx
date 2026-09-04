import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getTenantFeatures } from "@/lib/features";
import { withTenantRLS } from "@/lib/tenant-rls";
import { formatPrice, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InvoiceSection, type OrderInvoiceSummary } from "@/components/panel/InvoiceSection";
import { DispatchGuideSection, type OrderDispatchGuideSummary } from "@/components/panel/DispatchGuideSection";
import { formatQty, lineTotal, toQty } from "@/domain/inventory/quantity";
import { unitShort } from "@/domain/inventory/units";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/domain/orders/order-status";
import { toCents, fromCents } from "@/domain/payments/money";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();

  const [order, features] = await Promise.all([
    withTenantRLS(prisma, tenant.id, (tx) =>
      tx.order.findFirst({
        where: { id: params.id, tenantId: tenant.id },
        include: {
          items: { include: { variant: { select: { sku: true, name: true, unitCode: true } } } },
          invoice: { include: { corrections: true } },
          dispatchGuide: true,
          customer: { select: { id: true, name: true, phone: true } },
          paymentAllocations: { select: { amount: true } },
        },
      }),
    ),
    getTenantFeatures(tenant.id),
  ]);
  if (!order) notFound();

  const invoiceSummary: OrderInvoiceSummary | null = order.invoice
    ? {
        id: order.invoice.id,
        // Invoice.type nunca es GUIA_REMISION en la práctica — ver el comentario en retry.ts.
        type: order.invoice.type as OrderInvoiceSummary["type"],
        status: order.invoice.status,
        series: order.invoice.series,
        number: order.invoice.number,
        documentType: order.invoice.documentType,
        documentNumber: order.invoice.documentNumber,
        businessName: order.invoice.businessName,
        totalAmount: Number(order.invoice.totalAmount),
        notes: order.invoice.corrections.map((note) => ({
          id: note.id,
          type: note.type as "NOTA_CREDITO" | "NOTA_DEBITO",
          status: note.status,
          series: note.series,
          number: note.number,
          totalAmount: Number(note.totalAmount),
        })),
      }
    : null;

  const dispatchGuideSummary: OrderDispatchGuideSummary | null = order.dispatchGuide
    ? {
        id: order.dispatchGuide.id,
        series: order.dispatchGuide.series,
        number: order.dispatchGuide.number,
        status: order.dispatchGuide.status,
      }
    : null;

  // El abono se registra por CLIENTE, no por pedido (ver register-payment.ts) — acá solo se
  // muestra cuánto de este pedido quedó cubierto por ese reparto.
  const appliedCents = order.paymentAllocations.reduce((sum, a) => sum + toCents(a.amount), 0);
  const paid = fromCents(appliedCents);
  const balance = fromCents(Math.max(0, toCents(order.totalAmount) - appliedCents));
  const overdue = order.status === "PENDING_COLLECTION" && order.dueDate !== null && order.dueDate < new Date();
  // Una venta a crédito emite comprobante al ENTREGAR, no al cobrar: la obligación tributaria
  // nace con la entrega (ver issue-invoice.ts).
  const canInvoice = order.status === "PAID" || order.status === "PENDING_COLLECTION";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/panel/pedidos" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedido #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString("es-PE")}</p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</span>
          {order.customer ? (
            <Link href={`/panel/clientes/${order.customer.id}`} className="mt-1 block text-foreground hover:text-primary">
              {order.customerName}
            </Link>
          ) : (
            <p className="mt-1 text-foreground">{order.customerName}</p>
          )}
          {order.customerPhone && <p className="text-sm text-muted-foreground">{order.customerPhone}</p>}
          {order.customerEmail && <p className="text-sm text-muted-foreground">{order.customerEmail}</p>}
          {order.shippingAddress && <p className="mt-2 text-sm text-muted-foreground">{order.shippingAddress}</p>}
          <p className="mt-2 text-xs text-muted-foreground/70">Canal: {order.channel === "ONLINE" ? "Tienda online" : "POS (venta presencial)"}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-foreground/90">
              <span>
                {item.variant.name} <span className="text-muted-foreground">({item.variant.sku})</span> x{formatQty(item.quantity)}{" "}
                <span className="text-muted-foreground">{unitShort(item.variant.unitCode)}</span>
              </span>
              <span>{formatPrice(lineTotal(item.quantity, item.price))}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border/60 pt-2 font-bold text-foreground">
            <span>Total</span>
            <span className="text-primary">{formatPrice(Number(order.totalAmount))}</span>
          </div>

          {/* Solo a crédito: en una venta al contado "abonado / saldo" es ruido — se pagó y ya. */}
          {order.paymentTerm === "CREDIT" && (
            <div className="mt-1 flex flex-col gap-1 border-t border-border/60 pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Abonado</span>
                <span className="tabular-nums">{formatPrice(paid)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className={balance > 0 ? "text-amber-500" : "text-emerald-400"}>Saldo</span>
                <span className={cn("tabular-nums", balance > 0 ? "text-amber-500" : "text-emerald-400")}>
                  {formatPrice(balance)}
                </span>
              </div>
              {order.dueDate && (
                <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                  {overdue ? "Venció el " : "Vence el "}
                  {order.dueDate.toLocaleDateString("es-PE")}
                </p>
              )}
              {balance > 0 && order.customer && (
                <Link href={`/panel/clientes/${order.customer.id}`} className="mt-1 text-xs text-primary hover:underline">
                  Registrar abono en la ficha de {order.customer.name} →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {features.sunatInvoicing && canInvoice && <InvoiceSection orderId={order.id} invoice={invoiceSummary} />}
      {features.sunatInvoicing && canInvoice && (
        <DispatchGuideSection orderId={order.id} dispatchGuide={dispatchGuideSummary} />
      )}
    </div>
  );
}
