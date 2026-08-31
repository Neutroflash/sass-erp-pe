"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, AdminProductVariant } from "@/types/panel";
import { updateVariant } from "@/lib/panel-mutations";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

function VariantRow({ variant, canSeeCost }: { variant: AdminProductVariant; canSeeCost: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(variant.price));
  const [costPrice, setCostPrice] = useState(String(variant.costPrice));
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // Un SELLER (canSeeCost=false) nunca manda costPrice en el payload — ni siquiera el valor sin
      // tocar del prop, para no depender de que el backend lo ignore silenciosamente (que además no
      // hace: PATCH .../variants/[id] rechaza con 403 si costPrice viene de alguien que no es OWNER).
      await updateVariant(variant.id, { price: Number(price), stock: Number(stock), ...(canSeeCost ? { costPrice: Number(costPrice) } : {}) });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const margin = Number(price) - Number(costPrice);
  const marginPct = Number(price) > 0 ? (margin / Number(price)) * 100 : 0;

  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-accent">
      <td className="p-3 pl-8 text-sm text-muted-foreground">{variant.sku}</td>
      <td className="p-3">
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={cn(inputClass, "w-24")} />
      </td>
      {canSeeCost && (
        <>
          <td className="p-3">
            <input
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className={cn(inputClass, "w-24")}
            />
          </td>
          <td className="p-3 text-sm">
            <span className={margin >= 0 ? "text-emerald-400" : "text-red-400"}>{formatPrice(margin)}</span>{" "}
            <span className="text-muted-foreground">({marginPct.toFixed(0)}%)</span>
          </td>
        </>
      )}
      <td className="p-3">
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={cn(inputClass, "w-20")} />
      </td>
      <td className="p-3 text-sm text-muted-foreground">{variant.reservedStock}</td>
      <td className="p-3">
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </td>
    </tr>
  );
}

function ProductGroup({ product, canSeeCost, columnCount }: { product: AdminProduct; canSeeCost: boolean; columnCount: number }) {
  return (
    <>
      <tr className="border-b border-border/60 bg-accent">
        <td colSpan={columnCount} className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-foreground">{product.name}</span>
              {product.brand && <span className="ml-2 text-xs text-muted-foreground">{product.brand}</span>}
            </div>
            <span className="text-xs text-muted-foreground">{product.category?.name ?? "Sin categoría"}</span>
          </div>
        </td>
      </tr>
      {product.variants.map((variant) => (
        <VariantRow key={variant.id} variant={variant} canSeeCost={canSeeCost} />
      ))}
    </>
  );
}

// costo/margen visibles solo para OWNER — ver el comentario en PATCH .../variants/[id]/route.ts y
// en la GET de /api/products sobre por qué un SELLER nunca los ve, ni siquiera de solo lectura.
export function InventoryTable({ products, canSeeCost }: { products: AdminProduct[]; canSeeCost: boolean }) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Todavía no hay productos — creá el primero.</p>;
  }

  const columnCount = canSeeCost ? 7 : 5;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
      <table className="w-full text-left">
        <thead className="bg-accent text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-3">SKU</th>
            <th className="p-3">Precio</th>
            {canSeeCost && (
              <>
                <th className="p-3">Costo</th>
                <th className="p-3">Margen</th>
              </>
            )}
            <th className="p-3">Stock</th>
            <th className="p-3">Reservado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductGroup key={product.id} product={product} canSeeCost={canSeeCost} columnCount={columnCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
