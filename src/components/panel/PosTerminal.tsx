"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { createPosSale, type CustomerSummary } from "@/lib/panel-mutations";
import { CustomerPicker } from "@/components/panel/pos/CustomerPicker";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { addQty, formatQty, hasEnough, isPositiveQty, lineTotal, subQty, toQty, QTY_SCALE } from "@/domain/inventory/quantity";
import { unitShort } from "@/domain/inventory/units";

export interface PosVariant {
  id: string;
  sku: string;
  name: string;
  productName: string;
  price: number;
  stock: number;
  reservedStock: number;
  unitCode: string;
}

interface SaleLine {
  variantId: string;
  label: string;
  price: number;
  quantity: number;
  available: number;
  unitCode: string;
  /** Lo que el vendedor está tecleando. Se guarda aparte de `quantity` para no pelearle al
   *  cursor mientras escribe estados intermedios como "3." o "0.7" antes de completar. */
  input: string;
}

const inputClass =
  "h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

// El check de `available` acá es solo UX (evita que el vendedor arme una venta que va a fallar) —
// la verdad final sigue siendo el lock de fila en createPosSale(), igual que en el checkout online.
export function PosTerminal({ variants, creditEnabled }: { variants: PosVariant[]; creditEnabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [onCredit, setOnCredit] = useState(false);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [dueDate, setDueDate] = useState("");
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
    const available = subQty(variant.stock, variant.reservedStock);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        const next = clamp(addQty(existing.quantity, 1), available);
        return prev.map((l) => (l.variantId === variant.id ? { ...l, quantity: next, input: formatQty(next) } : l));
      }
      const quantity = clamp(1, available);
      return [
        ...prev,
        {
          variantId: variant.id,
          label: `${variant.productName} — ${variant.name}`,
          price: variant.price,
          quantity,
          available,
          unitCode: variant.unitCode,
          input: formatQty(quantity),
        },
      ];
    });
    setQuery("");
  }

  /** Nunca por encima de lo disponible ni por debajo de cero. */
  function clamp(quantity: number, available: number) {
    if (!hasEnough(available, quantity)) return toQty(available);
    return Math.max(0, toQty(quantity));
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.variantId !== variantId) return l;
          const next = clamp(addQty(l.quantity, delta), l.available);
          return { ...l, quantity: next, input: formatQty(next) };
        })
        .filter((l) => isPositiveQty(l.quantity)),
    );
  }

  /** Teclear la cantidad: lo que se ve es lo que el vendedor escribió; lo que se cobra es lo validado. */
  function typeQuantity(variantId: string, raw: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.variantId !== variantId) return l;
        const parsed = Number(raw);
        if (raw === "" || !Number.isFinite(parsed)) return { ...l, input: raw, quantity: 0 };
        return { ...l, input: raw, quantity: clamp(parsed, l.available) };
      }),
    );
  }

  /** Al salir del campo se normaliza a la escala real y se descarta la línea vacía. */
  function commitQuantity(variantId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, input: formatQty(l.quantity) } : l))
        .filter((l) => isPositiveQty(l.quantity)),
    );
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const total = cart.reduce((sum, l) => sum + lineTotal(l.quantity, l.price), 0);

  async function handleCharge() {
    setSubmitting(true);
    setError(null);
    try {
      const sale = await createPosSale({
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ...(onCredit && customer
          ? {
              paymentTerm: "CREDIT" as const,
              customerId: customer.id,
              customerName: customer.name,
              // Fecha suelta -> fin de ese día. Sin esto, un vencimiento "el 15" vencería a las
              // 00:00 del 15 y la cartera lo marcaría atrasado el mismo día que toca pagar.
              dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
            }
          : { customerName: customerName || undefined }),
      });
      setLastSale(sale);
      setCart([]);
      setCustomerName("");
      setCustomer(null);
      setDueDate("");
      setOnCredit(false);
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
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border/80 bg-card shadow-xl">
              {results.map((v) => {
                const available = subQty(v.stock, v.reservedStock);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!isPositiveQty(available)}
                    onClick={() => addToCart(v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>
                      {v.productName} — {v.name} <span className="text-muted-foreground">({v.sku})</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatQty(available)} {unitShort(v.unitCode)}
                      </span>
                      <span className="text-primary">
                        {formatPrice(v.price)}
                        <span className="text-xs text-muted-foreground">/{unitShort(v.unitCode)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-accent text-xs uppercase tracking-wide text-muted-foreground">
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
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    Busca un producto para agregarlo a la venta.
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr key={line.variantId} className="border-b border-border/60">
                    <td className="p-3 text-sm text-foreground">{line.label}</td>
                    <td className="p-3 text-sm text-muted-foreground">{formatPrice(line.price)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => changeQuantity(line.variantId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step={1 / 10 ** QTY_SCALE}
                          min={0}
                          max={line.available}
                          value={line.input}
                          onChange={(e) => typeQuantity(line.variantId, e.target.value)}
                          onBlur={() => commitQuantity(line.variantId)}
                          aria-label={`Cantidad de ${line.label}`}
                          className={cn(inputClass, "h-9 w-24 text-center")}
                        />
                        <span className="text-xs text-muted-foreground">{unitShort(line.unitCode)}</span>
                        <Button size="icon" variant="outline" onClick={() => changeQuantity(line.variantId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-sm font-medium text-foreground">{formatPrice(lineTotal(line.quantity, line.price))}</td>
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

      <div className="flex h-fit flex-col gap-4 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 text-primary">
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-semibold">{onCredit ? "Venta a crédito" : "Cobro"}</span>
        </div>

        {creditEnabled && (
          <div className="flex rounded-lg border border-border p-0.5">
            {([
              ["Contado", false],
              ["A crédito", true],
            ] as const).map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => setOnCredit(value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  onCredit === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {onCredit ? (
          <div className="flex flex-col gap-2">
            <CustomerPicker selected={customer} onSelect={setCustomer} />
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Vence el (opcional)</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </label>
            {/* Lo que el negocio tiene que tener presente al fiar: el comprobante sale hoy, así
                que el IGV se declara hoy, se cobre o no. */}
            <p className="text-xs text-muted-foreground">
              La mercadería sale ahora y el comprobante se emite hoy — el IGV se declara aunque el cobro venga después.
            </p>
          </div>
        ) : (
          <input
            placeholder="Cliente (opcional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className={inputClass}
          />
        )}

        <div className="flex justify-between border-t border-border/60 pt-3 text-lg font-bold text-foreground">
          <span>Total</span>
          <span className="text-primary">{formatPrice(total)}</span>
        </div>

        {error && <span className="text-sm text-destructive">{error}</span>}

        <Button
          disabled={cart.length === 0 || !cart.every((l) => isPositiveQty(l.quantity)) || submitting || (onCredit && !customer)}
          onClick={handleCharge}
        >
          {submitting ? "Procesando..." : onCredit ? "Entregar a crédito" : "Cobrar"}
        </Button>

        {onCredit && !customer && (
          <p className="text-xs text-muted-foreground">Elige un cliente: una deuda sin nombre no se puede cobrar.</p>
        )}

        {lastSale && (
          <p className="text-xs text-emerald-400">
            Venta registrada — pedido #{lastSale.orderId.slice(0, 8)} por {formatPrice(lastSale.totalAmount)}.
          </p>
        )}
      </div>
    </div>
  );
}
