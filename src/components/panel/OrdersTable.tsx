"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

export interface AdminOrderRow {
  id: string;
  status: "PENDING_PAYMENT" | "PAID" | "IN_PREPARATION" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  channel: "ONLINE" | "POS";
  totalAmount: number;
  customerName: string;
  customerPhone: string | null;
  createdAt: string;
  itemCount: number;
}

const STATUS_VARIANT: Record<AdminOrderRow["status"], "success" | "destructive" | "outline"> = {
  PENDING_PAYMENT: "outline",
  PAID: "success",
  IN_PREPARATION: "success",
  SHIPPED: "success",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

const STATUS_LABEL: Record<AdminOrderRow["status"], string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  IN_PREPARATION: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function act(orderId: string, action: "confirm-payment" | "reject-payment") {
    setPendingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo actualizar el pedido");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar el pedido");
    } finally {
      setPendingId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="text-sm text-zinc-500">Todavía no hay pedidos.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
      <table className="w-full text-left">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="p-3">Fecha</th>
            <th className="p-3">Cliente</th>
            <th className="p-3">Canal</th>
            <th className="p-3">Ítems</th>
            <th className="p-3">Total</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-zinc-800/60">
              <td className="p-3 text-sm text-zinc-500">{new Date(order.createdAt).toLocaleString("es-PE")}</td>
              <td className="p-3 text-sm text-zinc-300">
                {order.customerName}
                {order.customerPhone && <span className="ml-1 text-zinc-500">({order.customerPhone})</span>}
              </td>
              <td className="p-3 text-sm text-zinc-400">{order.channel === "ONLINE" ? "Tienda online" : "POS"}</td>
              <td className="p-3 text-sm text-zinc-100">{order.itemCount}</td>
              <td className="p-3 text-sm font-medium text-yellow-400">{formatPrice(order.totalAmount)}</td>
              <td className="p-3">
                <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
              </td>
              <td className="p-3">
                {order.status === "PENDING_PAYMENT" ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={pendingId === order.id} onClick={() => act(order.id, "confirm-payment")}>
                      Confirmar pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === order.id}
                      onClick={() => act(order.id, "reject-payment")}
                    >
                      Rechazar
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
