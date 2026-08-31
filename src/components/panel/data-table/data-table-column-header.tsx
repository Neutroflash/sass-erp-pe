"use client";

import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

// Ciclo de 2 estados (asc <-> desc), no 3 (con "sin orden" de vuelta) — mismo criterio que la
// receta estándar de shadcn: una vez que el usuario ordenó por una columna, volver a "sin orden"
// no aporta nada que "ordenar por fecha desc" (el default) no dé ya.
export function DataTableColumnHeader<TData, TValue>({ column, title, className }: Props<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn("flex items-center gap-1.5 transition-colors hover:text-foreground", className)}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-primary" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}
