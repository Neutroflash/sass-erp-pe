"use client";

import { Check, PlusCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FacetOption {
  label: string;
  value: string;
}

interface Props<TData, TValue> {
  column?: Column<TData, TValue>;
  title: string;
  options: FacetOption[];
}

// Multi-select facetado (mismo patrón que el data-table de shadcn, sin cmdk: la lista de opciones
// acá es siempre chica — categorías/estados de UN tenant — no hace falta un buscador fuzzy adentro
// del popover). El valor seleccionado vive en `column.getFilterValue()`, no en estado propio: quien
// arma el DataTable decide si eso sincroniza a la URL o no (ver data-table.tsx).
export function DataTableFacetedFilter<TData, TValue>({ column, title, options }: Props<TData, TValue>) {
  const selected = new Set((column?.getFilterValue() as string[] | undefined) ?? []);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const arr = Array.from(next);
    column?.setFilterValue(arr.length > 0 ? arr : undefined);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="h-3.5 w-3.5" />
          {title}
          {selected.size > 0 && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              {selected.size > 2 ? (
                <Badge variant="secondary" className="rounded-md px-1.5 font-normal">
                  {selected.size} seleccionados
                </Badge>
              ) : (
                options
                  .filter((option) => selected.has(option.value))
                  .map((option) => (
                    <Badge key={option.value} variant="secondary" className="rounded-md px-1.5 font-normal">
                      {option.label}
                    </Badge>
                  ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex flex-col gap-0.5">
          {options.map((option) => {
            const isSelected = selected.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate text-foreground">{option.label}</span>
              </button>
            );
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => column?.setFilterValue(undefined)}
              className="mt-1 rounded-lg border-t border-border px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
