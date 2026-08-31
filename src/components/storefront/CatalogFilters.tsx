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
  activeSearch?: string;
}

// Componente de servidor puro (sin "use client"): un <form method="GET"> nativo + <Link>s ya
// cubren el filtro entero sin JS extra en el cliente — searchParams es la única fuente de verdad,
// exactamente como catalogo/page.tsx ya la lee.
export function CatalogFilters({ categories, activeCategory, activeSearch }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <form method="GET" action="/catalogo" className="flex max-w-sm items-center gap-2">
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
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

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={activeSearch ? `/catalogo?search=${encodeURIComponent(activeSearch)}` : "/catalogo"}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !activeCategory
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            Todas
          </Link>
          {categories.map((category) => {
            const params = new URLSearchParams();
            params.set("category", category.slug);
            if (activeSearch) params.set("search", activeSearch);
            const active = category.slug === activeCategory;
            return (
              <Link
                key={category.slug}
                href={`/catalogo?${params.toString()}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {category.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
