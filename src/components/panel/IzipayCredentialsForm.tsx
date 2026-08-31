"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveIzipayConfig, deleteIzipayConfig } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-primary/50";

export interface IzipayConfigStatus {
  configured: boolean;
  username: string | null;
}

// Pago en línea real (tarjetas, Yape, Plin) vía Izipay — credenciales de la cuenta comercio propia
// del negocio (Back Office Vendedor de Izipay), nunca vuelven descifradas del servidor una vez
// guardadas, mismo criterio que SunatCredentialsForm.
export function IzipayCredentialsForm({ initial }: { initial: IzipayConfigStatus }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [hmacKey, setHmacKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveIzipayConfig({ username, password, publicKey, hmacKey });
      setSaved(true);
      setPassword("");
      setHmacKey("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("¿Quitar las credenciales de Izipay? El checkout volverá a confirmación manual de pago hasta que configures otras.")) return;
    setSaving(true);
    try {
      await deleteIzipayConfig();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Pago en línea (Izipay)</h2>
        {initial.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="secondary">Sin configurar</Badge>}
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Tarjetas, Yape y Plin desde el checkout. Necesitas una cuenta comercio en Izipay — las credenciales de{" "}
        <strong className="text-zinc-400">prueba (Test)</strong> están en tu Back Office Vendedor. Sin esto configurado, el checkout
        sigue con confirmación manual de pago.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Identificador de tienda (USERNAME)
            <input required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder={initial.username ?? ""} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Clave (PASSWORD)
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Llave pública (PUBLIC_KEY)
            <input required value={publicKey} onChange={(e) => setPublicKey(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Llave HMAC-SHA-256
            <input required type="password" value={hmacKey} onChange={(e) => setHmacKey(e.target.value)} className={inputClass} />
          </label>
        </div>

        {error && <span className="text-sm text-destructive">{error}</span>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : initial.configured ? "Reemplazar credenciales" : "Guardar credenciales"}
          </Button>
          {initial.configured && (
            <Button type="button" variant="outline" disabled={saving} onClick={handleRemove}>
              Quitar credenciales
            </Button>
          )}
          {saved && <span className="text-sm text-emerald-400">Guardado.</span>}
        </div>
      </form>
    </div>
  );
}
