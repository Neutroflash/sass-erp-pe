"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AdminOrderRow } from "./columns";

// Mismas dos acciones que ya existían en OrdersTable.tsx (confirm-payment/reject-payment), ahora
// como el menú "..." de cada fila — solo aplican mientras el pedido sigue PENDING_PAYMENT, un
// pedido ya pagado/cancelado no tiene nada que confirmar o rechazar.
export function OrderRowActions({ order }: { order: AdminOrderRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function act(action: "confirm-payment" | "reject-payment") {
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo actualizar el pedido");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar el pedido");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label="Acciones del pedido">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/panel/pedidos/${order.id}`}>Ver detalle</Link>
        </DropdownMenuItem>
        {order.status === "PENDING_PAYMENT" && (
          <>
            <DropdownMenuItem onSelect={() => act("confirm-payment")}>Confirmar pago</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act("reject-payment")} className="text-destructive focus:text-destructive">
              Rechazar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
