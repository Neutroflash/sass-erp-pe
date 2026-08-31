"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart-store";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IzipayCheckoutWidget } from "@/components/checkout/IzipayCheckoutWidget";

const inputClass =
  "rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

// Si el tenant tiene Izipay configurado, el pedido se crea igual (PENDING_PAYMENT + stock
// reservado) y luego se muestra el widget de pago en línea en vez de navegar directo a la
// confirmación. Sin Izipay configurado, sigue el flujo de siempre: confirmación manual del staff
// desde /panel/pedidos (orderValidation) — suficiente para un negocio que cobra por
// Yape/Plin/efectivo fuera de la plataforma.
//
// Componente cliente puro — el guard de `publicStorefront` (requirePublicStorefront) vive en
// page.tsx, que es quien puede llamar notFound() del lado del servidor antes de renderizar esto.
export function CheckoutClient() {
  const router = useRouter();
  const { items, totalPrice, clear } = useCartStore();
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", shippingAddress: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [izipayWidget, setIzipayWidget] = useState<{ orderId: string; formToken: string; publicKey: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
      });
      const data = (await res.json()) as { orderId?: string; error?: string };
      if (!res.ok || !data.orderId) throw new Error(data.error ?? "No se pudo crear el pedido");
      clear();

      const tokenRes = await fetch(`/api/orders/${data.orderId}/payment/izipay-token`, { method: "POST" });
      const tokenData = (await tokenRes.json()) as { configured: boolean; formToken?: string; publicKey?: string };
      if (tokenRes.ok && tokenData.configured && tokenData.formToken && tokenData.publicKey) {
        setIzipayWidget({ orderId: data.orderId, formToken: tokenData.formToken, publicKey: tokenData.publicKey });
        return;
      }
      router.push(`/pedido/${data.orderId}/confirmacion`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  if (izipayWidget) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Completa tu pago</h1>
        <IzipayCheckoutWidget {...izipayWidget} />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">Tu carrito está vacío.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Checkout</h1>

      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4">
        {items.map((item) => (
          <div key={item.variantId} className="flex justify-between text-sm text-foreground/90">
            <span>
              {item.productName} — {item.variantName} x{item.quantity}
            </span>
            <span>{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-foreground">
          <span>Total</span>
          <span className="text-primary">{formatPrice(totalPrice())}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Nombre completo"
          value={form.customerName}
          onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={form.customerEmail}
          onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
          className={inputClass}
        />
        <input
          placeholder="Teléfono"
          value={form.customerPhone}
          onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
          className={inputClass}
        />
        <input
          placeholder="Dirección de envío"
          value={form.shippingAddress}
          onChange={(e) => setForm((f) => ({ ...f, shippingAddress: e.target.value }))}
          className={cn(inputClass)}
        />
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Reservando stock..." : "Confirmar pedido"}
        </Button>
      </form>
    </div>
  );
}
