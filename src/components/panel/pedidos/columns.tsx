"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/domain/orders/order-status";
import { DataTableColumnHeader } from "@/components/panel/data-table/data-table-column-header";
import { OrderRowActions } from "./order-row-actions";

export interface AdminOrderRow {
  id: string;
  status: "PENDING_PAYMENT" | "PENDING_COLLECTION" | "PAID" | "IN_PREPARATION" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  channel: "ONLINE" | "POS";
  totalAmount: number;
  customerName: string;
  customerPhone: string | null;
  createdAt: string;
  itemCount: number;
}

const CHANNEL_LABEL: Record<AdminOrderRow["channel"], string> = {
  ONLINE: "Tienda online",
  POS: "Punto de venta",
};

export const columns: ColumnDef<AdminOrderRow>[] = [
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
    accessorKey: "customerName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    meta: { label: "Cliente" },
    cell: ({ row }) => (
      <span className="text-sm text-foreground/90">
        {row.original.customerName}
        {row.original.customerPhone && <span className="ml-1 text-muted-foreground">({row.original.customerPhone})</span>}
      </span>
    ),
  },
  {
    accessorKey: "channel",
    header: "Canal",
    meta: { label: "Canal" },
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{CHANNEL_LABEL[row.original.channel]}</span>,
  },
  {
    accessorKey: "itemCount",
    header: "Ítems",
    meta: { label: "Ítems" },
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm text-foreground">{row.original.itemCount}</span>,
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
    cell: ({ row }) => <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <OrderRowActions order={row.original} />
      </div>
    ),
  },
];
