"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AdminInvoiceRow } from "./columns";

export function InvoiceRowActions({ invoice }: { invoice: AdminInvoiceRow }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  if (!invoice.orderId && invoice.status !== "PENDING_SUNAT") return null;

  async function retry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/retry-sunat`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? "No se pudo reintentar");
      }
      router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={retrying} aria-label="Acciones del comprobante">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {invoice.orderId && (
          <DropdownMenuItem asChild>
            <Link href={`/panel/pedidos/${invoice.orderId}`}>Ver pedido</Link>
          </DropdownMenuItem>
        )}
        {invoice.status === "PENDING_SUNAT" && (
          <DropdownMenuItem onSelect={retry}>{retrying ? "Reintentando..." : "Reintentar envío a SUNAT"}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
