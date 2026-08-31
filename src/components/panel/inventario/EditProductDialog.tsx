"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { AdminCategory, AdminProduct } from "@/types/panel";
import {
  createCategory,
  updateProduct,
  updateVariant,
  addProductImage,
  updateProductImage,
  deleteProductImage,
} from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatPrice } from "@/lib/utils";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

interface Props {
  product: AdminProduct;
  categories: AdminCategory[];
  canSeeCost: boolean;
}

// Arregla un hueco real del panel: PATCH /api/products/[id] y updateProduct() (lib/panel-mutations)
// ya existían, pero ningún botón los llamaba — un producto solo podía editarse al crearlo. Este
// diálogo es ese botón que faltaba, y de paso junta en un solo lugar todo lo editable de un
// producto (datos, imágenes, precio/costo/stock por variante) en vez de tenerlo desparramado.
export function EditProductDialog({ product, categories: initialCategories, canSeeCost }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);

  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [categoryId, setCategoryId] = useState(product.category?.id ?? "");
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState(product.images);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [addingImage, setAddingImage] = useState(false);

  async function handleSaveInfo() {
    setSavingInfo(true);
    setError(null);
    try {
      await updateProduct(product.id, { name, brand: brand || undefined, categoryId: categoryId || undefined, isFeatured });
      router.refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const { category } = await createCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, category]);
      setCategoryId(category.id);
      setNewCategoryName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la categoría");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleAddImage() {
    if (!newImageUrl.trim()) return;
    setAddingImage(true);
    try {
      await addProductImage(product.id, { url: newImageUrl.trim(), isPrimary: images.length === 0 });
      router.refresh();
      setNewImageUrl("");
      // Optimista: el refresh del server component ya trae la lista real, pero sin esto la fila
      // recién agregada no aparece hasta que termine ese refresh (sensación de que no pasó nada).
      setImages((prev) => [...prev, { id: `pending-${Date.now()}`, url: newImageUrl.trim(), altText: null, isPrimary: prev.length === 0 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la imagen");
    } finally {
      setAddingImage(false);
    }
  }

  async function handleSetPrimaryImage(imageId: string) {
    await updateProductImage(imageId, { isPrimary: true });
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
    router.refresh();
  }

  async function handleRemoveImage(imageId: string) {
    await deleteProductImage(imageId);
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${product.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-foreground/90">Nombre</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground/90">Marca</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground/90">Categoría</label>
              <div className="flex gap-2">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(inputClass, "flex-1")}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                placeholder="Crear categoría nueva..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className={cn(inputClass, "flex-1")}
              />
              <Button type="button" size="sm" variant="outline" disabled={creatingCategory || !newCategoryName.trim()} onClick={handleCreateCategory}>
                {creatingCategory ? "Creando..." : "Crear"}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground/90 sm:col-span-2">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
              Producto destacado
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imágenes</span>
            {images.map((image) => (
              <div key={image.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL arbitraria del negocio, no un asset propio */}
                <img src={image.url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                <span className="flex-1 truncate text-xs text-muted-foreground">{image.url}</span>
                <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <input type="radio" name="primary" checked={image.isPrimary} onChange={() => handleSetPrimaryImage(image.id)} className="accent-primary" />
                  Principal
                </label>
                <button type="button" onClick={() => handleRemoveImage(image.id)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Quitar imagen">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                placeholder="https://... (URL de la nueva imagen)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className={cn(inputClass, "flex-1")}
              />
              <Button type="button" size="sm" variant="outline" disabled={addingImage || !newImageUrl.trim()} onClick={handleAddImage}>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/40 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variantes</span>
            {product.variants.map((variant) => (
              <VariantEditRow key={variant.id} variant={variant} canSeeCost={canSeeCost} />
            ))}
          </div>

          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button type="button" disabled={savingInfo} onClick={handleSaveInfo}>
            {savingInfo ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantEditRow({ variant, canSeeCost }: { variant: AdminProduct["variants"][number]; canSeeCost: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(variant.price));
  const [costPrice, setCostPrice] = useState(String(variant.costPrice));
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateVariant(variant.id, { price: Number(price), stock: Number(stock), ...(canSeeCost ? { costPrice: Number(costPrice) } : {}) });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const margin = Number(price) - Number(costPrice);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-2">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {variant.name} <span className="text-muted-foreground/70">({variant.sku})</span>
      </span>
      <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={cn(inputClass, "w-20")} title="Precio" />
      {canSeeCost && (
        <>
          <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={cn(inputClass, "w-20")} title="Costo" />
          <span className={cn("w-16 shrink-0 text-xs", margin >= 0 ? "text-emerald-400" : "text-destructive")}>{formatPrice(margin)}</span>
        </>
      )}
      <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={cn(inputClass, "w-16")} title="Stock" />
      <Button size="sm" disabled={saving} onClick={handleSave}>
        {saving ? "..." : "Guardar"}
      </Button>
    </div>
  );
}
