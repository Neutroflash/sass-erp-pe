"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, AdminProductVariant } from "@/types/panel";
import { updateVariant } from "@/lib/panel-mutations";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

function VariantRow({ variant }: { variant: AdminProductVariant }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(variant.price));
  const [costPrice, setCostPrice] = useState(String(variant.costPrice));
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateVariant(variant.id, { price: Number(price), costPrice: Number(costPrice), stock: Number(stock) });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const margin = Number(price) - Number(costPrice);
  const marginPct = Number(price) > 0 ? (margin / Number(price)) * 100 : 0;

  return (
    <tr className="border-b border-zinc-800/60 transition-colors hover:bg-white/[0.03]">
      <td className="p-3 pl-8 text-sm text-zinc-400">{variant.sku}</td>
      <td className="p-3">
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={cn(inputClass, "w-24")} />
      </td>
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
        <span className="text-zinc-500">({marginPct.toFixed(0)}%)</span>
      </td>
      <td className="p-3">
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={cn(inputClass, "w-20")} />
      </td>
      <td className="p-3 text-sm text-zinc-500">{variant.reservedStock}</td>
      <td className="p-3">
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </td>
    </tr>
  );
}

function ProductGroup({ product }: { product: AdminProduct }) {
  return (
    <>
      <tr className="border-b border-zinc-800/60 bg-white/[0.02]">
        <td colSpan={7} className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-zinc-100">{product.name}</span>
              {product.brand && <span className="ml-2 text-xs text-zinc-500">{product.brand}</span>}
            </div>
            <span className="text-xs text-zinc-500">{product.category?.name ?? "Sin categoría"}</span>
          </div>
        </td>
      </tr>
      {product.variants.map((variant) => (
        <VariantRow key={variant.id} variant={variant} />
      ))}
    </>
  );
}

export function InventoryTable({ products }: { products: AdminProduct[] }) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-zinc-500">Todavía no hay productos — creá el primero.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
      <table className="w-full text-left">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="p-3">SKU</th>
            <th className="p-3">Precio</th>
            <th className="p-3">Costo</th>
            <th className="p-3">Margen</th>
            <th className="p-3">Stock</th>
            <th className="p-3">Reservado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductGroup key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
