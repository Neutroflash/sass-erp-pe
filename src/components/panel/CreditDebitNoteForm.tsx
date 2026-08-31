"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { issueCreditDebitNote } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

// Espeja los catálogos 09/10 de SUNAT (src/domain/invoicing/sunat/note-catalogs.ts) — duplicado a
// propósito acá en el cliente (evita un round-trip solo para poblar un <select>); si el catálogo
// del servidor cambia, este también hay que actualizarlo.
const CREDIT_NOTE_REASONS = [
  { code: "01", label: "Anulación de la operación" },
  { code: "02", label: "Anulación por error en el RUC" },
  { code: "03", label: "Corrección por error en la descripción" },
  { code: "04", label: "Descuento global" },
  { code: "05", label: "Descuento por ítem" },
  { code: "06", label: "Devolución total" },
  { code: "07", label: "Devolución por ítem" },
  { code: "08", label: "Bonificación" },
  { code: "09", label: "Disminución en el valor" },
  { code: "10", label: "Otros conceptos" },
];
const DEBIT_NOTE_REASONS = [
  { code: "01", label: "Intereses por mora" },
  { code: "02", label: "Aumento en el valor" },
  { code: "03", label: "Penalidades / otros conceptos" },
  { code: "10", label: "Otros cargos" },
];

export interface NoteSummary {
  id: string;
  type: "NOTA_CREDITO" | "NOTA_DEBITO";
  status: "DRAFT" | "PENDING_SUNAT" | "ISSUED" | "FAILED" | "VOID";
  series: string;
  number: number;
  totalAmount: number;
}

const STATUS_VARIANT: Record<NoteSummary["status"], "success" | "destructive" | "outline" | "secondary"> = {
  ISSUED: "success",
  FAILED: "destructive",
  VOID: "destructive",
  DRAFT: "outline",
  PENDING_SUNAT: "secondary",
};

export function CreditDebitNoteForm({ invoiceId, invoiceTotal, notes }: { invoiceId: string; invoiceTotal: number; notes: NoteSummary[] }) {
  const router = useRouter();
  const [type, setType] = useState<"NOTA_CREDITO" | "NOTA_DEBITO">("NOTA_CREDITO");
  const [reasonCode, setReasonCode] = useState(CREDIT_NOTE_REASONS[0].code);
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [customAmount, setCustomAmount] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reasons = type === "NOTA_CREDITO" ? CREDIT_NOTE_REASONS : DEBIT_NOTE_REASONS;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issueCreditDebitNote(invoiceId, {
        type,
        reasonCode,
        mode,
        customAmount: mode === "CUSTOM" ? Number(customAmount) : undefined,
        customDescription: mode === "CUSTOM" ? customDescription : undefined,
      });
      setOpen(false);
      setCustomAmount("");
      setCustomDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo emitir la nota");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Notas de crédito/débito</span>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Emitir nota
          </Button>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin notas emitidas contra este comprobante.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-1.5">
          {notes.map((note) => (
            <div key={note.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground/90">
                {note.type === "NOTA_CREDITO" ? "N. Crédito" : "N. Débito"} {note.series}-{note.number}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">S/ {note.totalAmount.toFixed(2)}</span>
                <Badge variant={STATUS_VARIANT[note.status]}>{note.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border/60 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Tipo</label>
              <select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as "NOTA_CREDITO" | "NOTA_DEBITO";
                  setType(next);
                  setReasonCode((next === "NOTA_CREDITO" ? CREDIT_NOTE_REASONS : DEBIT_NOTE_REASONS)[0].code);
                }}
                className={cn(inputClass, "w-full")}
              >
                <option value="NOTA_CREDITO">Nota de crédito</option>
                <option value="NOTA_DEBITO">Nota de débito</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Motivo</label>
              <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={cn(inputClass, "w-full")}>
                {reasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Alcance</label>
            <div className="flex gap-4 text-sm text-foreground/90">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === "FULL"} onChange={() => setMode("FULL")} />
                Monto completo (S/ {invoiceTotal.toFixed(2)})
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === "CUSTOM"} onChange={() => setMode("CUSTOM")} />
                Monto personalizado
              </label>
            </div>
          </div>

          {mode === "CUSTOM" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-foreground/90">
                Monto (con IGV)
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-foreground/90">
                Descripción
                <input required value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} className={inputClass} />
              </label>
            </div>
          )}

          {error && <span className="text-sm text-destructive">{error}</span>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Emitiendo..." : "Emitir nota"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
