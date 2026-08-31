"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/panel/data-table/data-table-column-header";

export interface AdminMovementRow {
  id: string;
  createdAt: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason: string | null;
  productName: string;
  variantName: string;
  sku: string;
  createdByName: string;
}

export const TYPE_LABEL: Record<AdminMovementRow["type"], string> = {
  IN: "Entrada",
  OUT: "Salida",
  ADJUSTMENT: "Ajuste",
};

const TYPE_VARIANT: Record<AdminMovementRow["type"], "success" | "destructive" | "outline"> = {
  IN: "success",
  OUT: "destructive",
  ADJUSTMENT: "outline",
};

// Sin columna de acciones a propósito: el Kardex es un registro inmutable — "nunca se edita ni se
// borra una fila existente, una corrección se hace con un movimiento ADJUSTMENT nuevo" (ver el
// comentario del modelo StockMovement en schema.prisma). No hay nada que un menú "..." pueda ofrecer.
export const columns: ColumnDef<AdminMovementRow>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
    meta: { label: "Fecha" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {new Date(row.original.createdAt).toLocaleString("es-PE")}
      </span>
    ),
  },
  {
    accessorKey: "productName",
    header: "Producto",
    meta: { label: "Producto" },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-foreground/90">
        {row.original.productName} — {row.original.variantName} <span className="text-muted-foreground">({row.original.sku})</span>
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: "Tipo",
    meta: { label: "Tipo" },
    enableSorting: false,
    cell: ({ row }) => <Badge variant={TYPE_VARIANT[row.original.type]}>{TYPE_LABEL[row.original.type]}</Badge>,
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad" />,
    meta: { label: "Cantidad" },
    cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.quantity}</span>,
  },
  {
    accessorKey: "reason",
    header: "Motivo",
    meta: { label: "Motivo" },
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reason ?? "—"}</span>,
  },
  {
    accessorKey: "createdByName",
    header: "Registrado por",
    meta: { label: "Registrado por" },
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.createdByName}</span>,
  },
];
