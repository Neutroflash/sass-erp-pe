"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { claimCustomDomain, verifyCustomDomain, removeCustomDomain } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

export interface CustomDomainStatus {
  customDomain: string | null;
  pending: string | null;
  txtRecordName: string | null;
  txtRecordValue: string | null;
}

export function CustomDomainForm({ initial }: { initial: CustomDomainStatus }) {
  const router = useRouter();
  const [domainInput, setDomainInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{ txtRecordName: string; txtRecordValue: string } | null>(
    initial.txtRecordName && initial.txtRecordValue ? { txtRecordName: initial.txtRecordName, txtRecordValue: initial.txtRecordValue } : null,
  );

  async function handleClaim(e: FormEvent) {
    e.preventDefault();
    setClaiming(true);
    setError(null);
    setInfo(null);
    try {
      const result = await claimCustomDomain(domainInput.trim().toLowerCase());
      setPendingResult({ txtRecordName: result.txtRecordName, txtRecordValue: result.txtRecordValue });
      setDomainInput("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reclamar el dominio");
    } finally {
      setClaiming(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const result = await verifyCustomDomain();
      setInfo(`¡Verificado! Tu tienda ya responde en ${result.customDomain}.`);
      setPendingResult(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el dominio");
    } finally {
      setVerifying(false);
    }
  }

  async function handleRemove() {
    if (!confirm("¿Quitar el dominio propio? Tu tienda seguirá disponible en el subdominio de siempre.")) return;
    setRemoving(true);
    try {
      await removeCustomDomain();
      setPendingResult(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el dominio");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-yellow-400/80">Dominio propio</h2>
        {initial.customDomain ? <Badge variant="success">Verificado</Badge> : pendingResult ? <Badge variant="secondary">Pendiente</Badge> : <Badge variant="outline">Sin configurar</Badge>}
      </div>

      {initial.customDomain && !pendingResult ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-300">
            Tu tienda responde en <span className="text-yellow-400">{initial.customDomain}</span>.
          </p>
          <Button size="sm" variant="outline" disabled={removing} onClick={handleRemove} className="w-fit">
            Quitar dominio
          </Button>
        </div>
      ) : pendingResult ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            Agrega este registro TXT en el DNS de tu dominio, luego verifica. La propagación puede tardar unos minutos.
          </p>
          <div className="rounded-lg border border-zinc-800/80 bg-black/30 p-3 font-mono text-xs text-zinc-300">
            <p>
              <span className="text-zinc-500">Nombre:</span> {pendingResult.txtRecordName}
            </p>
            <p className="mt-1 break-all">
              <span className="text-zinc-500">Valor:</span> {pendingResult.txtRecordValue}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={verifying} onClick={handleVerify}>
              {verifying ? "Verificando..." : "Verificar ahora"}
            </Button>
            <Button size="sm" variant="ghost" disabled={removing} onClick={handleRemove}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleClaim} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-zinc-300">
            Dominio
            <input
              required
              placeholder="tiendadeljuan.pe"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className={cn(inputClass, "w-full")}
            />
          </label>
          <Button type="submit" size="sm" disabled={claiming}>
            {claiming ? "Reclamando..." : "Reclamar dominio"}
          </Button>
        </form>
      )}

      {error && <span className="mt-2 block text-xs text-destructive">{error}</span>}
      {info && <span className="mt-2 block text-xs text-emerald-400">{info}</span>}
    </div>
  );
}
