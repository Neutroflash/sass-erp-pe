"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ImageOff } from "lucide-react";
import type { AdminCategory, AdminProduct } from "@/types/panel";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/panel/data-table/data-table-column-header";
import { EditProductDialog } from "./EditProductDialog";

function totalStock(product: AdminProduct): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}

function priceLabel(product: AdminProduct): string {
  const prices = product.variants.map((v) => v.price);
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `Desde ${formatPrice(min)}`;
}

// Genera las columnas en una función (no un array fijo) porque el estado de badge/edición
// necesita `lowStockThreshold` y `canSeeCost` del tenant/rol actual, y el diálogo de edición
// necesita la lista de categorías — ninguno de los dos existe todavía cuando se importa el módulo.
export function getInventoryColumns(categories: AdminCategory[], canSeeCost: boolean, lowStockThreshold: number): ColumnDef<AdminProduct>[] {
  return [
    {
      id: "image",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const image = row.original.images.find((img) => img.isPrimary) ?? row.original.images[0];
        return image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL arbitraria del negocio
          <img src={image.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-muted-foreground/50">
            <ImageOff className="h-4 w-4" />
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
      meta: { label: "Producto" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{row.original.name}</span>
          {row.original.brand && <span className="text-xs text-muted-foreground">{row.original.brand}</span>}
        </div>
      ),
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.id ?? "",
      header: "Categoría",
      meta: { label: "Categoría" },
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.category?.name ?? "Sin categoría"}</span>,
    },
    {
      id: "price",
      header: "Precio",
      meta: { label: "Precio" },
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm font-medium text-primary">{priceLabel(row.original)}</span>,
    },
    {
      id: "stock",
      header: "Stock",
      meta: { label: "Stock" },
      enableSorting: false,
      cell: ({ row }) => {
        const stock = totalStock(row.original);
        const variant = stock === 0 ? "destructive" : stock <= lowStockThreshold ? "outline" : "success";
        const label = stock === 0 ? "Agotado" : stock <= lowStockThreshold ? "Stock bajo" : "En stock";
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">{stock}</span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <EditProductDialog product={row.original} categories={categories} canSeeCost={canSeeCost} />
        </div>
      ),
    },
  ];
}
