import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  slug: string;
  name: string;
}

interface Props {
  categories: Category[];
  activeCategory?: string;
  activeFilter?: string;
  activeSearch?: string;
}

function pillHref(params: { filter?: string; category?: string; search?: string }): string {
  const qs = new URLSearchParams();
  if (params.filter) qs.set("filter", params.filter);
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

// Componente de servidor puro (sin "use client"): un <form method="GET"> nativo + <Link>s ya
// cubren el filtro entero sin JS extra en el cliente — searchParams es la única fuente de verdad,
// exactamente como catalogo/page.tsx ya la lee. "filter" (destacados/nuevo) y "category" son ejes
// independientes: elegir uno limpia el otro, para que la barra de pills se lea como una sola
// selección, tal como la pide el diseño.
export function CatalogFilters({ categories, activeCategory, activeFilter, activeSearch }: Props) {
  const pills: { key?: string; label: string }[] = [
    { key: undefined, label: "Todos" },
    { key: "destacados", label: "Destacados" },
    { key: "nuevo", label: "Lo Nuevo" },
  ];

  return (
    <div className="sticky top-20 z-30 -mx-4 mb-6 flex flex-col gap-4 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
      <form method="GET" action="/catalogo" className="flex max-w-sm items-center gap-2">
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={activeSearch}
            placeholder="Buscar productos..."
            className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const active = activeFilter === pill.key;
          return (
            <Link
              key={pill.label}
              href={pillHref({ filter: pill.key, search: activeSearch })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {pill.label}
            </Link>
          );
        })}
        {categories.map((category) => {
          const active = category.slug === activeCategory;
          return (
            <Link
              key={category.slug}
              href={pillHref({ category: category.slug, search: activeSearch })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {category.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
