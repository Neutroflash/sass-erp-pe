"use client";

import { useEffect, useState } from "react";
import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableFacetedFilter, type FacetOption } from "./data-table-faceted-filter";

export interface FacetConfig {
  columnId: string;
  title: string;
  options: FacetOption[];
}

interface Props<TData> {
  table: Table<TData>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  facets?: FacetConfig[];
}

const SEARCH_DEBOUNCE_MS = 350;

export function DataTableToolbar<TData>({ table, searchValue, onSearchChange, searchPlaceholder, facets }: Props<TData>) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  // Si el valor "de verdad" (URL) cambia por otra vía (ej. el botón "Limpiar"), el input local se
  // re-sincroniza — sin esto quedaría mostrando texto viejo después de limpiar filtros.
  useEffect(() => setLocalSearch(searchValue), [searchValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localSearch !== searchValue) onSearchChange(localSearch);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const isFiltered = table.getState().columnFilters.length > 0 || searchValue.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={searchPlaceholder ?? "Buscar..."}
            className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>

        {facets?.map((facet) => {
          const column = table.getColumn(facet.columnId);
          if (!column) return null;
          return <DataTableFacetedFilter key={facet.columnId} column={column} title={facet.title} options={facet.options} />;
        })}

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalSearch("");
              onSearchChange("");
              table.resetColumnFilters();
            }}
          >
            Limpiar
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <DataTableViewOptions table={table} />
    </div>
  );
}
