"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { AdminCategory } from "@/types/panel";
import { createCategory, createProduct, CreateProductVariantInput } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-zinc-100 outline-none transition-colors focus:border-primary/50";

interface VariantDraft extends CreateProductVariantInput {
  attributesList: { key: string; value: string }[];
}

function emptyVariant(): VariantDraft {
  return { sku: "", name: "", price: 0, costPrice: 0, stock: 0, attributesList: [{ key: "", value: "" }] };
}

export function CreateProductForm({ categories: initialCategories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [isFeatured, setIsFeatured] = useState(false);
  const [newCategoryMode, setNewCategoryMode] = useState(initialCategories.length === 0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const { category } = await createCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, category]);
      setCategoryId(category.id);
      setNewCategoryName("");
      setNewCategoryMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la categoría");
    } finally {
      setCreatingCategory(false);
    }
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }
  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }
  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function addAttribute(vIndex: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === vIndex ? { ...v, attributesList: [...v.attributesList, { key: "", value: "" }] } : v)),
    );
  }
  function updateAttribute(vIndex: number, aIndex: number, patch: Partial<{ key: string; value: string }>) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === vIndex ? { ...v, attributesList: v.attributesList.map((a, j) => (j === aIndex ? { ...a, ...patch } : a)) } : v,
      ),
    );
  }
  function removeAttribute(vIndex: number, aIndex: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === vIndex ? { ...v, attributesList: v.attributesList.filter((_, j) => j !== aIndex) } : v)),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createProduct({
        name,
        description: description || undefined,
        brand: brand || undefined,
        categoryId: categoryId || undefined,
        isFeatured,
        variants: variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          price: v.price,
          costPrice: v.costPrice,
          stock: v.stock,
          attributes: Object.fromEntries(v.attributesList.filter((a) => a.key.trim()).map((a) => [a.key, a.value])),
        })),
      });
      // No hay página de detalle/edición de producto todavía (más allá de precio/costo/stock por
      // variante, ya editable inline en /panel/inventario) — pendiente, ver el roadmap.
      router.push("/panel/inventario");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el producto");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-zinc-300">Nombre</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-zinc-300">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(inputClass, "h-auto py-2")} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-300">Marca</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-300">Categoría</label>
          {!newCategoryMode ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(inputClass, "flex-1")}>
                {categories.length === 0 && <option value="">Sin categorías todavía</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setNewCategoryMode(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className={cn(inputClass, "flex-1")}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={creatingCategory} onClick={handleCreateCategory}>
                  {creatingCategory ? "Creando..." : "Crear"}
                </Button>
                {categories.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNewCategoryMode(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 self-end text-sm text-zinc-300">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Producto destacado
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Variantes</h2>
          <Button type="button" size="sm" variant="outline" onClick={addVariant}>
            <Plus className="h-3.5 w-3.5" />
            Agregar variante
          </Button>
        </div>

        {variants.map((variant, vIndex) => (
          <div key={vIndex} className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input required placeholder="SKU" value={variant.sku} onChange={(e) => updateVariant(vIndex, { sku: e.target.value })} className={inputClass} />
              <input
                required
                placeholder="Nombre de variante"
                value={variant.name}
                onChange={(e) => updateVariant(vIndex, { name: e.target.value })}
                className={inputClass}
              />
              <input
                required
                type="number"
                step="0.01"
                placeholder="Precio"
                value={variant.price || ""}
                onChange={(e) => updateVariant(vIndex, { price: Number(e.target.value) })}
                className={inputClass}
              />
              <input
                required
                type="number"
                step="0.01"
                placeholder="Costo"
                value={variant.costPrice || ""}
                onChange={(e) => updateVariant(vIndex, { costPrice: Number(e.target.value) })}
                className={inputClass}
              />
              <input
                required
                type="number"
                placeholder="Stock inicial"
                value={variant.stock || ""}
                onChange={(e) => updateVariant(vIndex, { stock: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wide text-zinc-500">Atributos (switch, color, talla...)</label>
                <button type="button" onClick={() => addAttribute(vIndex)} className="text-xs text-primary hover:text-yellow-300">
                  + agregar atributo
                </button>
              </div>
              {variant.attributesList.map((attr, aIndex) => (
                <div key={aIndex} className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <input
                      placeholder="clave (ej. switch)"
                      value={attr.key}
                      onChange={(e) => updateAttribute(vIndex, aIndex, { key: e.target.value })}
                      className={cn(inputClass, "flex-1")}
                    />
                    <input
                      placeholder="valor (ej. Red)"
                      value={attr.value}
                      onChange={(e) => updateAttribute(vIndex, aIndex, { value: e.target.value })}
                      className={cn(inputClass, "flex-1")}
                    />
                  </div>
                  {variant.attributesList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAttribute(vIndex, aIndex)}
                      className="shrink-0 pt-2 text-zinc-500 hover:text-red-400"
                      aria-label="Quitar atributo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {variants.length > 1 && (
              <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => removeVariant(vIndex)}>
                <Trash2 className="h-3.5 w-3.5" />
                Quitar variante
              </Button>
            )}
          </div>
        ))}
      </div>

      {error && <span className="text-sm text-destructive">{error}</span>}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Creando..." : "Crear producto"}
      </Button>
    </form>
  );
}
