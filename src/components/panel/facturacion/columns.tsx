"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { DataTableColumnHeader } from "@/components/panel/data-table/data-table-column-header";
import { InvoiceRowActions } from "./invoice-row-actions";

export interface AdminInvoiceRow {
  id: string;
  createdAt: string;
  type: "BOLETA" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
  series: string;
  number: number;
  documentType: string;
  documentNumber: string;
  businessName: string | null;
  totalAmount: number;
  status: "DRAFT" | "PENDING_SUNAT" | "ISSUED" | "FAILED" | "VOID";
  orderId: string | null;
  correctsLabel: string | null;
}

export const TYPE_LABEL: Record<AdminInvoiceRow["type"], string> = {
  BOLETA: "Boleta",
  FACTURA: "Factura",
  NOTA_CREDITO: "N. Crédito",
  NOTA_DEBITO: "N. Débito",
};

export const STATUS_LABEL: Record<AdminInvoiceRow["status"], string> = {
  ISSUED: "Emitido",
  FAILED: "Rechazado",
  VOID: "Anulado",
  DRAFT: "Borrador",
  PENDING_SUNAT: "Pendiente de envío",
};

const STATUS_VARIANT: Record<AdminInvoiceRow["status"], "success" | "destructive" | "outline" | "secondary"> = {
  ISSUED: "success",
  FAILED: "destructive",
  VOID: "destructive",
  DRAFT: "outline",
  PENDING_SUNAT: "secondary",
};

export const columns: ColumnDef<AdminInvoiceRow>[] = [
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
    // accessorKey "type" (no "series") a propósito: es el id que usa el filtro facetado de Tipo
    // en facturacion/page.tsx (`table.getColumn("type")`) — el accessor en sí no importa para el
    // render, esta columna igual muestra tipo+serie+número combinados vía la celda de abajo.
    accessorKey: "type",
    header: "Comprobante",
    meta: { label: "Comprobante" },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-foreground">
        {TYPE_LABEL[row.original.type]} {row.original.series}-{row.original.number}
        {row.original.correctsLabel && <span className="ml-1 text-xs text-muted-foreground">(corrige {row.original.correctsLabel})</span>}
      </span>
    ),
  },
  {
    accessorKey: "documentNumber",
    header: "Cliente",
    meta: { label: "Cliente" },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.documentType} {row.original.documentNumber}
        {row.original.businessName ? ` · ${row.original.businessName}` : ""}
      </span>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    meta: { label: "Total" },
    cell: ({ row }) => <span className="text-sm font-medium text-primary">{formatPrice(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Estado",
    meta: { label: "Estado" },
    enableSorting: false,
    cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <InvoiceRowActions invoice={row.original} />
      </div>
    ),
  },
];
