"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableToolbar, type FacetConfig } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Total de páginas ya calculado en el servidor (Math.ceil(total / pageSize)). */
  pageCount: number;
  /** Total de filas que matchean el filtro actual (para el texto "Mostrando X-Y de Z"). */
  total: number;
  searchPlaceholder?: string;
  facets?: FacetConfig[];
  emptyMessage?: string;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * Contenedor genérico de tabla — el mismo componente sirve para Pedidos, Inventario, Kardex o
 * Facturación con solo cambiar `columns`/`data`/`facets`: no tiene ninguna lógica específica de un
 * tenant o de un módulo particular (eso vive en cada `columns.tsx` y en el `page.tsx` que arma el
 * query de Prisma).
 *
 * Ordenamiento/filtros/paginación son "manual" (manualSorting/manualFiltering/manualPagination):
 * la data que llega por props ya es la página actual, resuelta en el servidor — este componente
 * nunca pagina/filtra en el cliente. Cualquier cambio de estado (click en un header, tipear en el
 * buscador, tildar un filtro, cambiar de página) actualiza los searchParams de la URL vía
 * router.push(), lo que dispara un refetch del Server Component padre con los nuevos parámetros —
 * mismo patrón ya usado en CatalogFilters/catalogo del storefront, acá aplicado al panel.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  total,
  searchPlaceholder,
  facets,
  emptyMessage = "Sin resultados.",
}: Props<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const sortParam = searchParams.get("sort");
  const search = searchParams.get("search") ?? "";

  const sorting: SortingState = useMemo(() => {
    if (!sortParam) return [];
    const [id, dir] = sortParam.split(".");
    return id ? [{ id, desc: dir === "desc" }] : [];
  }, [sortParam]);

  const columnFilters: ColumnFiltersState = useMemo(
    () =>
      (facets ?? []).flatMap((facet) => {
        const raw = searchParams.get(facet.columnId);
        return raw ? [{ id: facet.columnId, value: raw.split(",") }] : [];
      }),
    [facets, searchParams],
  );

  const pagination: PaginationState = useMemo(() => ({ pageIndex: Math.max(page - 1, 0), pageSize }), [page, pageSize]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting, columnFilters, pagination },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      updateParams({ sort: first ? `${first.id}.${first.desc ? "desc" : "asc"}` : null, page: null });
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      const updates: Record<string, string | null> = { page: null };
      for (const facet of facets ?? []) {
        const values = next.find((f) => f.id === facet.columnId)?.value as string[] | undefined;
        updates[facet.columnId] = values && values.length > 0 ? values.join(",") : null;
      }
      updateParams(updates);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      updateParams({
        page: next.pageIndex === 0 ? null : String(next.pageIndex + 1),
        pageSize: next.pageSize === DEFAULT_PAGE_SIZE ? null : String(next.pageSize),
      });
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
      <DataTableToolbar
        table={table}
        searchValue={search}
        onSearchChange={(value) => updateParams({ search: value || null, page: null })}
        searchPlaceholder={searchPlaceholder}
        facets={facets}
      />

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DataTablePagination table={table} total={total} />
    </div>
  );
}
