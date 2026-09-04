"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { createCustomer, searchCustomers, type CustomerSummary } from "@/lib/panel-mutations";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

/**
 * Buscador de clientes con alta rápida.
 *
 * El alta pide solo nombre, teléfono y dirección — los tres datos que el negocio dijo que anota de
 * alguien que le queda debiendo. Documento NO se pide acá a propósito: se fía a gente que uno
 * conoce, y exigirlo en el mostrador trabaría la venta. Se completa después, cuando haya que
 * emitir un comprobante que lo necesite.
 */
export function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: CustomerSummary | null;
  onSelect: (customer: CustomerSummary | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    // Debounce + descarte de respuestas viejas: sin el contador, una búsqueda lenta de "ju" puede
    // llegar después de la de "juan" y pisar los resultados correctos con los anteriores.
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { items } = await searchCustomers(term);
        if (id === requestId.current) setResults(items);
      } catch {
        if (id === requestId.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleCreate() {
    if (draft.name.trim().length < 2) {
      setError("Escribe el nombre del cliente");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { customer } = await createCustomer({
        name: draft.name.trim(),
        phone: draft.phone.trim() || undefined,
        address: draft.address.trim() || undefined,
      });
      onSelect(customer);
      setCreating(false);
      setDraft({ name: "", phone: "", address: "" });
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-input px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selected.phone ?? "sin teléfono"}
            {selected.outstanding > 0 && (
              <>
                {" · "}
                <span className="text-amber-500">debe {formatPrice(selected.outstanding)}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Quitar cliente"
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-input/50 p-3">
        <input autoFocus placeholder="Nombre *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
        <input placeholder="Teléfono" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} />
        <input placeholder="Dirección" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={inputClass} />
        {error && <span className="text-xs text-destructive">{error}</span>}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={handleCreate}>
            {busy ? "Guardando..." : "Guardar cliente"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setError(null); }}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        placeholder="Buscar cliente por nombre o teléfono..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(inputClass, "pl-9")}
      />
      {query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border/80 bg-card shadow-xl">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => { onSelect(customer); setQuery(""); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-foreground">{customer.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{customer.phone ?? "sin teléfono"}</span>
              </span>
              {customer.outstanding > 0 && (
                <span className="shrink-0 text-xs text-amber-500">debe {formatPrice(customer.outstanding)}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setCreating(true); setDraft({ name: query.trim(), phone: "", address: "" }); }}
            className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent"
          >
            <UserPlus className="h-4 w-4" />
            {results.length === 0 ? `Crear "${query.trim()}"` : "Crear un cliente nuevo"}
          </button>
        </div>
      )}
    </div>
  );
}
