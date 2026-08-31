import "@tanstack/react-table";

// Extiende ColumnDef.meta (tipado como `unknown` por default) con un `label` legible — lo usa
// DataTableViewOptions para mostrar un nombre lindo en el toggle de columnas en vez del `id` crudo
// (ej. "totalAmount" -> "Total"). Patrón estándar de la receta de TanStack Table.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
  }
}
