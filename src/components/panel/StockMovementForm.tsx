"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProductVariant } from "@/types/panel";
import { createStockMovement, StockMovementInput } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_UNIT_CODE } from "@/domain/inventory/units";
import { unitShort } from "@/domain/inventory/units";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

interface VariantOption extends AdminProductVariant {
  productName: string;
}

export function StockMovementForm({ variants }: { variants: VariantOption[] }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [type, setType] = useState<StockMovementInput["type"]>("IN");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = variants.find((v) => v.id === variantId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const base = { variantId, reason: reason || undefined };
      const data: StockMovementInput =
        type === "ADJUSTMENT" ? { ...base, type, newStock: Number(amount) } : { ...base, type, quantity: Number(amount) };
      await createStockMovement(data);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={cn(inputClass, "text-foreground")}>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.productName} — {v.name} ({v.sku})
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as StockMovementInput["type"])} className={cn(inputClass, "text-foreground")}>
          <option value="IN">Entrada (compra a proveedor)</option>
          <option value="OUT">Salida (merma, robo)</option>
          <option value="ADJUSTMENT">Ajuste por conteo físico</option>
        </select>
        <div className="relative">
          <input
            required
            type="number"
            step="0.001"
            min="0"
            placeholder={type === "ADJUSTMENT" ? "Stock real contado" : "Cantidad"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(inputClass, "w-full pr-12")}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unitShort(selected?.unitCode ?? DEFAULT_UNIT_CODE)}
          </span>
        </div>
        <input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button type="submit" size="sm" disabled={submitting || !variantId} className="self-start">
        {submitting ? "Registrando..." : "Registrar movimiento"}
      </Button>
    </form>
  );
}
