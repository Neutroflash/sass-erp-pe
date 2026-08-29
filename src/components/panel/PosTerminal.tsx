"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { createPosSale } from "@/lib/panel-mutations";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PosVariant {
  id: string;
  sku: string;
  name: string;
  productName: string;
  price: number;
  stock: number;
  reservedStock: number;
}

interface SaleLine {
  variantId: string;
  label: string;
  price: number;
  quantity: number;
  available: number;
}

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

// El check de `available` acá es solo UX (evita que el vendedor arme una venta que va a fallar) —
// la verdad final sigue siendo el lock de fila en createPosSale(), igual que en el checkout online.
export function PosTerminal({ variants }: { variants: PosVariant[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ orderId: string; totalAmount: number } | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return variants
      .filter((v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.productName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, variants]);

  function addToCart(variant: PosVariant) {
    const available = variant.stock - variant.reservedStock;
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) => (l.variantId === variant.id ? { ...l, quantity: Math.min(l.quantity + 1, available) } : l));
      }
      return [...prev, { variantId: variant.id, label: `${variant.productName} — ${variant.name}`, price: variant.price, quantity: 1, available }];
    });
    setQuery("");
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, l.available)) } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const total = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  async function handleCharge() {
    setSubmitting(true);
    setError(null);
    try {
      const sale = await createPosSale({
        customerName: customerName || undefined,
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      });
      setLastSale(sale);
      setCart([]);
      setCustomerName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la venta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            placeholder="Buscar por nombre o SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(inputClass, "w-full")}
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900 shadow-xl">
              {results.map((v) => {
                const available = v.stock - v.reservedStock;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={available <= 0}
                    onClick={() => addToCart(v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>
                      {v.productName} — {v.name} <span className="text-zinc-500">({v.sku})</span>
                    </span>
                    <span className="text-yellow-400">{formatPrice(v.price)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Cantidad</th>
                <th className="p-3">Subtotal</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-zinc-500">
                    Busca un producto para agregarlo a la venta.
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr key={line.variantId} className="border-b border-zinc-800/60">
                    <td className="p-3 text-sm text-zinc-200">{line.label}</td>
                    <td className="p-3 text-sm text-zinc-400">{formatPrice(line.price)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => changeQuantity(line.variantId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm text-zinc-100">{line.quantity}</span>
                        <Button size="icon" variant="outline" onClick={() => changeQuantity(line.variantId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-sm font-medium text-zinc-100">{formatPrice(line.price * line.quantity)}</td>
                    <td className="p-3">
                      <Button size="icon" variant="ghost" onClick={() => removeLine(line.variantId)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex h-fit flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 text-yellow-400">
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-semibold">Cobro</span>
        </div>

        <input
          placeholder="Cliente (opcional)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className={inputClass}
        />

        <div className="flex justify-between border-t border-zinc-800/60 pt-3 text-lg font-bold text-zinc-100">
          <span>Total</span>
          <span className="text-yellow-400">{formatPrice(total)}</span>
        </div>

        {error && <span className="text-sm text-destructive">{error}</span>}

        <Button disabled={cart.length === 0 || submitting} onClick={handleCharge}>
          {submitting ? "Procesando..." : "Cobrar"}
        </Button>

        {lastSale && (
          <p className="text-xs text-emerald-400">
            Venta registrada — pedido #{lastSale.orderId.slice(0, 8)} por {formatPrice(lastSale.totalAmount)}.
          </p>
        )}
      </div>
    </div>
  );
}
