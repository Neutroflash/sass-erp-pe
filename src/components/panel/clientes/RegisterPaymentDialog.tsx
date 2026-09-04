"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { registerPayment, type RegisterPaymentInput } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatPrice, cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

const METHODS: RegisterPaymentInput["method"][] = ["EFECTIVO", "TRANSFERENCIA", "YAPE", "PLIN", "TARJETA", "OTRO"];

const METHOD_LABEL: Record<NonNullable<RegisterPaymentInput["method"]>, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

/**
 * Registrar un abono.
 *
 * El formulario pide un monto y nada más — deliberadamente NO pregunta contra qué venta se aplica.
 * El negocio cobra por persona ("me pagó S/ 100"), no por pedido, y el reparto entre las ventas
 * abiertas lo resuelve el servidor de la más antigua a la más nueva. Preguntarlo acá convertiría
 * un gesto de dos segundos en un formulario que además se llenaría mal.
 */
export function RegisterPaymentDialog({
  customerId,
  customerName,
  outstanding,
}: {
  customerId: string;
  customerName: string;
  outstanding: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<RegisterPaymentInput["method"]>("EFECTIVO");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const valid = amount !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= outstanding;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await registerPayment({ customerId, amount: parsedAmount, method, note: note.trim() || undefined });
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
      void payment;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el abono");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={outstanding <= 0}>
          <Wallet className="h-4 w-4" />
          Registrar abono
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abono de {customerName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Debe</span>
            <span className="text-lg font-bold text-amber-500">{formatPrice(outstanding)}</span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Monto recibido</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              max={outstanding}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  method === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {METHOD_LABEL[m!]}
              </button>
            ))}
          </div>

          <input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />

          {amount !== "" && parsedAmount > outstanding && (
            <span className="text-xs text-destructive">El abono no puede superar la deuda ({formatPrice(outstanding)}).</span>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}

          <p className="text-xs text-muted-foreground">
            Se aplica a las ventas más antiguas primero. No hace falta elegir contra cuál.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!valid || busy} onClick={handleSubmit}>
            {busy ? "Registrando..." : "Registrar abono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
