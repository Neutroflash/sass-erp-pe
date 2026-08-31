import { useEffect, useState } from "react";
import type { PublicProduct } from "@/domain/inventory/product";

const DEBOUNCE_MS = 250;
// Alimenta un dropdown, no una página de resultados — "Ver todos los resultados" en SearchBox es
// lo que lleva al comprador al /catalogo completo y paginado.
const LIVE_RESULTS_LIMIT = 6;

/**
 * Búsqueda en vivo con debounce, filtrando desde el primer carácter — sin necesidad de Enter.
 * Se protege de respuestas fuera de orden (una request lenta de una tecla anterior que resuelve
 * después de una más nueva) con un flag `cancelled`, ya que el debounce por sí solo solo frena
 * requests que nunca llegaron a salir, no las que ya están en vuelo.
 */
export function useProductSearch(query: string) {
  const [results, setResults] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(trimmed)}&limit=${LIVE_RESULTS_LIMIT}`);
        const data = res.ok ? ((await res.json()) as { items: PublicProduct[] }) : { items: [] };
        if (!cancelled) setResults(data.items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { results, loading };
}
