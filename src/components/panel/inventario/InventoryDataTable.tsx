"use client";

import { useMemo } from "react";
import type { AdminCategory, AdminProduct } from "@/types/panel";
import { DataTable } from "@/components/panel/data-table/data-table";
import { getInventoryColumns } from "./columns";

interface Props {
  products: AdminProduct[];
  categories: AdminCategory[];
  canSeeCost: boolean;
  lowStockThreshold: number;
  pageCount: number;
  total: number;
}

// Wrapper delgado, client-only: arma las columnas con `categories`/`canSeeCost`/`lowStockThreshold`
// (datos que el Server Component de la página ya resolvió) — no puede hacerse en el propio
// page.tsx porque getInventoryColumns vive en un módulo "use client" (por EditProductDialog
// adentro de sus celdas) y un Server Component no puede invocar funciones de ahí directamente,
// solo pasar props planas hacia un componente cliente como este.
export function InventoryDataTable({ products, categories, canSeeCost, lowStockThreshold, pageCount, total }: Props) {
  const columns = useMemo(
    () => getInventoryColumns(categories, canSeeCost, lowStockThreshold),
    [categories, canSeeCost, lowStockThreshold],
  );

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  return (
    <DataTable
      columns={columns}
      data={products}
      pageCount={pageCount}
      total={total}
      searchPlaceholder="Buscar por nombre, marca o SKU..."
      facets={[{ columnId: "category", title: "Categoría", options: categoryOptions }]}
      emptyMessage="Todavía no hay productos — creá el primero."
    />
  );
}
