"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Dispara manualmente lo que el job recurrente (src/worker.ts) ya hace una vez al día — sirve
// para no tener que esperar hasta las 3am para ver el efecto de un cambio, en desarrollo o para
// forzar un reintento puntual en producción.
export function RunBillingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/subscriptions/run-billing", { method: "POST" });
      const body = (await res.json()) as { processed?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? "No se pudo correr el ciclo de facturación");
      setResult(`${body.processed} suscripción(es) procesada(s).`);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "No se pudo correr el ciclo de facturación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="outline" disabled={loading} onClick={handleRun}>
        {loading ? "Procesando..." : "Cobrar suscripciones vencidas ahora"}
      </Button>
      {result && <span className="text-xs text-zinc-400">{result}</span>}
    </div>
  );
}
