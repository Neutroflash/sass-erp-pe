"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useProductSearch } from "@/hooks/useProductSearch";
import { formatPrice, cn } from "@/lib/utils";

interface Props {
  variant: "mobile" | "desktop";
  /** Solo mobile: colapsa la barra expandida de vuelta al botón de ícono. */
  onClose?: () => void;
}

// Dropdown de búsqueda en vivo del Navbar — mismo patrón que flashkings-frontend
// (components/layout/SearchBox.tsx), portado a los tokens de tema de este proyecto
// (border-border/bg-card/text-primary en vez de border-white/10/bg-zinc-950/text-yellow-400) para
// que se vea bien en claro/oscuro y con el color de marca de cada tenant.
export function SearchBox({ variant, onClose }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { results, loading } = useProductSearch(query);

  useEffect(() => {
    setOpen(query.trim().length > 0);
  }, [query]);

  // Cierra con un click afuera — un simple blur también dispararía al hacer click en un
  // resultado, cerrando el dropdown antes de que el click del Link llegue a registrarse.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function goToFullResults() {
    const trimmed = query.trim();
    setOpen(false);
    router.push(trimmed ? `/catalogo?search=${encodeURIComponent(trimmed)}` : "/catalogo");
    onClose?.();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goToFullResults();
  }

  function handleSelectResult() {
    setOpen(false);
    setQuery("");
    onClose?.();
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        // Desktop es un flex-item directo de la fila del Navbar: ml-auto absorbe TODO el espacio
        // libre a su izquierda (aunque flex-1 se frene en max-w-md antes de llegar ahí), así el
        // buscador + los íconos de la derecha quedan pegados al borde derecho de la barra en vez
        // de dejar un hueco muerto — el mismo problema ya resuelto una vez en Flashkings.
        variant === "desktop" ? "ml-auto hidden max-w-md flex-1 sm:block" : "w-full",
      )}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus={variant === "mobile"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            placeholder="Buscar productos..."
            className="h-10 w-full rounded-full border border-border bg-accent pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>
        {variant === "mobile" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar búsqueda"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card/95 shadow-xl shadow-black/30 backdrop-blur-xl">
          {loading && results.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Buscando...</p>}

          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para &quot;{query.trim()}&quot;</p>
          )}

          {results.map((product) => {
            const image = product.images.find((img) => img.isPrimary) ?? product.images[0];
            const price = product.variants[0]?.price;
            return (
              <Link
                key={product.id}
                href={`/producto/${product.slug}`}
                onClick={handleSelectResult}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent"
              >
                {image ? (
                  <Image
                    src={image.url}
                    alt={product.name}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-accent" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{product.name}</p>
                  {product.brand && <p className="truncate text-xs text-muted-foreground">{product.brand}</p>}
                </div>
                {price !== undefined && <span className="shrink-0 text-sm font-semibold text-primary">{formatPrice(price)}</span>}
              </Link>
            );
          })}

          {results.length > 0 && (
            <button
              type="button"
              onClick={goToFullResults}
              className="w-full border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-accent"
            >
              Ver todos los resultados
            </button>
          )}
        </div>
      )}
    </div>
  );
}
