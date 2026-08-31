import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export default async function OrderConfirmationPage({ params }: { params: { orderId: string } }) {
  const tenant = await getCurrentTenant();
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, tenantId: tenant.id },
    include: { items: { include: { variant: { select: { sku: true, name: true } } } } },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Pedido recibido</h1>
        <Badge variant={order.status === "PAID" ? "success" : order.status === "CANCELLED" ? "destructive" : "outline"}>
          {STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </div>

      <p className="mb-6 text-sm text-zinc-400">
        Guarda este enlace para consultar el estado de tu pedido. Un asesor confirmará tu pago (Yape/Plin/efectivo) a la
        brevedad.
      </p>

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
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

      <p className="mt-4 text-xs text-zinc-600">Pedido #{order.id}</p>
    </div>
  );
}
