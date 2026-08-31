import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getTenantFeatures } from "@/lib/features";
import { withTenantRLS } from "@/lib/tenant-rls";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InvoiceSection, type OrderInvoiceSummary } from "@/components/panel/InvoiceSection";
import { DispatchGuideSection, type OrderDispatchGuideSummary } from "@/components/panel/DispatchGuideSection";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  IN_PREPARATION: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();

  const [order, features] = await Promise.all([
    withTenantRLS(prisma, tenant.id, (tx) =>
      tx.order.findFirst({
        where: { id: params.id, tenantId: tenant.id },
        include: {
          items: { include: { variant: { select: { sku: true, name: true } } } },
          invoice: { include: { corrections: true } },
          dispatchGuide: true,
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

  return (
    <div className="flex flex-col gap-6">
      <Link href="/panel/pedidos" className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" />
        Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Pedido #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-zinc-500">{new Date(order.createdAt).toLocaleString("es-PE")}</p>
        </div>
        <Badge variant={order.status === "PAID" ? "success" : order.status === "CANCELLED" ? "destructive" : "outline"}>
          {STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Cliente</span>
          <p className="mt-1 text-zinc-100">{order.customerName}</p>
          {order.customerPhone && <p className="text-sm text-zinc-400">{order.customerPhone}</p>}
          {order.customerEmail && <p className="text-sm text-zinc-400">{order.customerEmail}</p>}
          {order.shippingAddress && <p className="mt-2 text-sm text-zinc-500">{order.shippingAddress}</p>}
          <p className="mt-2 text-xs text-zinc-600">Canal: {order.channel === "ONLINE" ? "Tienda online" : "POS (venta presencial)"}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-zinc-300">
              <span>
                {item.variant.name} <span className="text-zinc-500">({item.variant.sku})</span> x{item.quantity}
              </span>
              <span>{formatPrice(Number(item.price) * item.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-zinc-800/60 pt-2 font-bold text-zinc-100">
            <span>Total</span>
            <span className="text-primary">{formatPrice(Number(order.totalAmount))}</span>
          </div>
        </div>
      </div>

      {features.sunatInvoicing && order.status === "PAID" && <InvoiceSection orderId={order.id} invoice={invoiceSummary} />}
      {features.sunatInvoicing && order.status === "PAID" && (
        <DispatchGuideSection orderId={order.id} dispatchGuide={dispatchGuideSummary} />
      )}
    </div>
  );
}
